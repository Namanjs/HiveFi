import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, User, Lock, Cpu, CircleCheck, FileText, Wallet } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface HowSwarmWorksModalProps {
  open: boolean;
  onClose: () => void;
}

function StageBackdrop() {
  return (
    <>
      <div className="absolute inset-0 swarm-tour-stage-grid opacity-60 pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 45%, color-mix(in srgb, var(--color-accent) 12%, transparent), transparent 70%)",
        }}
      />
    </>
  );
}

function FlowArrow({ className = "" }: { className?: string }) {
  return (
    <svg className={`w-14 sm:w-20 h-6 shrink-0 ${className}`} viewBox="0 0 80 24" fill="none" aria-hidden="true">
      <path
        d="M2 12 H62"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeDasharray="5 5"
        strokeLinecap="round"
        className="swarm-tour-line"
      />
      <path
        d="M58 7 L68 12 L58 17"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
}

function VisualPrompt() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <StageBackdrop />
      <div className="relative flex items-center justify-center gap-6 sm:gap-12 px-4">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="w-[4.5rem] h-[4.5rem] sm:w-20 sm:h-20 rounded-full border border-white/20 bg-white/5 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <User size={28} className="text-white/70" strokeWidth={1.5} />
          </div>
          <span className="text-sm text-white/55 font-medium">You</span>
        </motion.div>

        <FlowArrow />

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col items-center gap-3 max-w-[240px]"
        >
          <div className="relative w-full px-5 py-4 rounded-2xl border border-white/15 bg-[#222224]/80 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            <div 
              className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-md border border-(--color-accent)/30 text-[10px] font-mono text-(--color-accent) uppercase tracking-wider"
              style={{ background: "color-mix(in srgb, var(--color-accent) 15%, #18181a)" }}
            >
              prompt
            </div>
            <p className="text-sm text-white/75 leading-relaxed pt-1">
              &ldquo;Build a SQL query, then a React table to show it&rdquo;
            </p>
          </div>
          <span className="text-sm text-white/55 font-medium">Your request</span>
        </motion.div>
      </div>
    </div>
  );
}

const ROUTE_VIEW = { w: 440, h: 340 };
const ROUTE_HUB = { cx: 220, cy: 158 };

const ROUTE_NODES = [
  { label: "SQL", cx: 38, cy: 36, delay: 0.15, accent: "var(--color-secondary-accent)", packetDur: "2.6s" },
  { label: "Python", cx: 402, cy: 36, delay: 0.25, accent: "var(--color-accent)", packetDur: "2.2s" },
  { label: "Frontend", cx: 220, cy: 312, delay: 0.35, accent: "#34d399", packetDur: "3s" },
];

function RouteConnection({
  hub,
  node,
  reverse,
}: {
  hub: { cx: number; cy: number };
  node: (typeof ROUTE_NODES)[number];
  reverse?: boolean;
}) {
  const path = `M ${hub.cx} ${hub.cy} L ${node.cx} ${node.cy}`;

  return (
    <g>
      {/* Base track */}
      <line
        x1={hub.cx}
        y1={hub.cy}
        x2={node.cx}
        y2={node.cy}
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="1.5"
        strokeDasharray="5 7"
      />

      {/* Moving light pulse along the wire */}
      <line
        x1={hub.cx}
        y1={hub.cy}
        x2={node.cx}
        y2={node.cy}
        stroke={node.accent}
        strokeWidth="2"
        strokeLinecap="round"
        className={reverse ? "swarm-tour-data-line-reverse" : "swarm-tour-data-line"}
        style={{ animationDuration: node.packetDur }}
      />

      {/* Data packet — travels hub ↔ specialist */}
      <circle r="4" fill={node.accent} filter="url(#packet-glow)" opacity="0.95">
        <animateMotion
          dur={node.packetDur}
          repeatCount="indefinite"
          path={path}
          keyPoints="0;1;0"
          keyTimes="0;0.5;1"
          calcMode="linear"
        />
      </circle>
      <circle r="2" fill="white" opacity="0.9">
        <animateMotion
          dur={node.packetDur}
          repeatCount="indefinite"
          path={path}
          keyPoints="0;1;0"
          keyTimes="0;0.5;1"
          calcMode="linear"
        />
      </circle>
    </g>
  );
}

function VisualRoute() {
  const hub = ROUTE_HUB;
  const { w, h } = ROUTE_VIEW;

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <StageBackdrop />

      <div className="relative w-full max-w-[520px] aspect-[440/340] mx-auto">
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden="true">
          <defs>
            <filter id="hub-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="10" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="packet-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {ROUTE_NODES.map((node, i) => (
            <RouteConnection key={node.label} hub={hub} node={node} reverse={i % 2 === 1} />
          ))}

          <rect
            x={hub.cx - 54}
            y={hub.cy - 54}
            width="108"
            height="108"
            rx="16"
            transform={`rotate(45 ${hub.cx} ${hub.cy})`}
            fill="color-mix(in srgb, var(--color-accent) 10%, transparent)"
            className="swarm-tour-hub-glow"
          />

          <rect
            x={hub.cx - 40}
            y={hub.cy - 40}
            width="80"
            height="80"
            rx="13"
            transform={`rotate(45 ${hub.cx} ${hub.cy})`}
            fill="color-mix(in srgb, var(--color-accent) 22%, #141416)"
            stroke="var(--color-accent)"
            strokeWidth="2"
            filter="url(#hub-glow)"
          />

          <text
            x={hub.cx}
            y={hub.cy + 9}
            textAnchor="middle"
            fill="white"
            fontSize="28"
            fontWeight="700"
            fontFamily="Outfit, system-ui, sans-serif"
          >
            H
          </text>
        </svg>

        {ROUTE_NODES.map((node) => (
          <div
            key={node.label}
            className="swarm-tour-node absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${(node.cx / w) * 100}%`,
              top: `${(node.cy / h) * 100}%`,
            }}
          >
            <div
              className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl border text-xs sm:text-sm font-semibold text-white/90 backdrop-blur-md"
              style={{
                borderColor: `color-mix(in srgb, ${node.accent} 50%, transparent)`,
                background: `color-mix(in srgb, ${node.accent} 16%, #141416)`,
                boxShadow: `0 4px 24px color-mix(in srgb, ${node.accent} 22%, transparent)`,
              }}
            >
              {node.label}
            </div>
          </div>
        ))}

        <p
          className="absolute left-1/2 -translate-x-1/2 text-sm text-white/50 font-medium"
          style={{ top: `${((hub.cy + 62) / h) * 100}%` }}
        >
          Orchestrator
        </p>
      </div>
    </div>
  );
}

function StepChip({
  icon: Icon,
  label,
  sub,
  accentClass,
  delay,
}: {
  icon: typeof Lock;
  label: string;
  sub: string;
  accentClass: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="flex flex-col items-center gap-2.5"
    >
      <div
        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border flex items-center justify-center ${accentClass}`}
      >
        <Icon size={24} strokeWidth={1.75} />
      </div>
      <div className="text-center">
        <p className="text-xs sm:text-sm font-medium text-white/75">{label}</p>
        <p className="text-[10px] sm:text-xs text-white/35 mt-0.5">{sub}</p>
      </div>
    </motion.div>
  );
}

function VisualEscrow() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <StageBackdrop />
      <div className="relative flex items-center justify-center gap-4 sm:gap-8 px-2">
        <StepChip icon={Lock} label="Escrow" sub="USDC locked" accentClass="border-amber-500/40 bg-amber-500/10 text-amber-400/90" delay={0.1} />
        <FlowArrow className="opacity-60 w-10 sm:w-14" />
        <StepChip icon={Cpu} label="Execute" sub="Specialist runs" accentClass="border-white/20 bg-white/5 text-white/70" delay={0.2} />
        <FlowArrow className="opacity-60 w-10 sm:w-14" />
        <StepChip icon={CircleCheck} label="Verify" sub="Output checked" accentClass="border-emerald-500/40 bg-emerald-500/10 text-emerald-400" delay={0.3} />
      </div>
    </div>
  );
}

function VisualDone() {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-8 px-6">
      <StageBackdrop />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-6"
      >
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border border-emerald-500/35 bg-emerald-500/10">
          <FileText size={22} className="text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white/90">Result back to you</p>
            <p className="text-xs text-white/40 mt-0.5">In the chat panel</p>
          </div>
        </div>

        <div className="hidden sm:block w-8 h-px bg-white/15 rotate-0 sm:rotate-0" />
        <div className="sm:hidden w-px h-6 bg-white/15" />

        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border border-(--color-accent)/35 bg-(--color-accent)/10">
          <Wallet size={22} className="text-(--color-accent) shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white/90">Specialist paid</p>
            <p className="text-xs text-white/40 mt-0.5">On Ethereum Sepolia</p>
          </div>
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="text-sm text-white/45 text-center max-w-sm leading-relaxed"
      >
        Toggle <span className="text-white/75 font-medium">Show Swarm</span> in the header to visualize real-time network routing and node execution.
      </motion.p>
    </div>
  );
}

const CARDS = [
  {
    step: "Step 1",
    title: "Define the intent",
    body: "Submit your request, whether it's a database query, a React component, or a Python script. Instead of relying on a single monolithic model, HiveFi treats your prompt as a precise computational job to be delegated to the network.",
    Visual: VisualPrompt,
  },
  {
    step: "Step 2",
    title: "Intelligent delegation",
    body: "The Orchestrator node parses your intent and dynamically routes the payload to the most capable Specialist node in the Swarm, such as a dedicated SQL, Python, or Frontend agent, ensuring expert-level execution.",
    Visual: VisualRoute,
  },
  {
    step: "Step 3",
    title: "Cryptographic escrow & execution",
    body: "A micro-transaction locks USDC in an on-chain smart contract before execution begins. The Specialist processes the task and the output is verified. If the execution fails or invalid results are detected, your funds are safely refunded.",
    Visual: VisualEscrow,
  },
  {
    step: "Step 4",
    title: "Verified output & settlement",
    body: "The validated result is streamed back to your interface for immediate use. Simultaneously, the smart contract unlocks and transfers the escrowed funds to the Specialist. A trustless, decentralized exchange of AI computation and value.",
    Visual: VisualDone,
  },
];

export default function HowSwarmWorksModal({ open, onClose }: HowSwarmWorksModalProps) {
  const [page, setPage] = useState(0);
  const total = CARDS.length;
  const card = CARDS[page];
  const Visual = card.Visual;
  const isLast = page === total - 1;
  const progress = ((page + 1) / total) * 100;

  useEffect(() => {
    if (open) setPage(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && page < total - 1) setPage((p) => p + 1);
      if (e.key === "ArrowLeft" && page > 0) setPage((p) => p - 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, page, total]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="swarm-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#131314]/50 backdrop-blur-md"
        aria-label="Close dialog"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-5xl h-[min(88vh,780px)] flex flex-col rounded-[28px] border border-white/12 bg-[#18181a]/85 backdrop-blur-2xl shadow-[0_40px_100px_rgba(0,0,0,0.5)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-(--color-accent) to-transparent opacity-70" />

        {/* Progress bar */}
        <div className="shrink-0 h-1 bg-white/5">
          <motion.div
            className="h-full bg-linear-to-r from-(--color-accent) to-(--color-secondary-accent)"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        </div>

        <div className="shrink-0 flex items-center justify-between px-6 sm:px-10 py-4 sm:py-5 border-b border-white/8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-(--color-secondary-accent)">
              {card.step}
            </p>
            <p className="text-sm text-white/30 mt-1 font-mono">{page + 1} / {total}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-full text-white/45 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 min-h-0 relative overflow-hidden bg-[#141416]/40">
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="absolute inset-0 p-4 sm:p-8"
            >
              <Visual />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="shrink-0 px-6 sm:px-10 py-6 sm:py-7 border-t border-white/8 bg-[#121214]/60">
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <h2 id="swarm-modal-title" className="text-xl sm:text-[1.65rem] font-semibold text-white mb-2.5 leading-snug tracking-tight">
                {card.title}
              </h2>
              <p className="text-[15px] sm:text-base text-white/50 leading-relaxed max-w-2xl">
                {card.body}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="shrink-0 px-6 sm:px-10 pb-6 sm:pb-8 flex items-center justify-between">
          <div className="flex gap-2">
            {CARDS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPage(i)}
                aria-label={`Go to step ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === page ? "w-8 bg-(--color-accent)" : "w-2 bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {page > 0 && (
              <button
                type="button"
                onClick={() => setPage((p) => p - 1)}
                className="flex items-center gap-1 px-4 py-2.5 text-sm text-white/50 hover:text-white transition-colors"
              >
                <ChevronLeft size={18} />
                Back
              </button>
            )}
            {isLast ? (
              <button
                type="button"
                onClick={onClose}
                className="px-7 py-2.5 rounded-full text-sm font-semibold text-white bg-linear-to-r from-(--color-accent) to-(--color-secondary-accent) hover:opacity-90 transition-opacity shadow-[0_0_20px_color-mix(in_srgb,var(--color-accent)_35%,transparent)]"
              >
                Got it, let&apos;s go
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                className="flex items-center gap-1 px-7 py-2.5 rounded-full text-sm font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/12 transition-colors"
              >
                Next
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
