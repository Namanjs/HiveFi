import { useEffect, useState, useRef } from "react";
import { ReactFlow, Background, BackgroundVariant, useNodesState, useEdgesState, Handle, Position, Node, Edge, ReactFlowProvider, useReactFlow, useNodesInitialized, useNodes } from "@xyflow/react";
import { motion, AnimatePresence } from "framer-motion";
import { Database, LucideIcon, Maximize2, Minimize2, Monitor, Cpu } from "lucide-react";
import "@xyflow/react/dist/style.css";

interface CustomNodeData extends Record<string, unknown> {
  label: string;
  desc: string;
  icon: LucideIcon;
  nodeType: "orchestrator" | "blockchain" | "specialist";
  isActive: boolean;
  status: "normal" | "success" | "fail" | "offline";
  subDesc?: string;
}

interface SwarmCanvasProps {
  executionStep: string | null;
  activeSpecialists: string[];
  currentExecutingNiche?: string | null;
  mode?: "normal" | "enlarged" | "fullscreen" | "minimized";
  latestTask?: string;
  availableModels?: any[];
  onToggleEnlarge?: () => void;
  onToggleFullScreen?: () => void;
}

const CustomNode = ({ data }: { data: CustomNodeData }) => {
  const Icon = data.icon;
  
  let pulseClass = "";
  if (data.isActive) {
    if (data.status === "success") pulseClass = "active-success";
    else if (data.status === "fail") pulseClass = "active-fail";
    else if (data.status === "offline") pulseClass = "active-offline";
    else pulseClass = "active-pulse";
  }

  return (
    <div className={`custom-node ${pulseClass}`}>
      {data.nodeType !== "orchestrator" && (
        <Handle type="target" position={Position.Top} id="target-top" className="!opacity-0 !w-0 !h-0 !border-0" />
      )}

      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded flex items-center justify-center bg-[#111] border border-[#333] text-[#aaa]">
          <Icon size={14} />
        </div>
        <div className="flex flex-col">
          <span className="font-mono font-medium text-[11px] text-white tracking-wide">
            {data.label}
          </span>
          <span className="text-[9px] text-[#666]">
            {data.desc}
          </span>
        </div>
      </div>
      
      {data.subDesc && (
        <div className="mt-1 pt-2 border-t border-[#222] text-[9px] font-mono text-[#888]">
          {data.subDesc}
        </div>
      )}

      {data.nodeType !== "specialist" && (
        <Handle type="source" position={Position.Bottom} id="source-bottom" className="!opacity-0 !w-0 !h-0 !border-0" />
      )}
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

function FlowFitter({ 
  mode, 
  containerRef 
}: { 
  mode: string; 
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { fitView } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const nodes = useNodes();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 1. Fit view robustly across animation frames
  useEffect(() => {
    if (nodesInitialized && nodes.length > 0) {
      const timeouts = [50, 200, 550, 800].map(t => 
        setTimeout(() => fitView({ padding: 0.1, minZoom: 0.5, maxZoom: 1, duration: 400 }), t)
      );
      return () => timeouts.forEach(clearTimeout);
    }
  }, [nodes.length, nodesInitialized, fitView, mode]);

  // 2. Observe container size changes and trigger fitView when size stabilizes (e.g. after transitions/resizes)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        fitView({ padding: 0.1, minZoom: 0.5, maxZoom: 1, duration: 400 });
      }, 50);
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [fitView, containerRef]);


  return null;
}

export default function SwarmCanvas({ executionStep, activeSpecialists, currentExecutingNiche = null, mode = "normal", latestTask = "", availableModels = [], onToggleEnlarge, onToggleFullScreen }: SwarmCanvasProps) {
  const [particleAnimation, setParticleAnimation] = useState<"escrow" | "release" | "refund" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (executionStep === "ESCROW_LOCKED") {
      setParticleAnimation("escrow");
      timer = setTimeout(() => setParticleAnimation(null), 1000);
    } else if (executionStep === "FUNDS_RELEASED") {
      setParticleAnimation("release");
      timer = setTimeout(() => setParticleAnimation(null), 1000);
    } else if (executionStep === "TASK_REJECTED") {
      setParticleAnimation("refund");
      timer = setTimeout(() => setParticleAnimation(null), 1000);
    } else {
      setParticleAnimation(null);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [executionStep]);

  const [nodes, setNodes] = useNodesState<Node<CustomNodeData>>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);

  // Derive full nodes/edges when activeSpecialists changes
  useEffect(() => {
    const getPrice = (niche: string) => {
      const model = availableModels.find(m => m.niche.toUpperCase() === niche.toUpperCase());
      if (model && model.pricePerQuery) return model.pricePerQuery;
      const fallbackPrices: Record<string, string> = { SQL: "0.05", PYTHON: "0.08", FRONTEND: "0.06", DESIGN: "0.04" };
      return fallbackPrices[niche.toUpperCase()] || "0.05";
    };
    
    // Orchestrator Node
    const orchestratorNode: Node<CustomNodeData> = {
      id: "orchestrator",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        label: "ORCHESTRATOR",
        desc: "Main routing agent",
        icon: Cpu,
        nodeType: "orchestrator",
        isActive: false,
        status: "normal",
      },
    };

    // Blockchain Node
    const blockchainNode: Node<CustomNodeData> = {
      id: "blockchain",
      type: "custom",
      position: { x: 0, y: 140 },
      data: {
        label: "WALLET CONNECTING",
        desc: "Smart Contract Escrow",
        icon: Database,
        nodeType: "blockchain",
        isActive: false,
        status: "normal",
      },
    };

    const orchestratorEdge: Edge = {
      id: "e-orch-chain",
      source: "orchestrator",
      target: "blockchain",
      type: "default",
      animated: true,
      style: { stroke: "var(--color-accent)", strokeOpacity: 0.3, strokeWidth: 1.5 },
    };

    const specialistNodes: Node<CustomNodeData>[] = activeSpecialists.map((niche, index) => {
      const total = activeSpecialists.length;
      const spacing = 280;
      const totalWidth = (total - 1) * spacing;
      const startX = 0 - totalWidth / 2;
      const x = total === 1 ? 0 : startX + index * spacing;
      
      const descText = latestTask ? `"${latestTask.length > 50 ? latestTask.substring(0, 47) + '...' : latestTask}"` : `Fine-tuned ${niche.toLowerCase()} agent`;

      return {
        id: `specialist-${niche}`,
        type: "custom",
        position: { x, y: 280 },
        data: {
          label: `${niche} SPECIALIST`,
          desc: descText,
          icon: Monitor,
          nodeType: "specialist",
          isActive: false,
          status: "normal",
          subDesc: `Rate: ${getPrice(niche)} USDC`,
        },
      };
    });

    const specialistEdges: Edge[] = activeSpecialists.map((niche) => ({
      id: `e-chain-${niche}`,
      source: "blockchain",
      target: `specialist-${niche}`,
      type: "default",
      animated: true,
      style: { stroke: "var(--color-accent)", strokeOpacity: 0.3, strokeWidth: 1.5 },
    }));

    if (activeSpecialists.length === 0) {
      setNodes([orchestratorNode]);
      setEdges([]);
    } else {
      setNodes([orchestratorNode, blockchainNode, ...specialistNodes]);
      setEdges([orchestratorEdge, ...specialistEdges]);
    }
  }, [activeSpecialists, latestTask, availableModels, setNodes, setEdges]);

  useEffect(() => {
    const executingNiche = currentExecutingNiche || activeSpecialists[activeSpecialists.length - 1] || null;

    setNodes((nds) =>
      nds.map((node) => {
        let isActive = false;
        let status: "normal" | "success" | "fail" | "offline" = "normal";

        if (node.id === "orchestrator") {
          isActive = ["ANALYZING_INTENT", "CHAIN_STEP", "ESCROW_TX_PENDING", "EVALUATING_RESULT", "DIRECT_RESPONSE"].includes(executionStep || "");
          if (executionStep === "DIRECT_RESPONSE") status = "success";
        } else if (node.id === "blockchain") {
          isActive = ["ESCROW_LOCKED", "SETTLEMENT_TX_PENDING", "FUNDS_RELEASED", "TASK_REJECTED"].includes(executionStep || "");
          if (executionStep === "FUNDS_RELEASED") status = "success";
          if (executionStep === "TASK_REJECTED") status = "fail";
        } else if (node.id.startsWith("specialist-")) {
          const niche = node.id.replace("specialist-", "");
          isActive =
            ["EXECUTING_SPECIALIST", "EVALUATING_RESULT"].includes(executionStep || "") &&
            executingNiche === niche;

          if (executionStep === "SPECIALIST_UNAVAILABLE" && executingNiche === niche) {
            isActive = true;
            status = "offline";
          }
        }

        return {
          ...node,
          data: { ...node.data, isActive, status },
        };
      })
    );

    setEdges((eds) =>
      eds.map((edge) => {
        let isGlowing = false;

        if (edge.id === "e-orch-chain") {
          isGlowing = ["ESCROW_LOCKED", "ESCROW_TX_PENDING", "SETTLEMENT_TX_PENDING", "FUNDS_RELEASED"].includes(executionStep || "");
        } else if (edge.id.startsWith("e-chain-")) {
          const niche = edge.id.replace("e-chain-", "");
          isGlowing =
            ["EXECUTING_SPECIALIST", "EVALUATING_RESULT"].includes(executionStep || "") &&
            executingNiche === niche;
        }

        return {
          ...edge,
          animated: isGlowing || edge.animated,
          style: {
            ...edge.style,
            strokeOpacity: isGlowing ? 1 : 0.6,
            stroke: isGlowing ? "var(--color-accent)" : "rgba(255,255,255,0.4)",
            filter: isGlowing ? "drop-shadow(0 0 5px var(--color-accent))" : "none",
          },
        };
      })
    );
  }, [executionStep, activeSpecialists, currentExecutingNiche, setNodes, setEdges]);

  const particlePaths = {
    escrow: { start: { x: "300px", y: "115px" }, end: { x: "300px", y: "155px" } },
    release: { start: { x: "300px", y: "245px" }, end: { x: "300px", y: "285px" } },
    refund: { start: { x: "300px", y: "155px" }, end: { x: "300px", y: "115px" } }
  };

  const activePath = particlePaths[particleAnimation || "escrow"];

  const isMinimized = mode === "minimized";
  const isEnlarged = mode === "enlarged" || mode === "fullscreen";

  return (
    <div className="relative w-full h-full rounded-3xl border border-white/10 bg-black/60 backdrop-blur-3xl shadow-[0_10px_28px_-14px_rgba(0,0,0,0.55)] overflow-hidden group transition-all duration-500 flex flex-col">
      {/* Top Glow Line */}
      <div className={`absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-(--color-accent) to-transparent transition-opacity duration-500 z-50 ${isEnlarged ? "opacity-100 shadow-[0_0_15px_var(--color-accent)]" : "opacity-30"}`} />

      {/* Decorative Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
      
      {/* Dynamic Glow Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent)]/5 via-transparent to-[var(--color-secondary-accent)]/5 opacity-50 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />

      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-gradient-to-r from-white/5 to-transparent relative z-20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--color-secondary-accent)] shadow-[0_0_8px_var(--color-secondary-accent)] animate-pulse" />
          <span className="text-xs font-bold tracking-[0.15em] text-white uppercase drop-shadow-md">
            Swarm Neural Net
          </span>
        </div>

        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onToggleEnlarge && (
            <button onClick={onToggleEnlarge} className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors" data-tooltip-bottom={isEnlarged ? "Restore" : "Enlarge panel"}>
              {mode === "enlarged" || mode === "fullscreen" ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          )}
          {onToggleFullScreen && (
            <button onClick={onToggleFullScreen} className={`p-1.5 hover:bg-white/10 rounded-lg transition-colors ${mode === "fullscreen" ? "text-[var(--color-secondary-accent)] bg-[var(--color-secondary-accent)]/20" : "text-white/50 hover:text-white"}`} data-tooltip-bottom-right="Toggle Fullscreen">
              <Monitor size={14} />
            </button>
          )}
        </div>
      </div>

      <div ref={containerRef} className={`relative flex-1 w-full h-full flex flex-col transition-opacity duration-300 ${isMinimized ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        <ReactFlowProvider>
          <FlowFitter mode={mode} containerRef={containerRef} />
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
              fitViewOptions={{ padding: 0.1, minZoom: 0.5, maxZoom: 1 }}
              minZoom={0.2}
              maxZoom={1.5}
              nodesConnectable={false}
              nodesDraggable={false}
              panOnDrag={false}
              zoomOnScroll={false}
              zoomOnPinch={false}
              zoomOnDoubleClick={false}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#ffffff" gap={20} size={1} variant={BackgroundVariant.Lines} style={{ opacity: 0.05 }} />
            </ReactFlow>
        </ReactFlowProvider>

        <AnimatePresence>
          {particleAnimation && (
            <motion.div
              className="usdc-particle"
              initial={{ left: activePath.start.x, top: activePath.start.y, opacity: 0, scale: 0.5 }}
              animate={{ left: activePath.end.x, top: activePath.end.y, opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
