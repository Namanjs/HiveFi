import { useMemo, useEffect, useState, useRef } from "react";
import { ReactFlow, Background, BackgroundVariant, useNodesState, useEdgesState, Handle, Position, Node, Edge, ReactFlowProvider, useReactFlow, useNodesInitialized } from "@xyflow/react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Server, Database, LucideIcon, Maximize2, Minimize2, Monitor } from "lucide-react";
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
  mode?: "normal" | "enlarged" | "fullscreen" | "minimized";
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
        <Handle type="target" position={Position.Top} id="target-top" />
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
        <Handle type="source" position={Position.Bottom} id="source-bottom" />
      )}
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

function FlowFitter({ 
  mode, 
  numSpecialists, 
  containerRef 
}: { 
  mode: string; 
  numSpecialists: number; 
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { fitView } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstFitDone = useRef(false);

  // 1. Fit view when nodes are initialized or when specialists count changes
  useEffect(() => {
    if (nodesInitialized) {
      if (!firstFitDone.current) {
        let timeoutId: ReturnType<typeof setTimeout>;
        const frameId = requestAnimationFrame(() => {
          timeoutId = setTimeout(() => {
            fitView({ padding: 0.2, duration: 0 });
            firstFitDone.current = true;
          }, 100);
        });
        return () => {
          cancelAnimationFrame(frameId);
          clearTimeout(timeoutId);
        };
      } else {
        // Instant fit to avoid flash of off-center content
        fitView({ padding: 0.2, duration: 0 });
        
        // Secondary deferred fits to handle font layout shifts or initial rendering cycles
        const t1 = setTimeout(() => fitView({ padding: 0.2, duration: 0 }), 50);
        const t2 = setTimeout(() => fitView({ padding: 0.2, duration: 0 }), 150);
        const t3 = setTimeout(() => fitView({ padding: 0.2, duration: 0 }), 300);
        return () => {
          clearTimeout(t1);
          clearTimeout(t2);
          clearTimeout(t3);
        };
      }
    }
  }, [nodesInitialized, numSpecialists, fitView]);

  // 2. Observe container size changes and trigger fitView when size stabilizes (e.g. after transitions/resizes)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      // Clear previous timer during transition/resize
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      
      // Trigger fitView after size stabilizes (100ms after last resize event)
      debounceTimer.current = setTimeout(() => {
        fitView({ padding: 0.2, duration: 200 });
      }, 100);
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [fitView, containerRef]);

  // 3. Handle panel mode transitions (e.g. normal -> enlarged -> fullscreen)
  useEffect(() => {
    fitView({ padding: 0.2, duration: 300 });
    
    const timeout = setTimeout(() => {
      fitView({ padding: 0.2, duration: 300 });
    }, 350);
    return () => clearTimeout(timeout);
  }, [mode, fitView]);

  return null;
}

export default function SwarmCanvas({ executionStep, activeSpecialists, mode = "normal", onToggleEnlarge, onToggleFullScreen }: SwarmCanvasProps) {
  const [particleAnimation, setParticleAnimation] = useState<"escrow" | "release" | "refund" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (executionStep === "ESCROW_LOCKED") {
      setParticleAnimation("escrow");
      const timer = setTimeout(() => setParticleAnimation(null), 1000);
      return () => clearTimeout(timer);
    } else if (executionStep === "FUNDS_RELEASED") {
      setParticleAnimation("release");
      const timer = setTimeout(() => setParticleAnimation(null), 1000);
      return () => clearTimeout(timer);
    } else if (executionStep === "TASK_REJECTED") {
      setParticleAnimation("refund");
      const timer = setTimeout(() => setParticleAnimation(null), 1000);
      return () => clearTimeout(timer);
    }
  }, [executionStep]);

  const baseNodes: Node<CustomNodeData>[] = useMemo(() => [
    {
      id: "orchestrator",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        label: "ORCHESTRATOR",
        desc: "Task analysis & routing",
        icon: Brain,
        nodeType: "orchestrator",
        isActive: false,
        status: "normal",
      },
    },
    {
      id: "blockchain",
      type: "custom",
      position: { x: 0, y: 160 },
      data: {
        label: "BASE SEPOLIA",
        desc: "L2 Escrow Contract",
        icon: Server,
        nodeType: "blockchain",
        isActive: false,
        status: "normal",
        subDesc: "0xCf7E...F0Fc"
      },
    },
  ], []);

  const baseEdges: Edge[] = useMemo(() => [
    {
      id: "edge-orch-bc",
      source: "orchestrator",
      sourceHandle: "source-bottom",
      target: "blockchain",
      targetHandle: "target-top",
      type: "default",
      animated: false,
    },
  ], []);

  const [nodes, setNodes] = useNodesState<Node<CustomNodeData>>(baseNodes);
  const [edges, setEdges] = useEdgesState(baseEdges);

  // Derive full nodes/edges when activeSpecialists changes
  useEffect(() => {
    const registryPrices: Record<string, string> = { SQL: "0.05", PYTHON: "0.08", FRONTEND: "0.06", DESIGN: "0.04" };
    
    const specialistNodes: Node<CustomNodeData>[] = activeSpecialists.map((niche, index) => {
      const total = activeSpecialists.length;
      const spacing = 280;
      const totalWidth = (total - 1) * spacing;
      const startX = 0 - totalWidth / 2;
      const x = total === 1 ? 0 : startX + index * spacing;

      return {
        id: `specialist-${niche}`,
        type: "custom",
        position: { x, y: 290 },
        data: {
          label: `${niche} SPECIALIST`,
          desc: `Fine-tuned ${niche.toLowerCase()} agent`,
          icon: Database,
          nodeType: "specialist",
          isActive: false,
          status: "normal",
          subDesc: `Rate: ${registryPrices[niche] || "0.05"} USDC`,
        },
      };
    });

    const specialistEdges: Edge[] = activeSpecialists.map((niche) => ({
      id: `edge-bc-spec-${niche}`,
      source: "blockchain",
      sourceHandle: "source-bottom",
      target: `specialist-${niche}`,
      targetHandle: "target-top",
      type: "default",
      animated: false,
    }));

    setNodes([...baseNodes, ...specialistNodes]);
    setEdges([...baseEdges, ...specialistEdges]);
  }, [activeSpecialists, baseNodes, baseEdges, setNodes, setEdges]);

  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        let isActive = false;
        let status: "normal" | "success" | "fail" | "offline" = "normal";

        if (node.id === "orchestrator") {
          isActive = ["ANALYZING_INTENT", "ESCROW_TX_PENDING", "EVALUATING_RESULT", "DIRECT_RESPONSE"].includes(executionStep || "");
          if (executionStep === "DIRECT_RESPONSE") status = "success";
        } else if (node.id === "blockchain") {
          isActive = ["ESCROW_LOCKED", "SETTLEMENT_TX_PENDING", "FUNDS_RELEASED", "TASK_REJECTED"].includes(executionStep || "");
          if (executionStep === "FUNDS_RELEASED") status = "success";
          if (executionStep === "TASK_REJECTED") status = "fail";
        } else if (node.id.startsWith("specialist-")) {
          const niche = node.id.replace("specialist-", "");
          isActive = ["EXECUTING_SPECIALIST", "EVALUATING_RESULT"].includes(executionStep || "") 
            && activeSpecialists[activeSpecialists.length - 1] === niche;
            
          if (executionStep === "SPECIALIST_UNAVAILABLE" && activeSpecialists[activeSpecialists.length - 1] === niche) {
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
        let successGlow = false;

        if (edge.id === "edge-orch-bc") {
          isGlowing = ["ESCROW_TX_PENDING", "ESCROW_LOCKED", "EVALUATING_RESULT"].includes(executionStep || "");
          successGlow = executionStep === "TASK_REJECTED";
        } else if (edge.id.startsWith("edge-bc-spec-")) {
          const niche = edge.id.replace("edge-bc-spec-", "");
          const isCurrent = activeSpecialists[activeSpecialists.length - 1] === niche;
          isGlowing = ["EXECUTING_SPECIALIST", "SETTLEMENT_TX_PENDING"].includes(executionStep || "") && isCurrent;
          successGlow = executionStep === "FUNDS_RELEASED" && isCurrent;
        }

        return {
          ...edge,
          className: successGlow ? "glowing-success" : isGlowing ? "glowing" : "",
        };
      })
    );
  }, [executionStep, activeSpecialists, setNodes, setEdges]);

  const particlePaths = {
    escrow: { start: { x: "300px", y: "115px" }, end: { x: "300px", y: "155px" } },
    release: { start: { x: "300px", y: "245px" }, end: { x: "300px", y: "285px" } },
    refund: { start: { x: "300px", y: "155px" }, end: { x: "300px", y: "115px" } }
  };

  const activePath = particlePaths[particleAnimation || "escrow"];

  const isMinimized = mode === "minimized";
  const isEnlarged = mode === "enlarged" || mode === "fullscreen";

  return (
    <div className="relative w-full h-full rounded-3xl border border-white/10 bg-black/60 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden group transition-all duration-500 flex flex-col">
      {/* Top Glow Line */}
      <div className={`absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent transition-opacity duration-500 z-50 ${isEnlarged ? "opacity-100 shadow-[0_0_15px_var(--color-accent)]" : "opacity-0"}`} />

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
          <FlowFitter mode={mode} numSpecialists={activeSpecialists.length} containerRef={containerRef} />
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.1}
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
