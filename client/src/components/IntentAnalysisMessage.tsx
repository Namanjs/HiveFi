import { DropdownMenu } from "./DropdownMenu";
import { Play } from "lucide-react";

interface IntentAnalysisMessageProps {
  intent: any;
  availableModels: any[];
  selectedModels: Record<string, string>;
  onModelSelect: (niche: string, modelId: string) => void;
  onExecute: () => void;
}

export function IntentAnalysisMessage({ intent, availableModels, selectedModels, onModelSelect, onExecute }: IntentAnalysisMessageProps) {
  if (!intent || !intent.chain) return null;

  return (
    <div className="flex w-full justify-start gap-5 mb-6 animate-in fade-in duration-300">
      <div className="w-8 h-8 rounded-full bg-linear-to-br from-[var(--color-accent)] to-[var(--color-secondary-accent)] shrink-0 flex items-center justify-center shadow-lg border border-white/10 mt-0.5">
        <span className="text-white font-bold text-sm tracking-tighter">H</span>
      </div>
      <div className="flex-1 min-w-0 bg-[#1a1a1c] border border-white/10 rounded-2xl p-5 shadow-lg relative">
        <h3 className="text-white font-semibold mb-3">Intent Detected</h3>
        <p className="text-white/80 text-sm mb-5 leading-relaxed">{intent.text}</p>
        
        <div className="space-y-4 mb-6">
          <h4 className="text-white/60 text-xs uppercase font-bold tracking-wider">Required Specialists</h4>
          <div className="space-y-3">
            {intent.chain.map((step: any, idx: number) => {
              const niche = step.niche.toUpperCase();
              const matchingModels = availableModels.filter(m => m.niche.toUpperCase() === niche);
              const options = matchingModels.map(m => ({
                id: m.id,
                label: m.name,
                subLabel: `${m.pricePerQuery} USDC`
              }));
              
              const currentVal = selectedModels[niche] || "";

              return (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                  <div className="flex-1 min-w-0">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--color-accent)]/20 text-[var(--color-accent)] mb-1">
                      STEP {idx + 1}
                    </span>
                    <div className="text-white text-sm font-medium">{niche}</div>
                    <div className="text-white/50 text-xs truncate" title={step.sub_prompt}>{step.sub_prompt}</div>
                  </div>
                  <div className="sm:w-56 shrink-0">
                    <DropdownMenu
                      label="Select Model"
                      options={options}
                      value={currentVal}
                      onChange={(val) => onModelSelect(niche, val)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-white/10">
          <button
            onClick={onExecute}
            className="flex items-center gap-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-white font-medium py-2 px-5 rounded-full transition-all hover:scale-105 shadow-[0_0_15px_var(--color-accent)]"
          >
            <Play size={16} className="fill-current" />
            Confirm & Execute
          </button>
        </div>
      </div>
    </div>
  );
}
