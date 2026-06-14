import { Brain, Lock, Cpu, ShieldCheck, Coins, Check } from "lucide-react";

const PHASES = [
  { label: "Analyze", icon: Brain },
  { label: "Escrow", icon: Lock },
  { label: "Execute", icon: Cpu },
  { label: "Verify", icon: ShieldCheck },
  { label: "Settle", icon: Coins },
] as const;

function phaseIndex(step: string | null): number {
  if (!step) return 0;
  if (["ANALYZING_INTENT", "CHAIN_STEP"].includes(step)) return 0;
  if (["ESCROW_TX_PENDING", "ESCROW_LOCKED"].includes(step)) return 1;
  if (step === "EXECUTING_SPECIALIST") return 2;
  if (["EVALUATING_RESULT", "SETTLEMENT_TX_PENDING"].includes(step)) return 3;
  if (["FUNDS_RELEASED", "DIRECT_RESPONSE"].includes(step)) return 4;
  if (["TASK_REJECTED", "SPECIALIST_UNAVAILABLE", "ERROR"].includes(step)) return 3;
  return 0;
}

interface ExecutionStripProps {
  executionStep: string | null;
  currentNiche?: string | null;
}

export default function ExecutionStrip({ executionStep, currentNiche }: ExecutionStripProps) {
  const active = phaseIndex(executionStep);
  const failed = ["TASK_REJECTED", "SPECIALIST_UNAVAILABLE", "ERROR"].includes(executionStep || "");
  const complete = ["FUNDS_RELEASED", "DIRECT_RESPONSE"].includes(executionStep || "");

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm px-4 py-3">
      <div className="flex items-center justify-between gap-1">
        {PHASES.map((phase, i) => {
          const Icon = phase.icon;
          const isDone = complete ? i <= 4 : i < active;
          const isCurrent = !complete && !failed && i === active;
          const isFailed = failed && i === 3;

          return (
            <div key={phase.label} className="flex flex-col items-center flex-1 min-w-0">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                  isFailed
                    ? "border-red-500/50 bg-red-500/15 text-red-400"
                    : isDone
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                      : isCurrent
                        ? "border-(--color-accent)/50 bg-(--color-accent)/15 text-(--color-accent) shadow-[0_0_16px_color-mix(in_srgb,var(--color-accent)_30%,transparent)] scale-110"
                        : "border-white/10 bg-white/5 text-white/30"
                }`}
              >
                {isDone && !isCurrent && !isFailed ? (
                  <Check size={14} strokeWidth={2.5} />
                ) : (
                  <Icon size={14} strokeWidth={isCurrent ? 2.25 : 1.75} />
                )}
              </div>
              <span
                className={`mt-1.5 text-[9px] font-medium uppercase tracking-wider truncate w-full text-center ${
                  isCurrent ? "text-white/80" : isDone ? "text-white/45" : "text-white/25"
                }`}
              >
                {phase.label}
              </span>
            </div>
          );
        })}
      </div>

      {currentNiche && active >= 2 && active <= 3 && (
        <p className="mt-2.5 pt-2 border-t border-white/8 text-[11px] text-center text-white/45">
          Specialist: <span className="text-(--color-secondary-accent) font-medium">{currentNiche}</span>
        </p>
      )}
    </div>
  );
}
