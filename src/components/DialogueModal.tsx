import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { DensityLevel, DialogueChoice, NPCData } from '../types/game';

interface DialogueModalProps {
  npc: NPCData;
  currentNodeId: number;
  currentDensity: DensityLevel;
  onSelectChoice: (choice: DialogueChoice) => void;
  onClose: () => void;
}

export const DialogueModal: React.FC<DialogueModalProps> = ({
  npc,
  currentNodeId,
  currentDensity,
  onSelectChoice,
  onClose,
}) => {
  const node = npc.dialogue[currentNodeId];
  if (!node) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-end md:items-center justify-center bg-slate-950/70 p-4 md:p-8">
      <div className="w-full max-w-2xl bg-slate-950/96 border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 bg-slate-900/90 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-amber-300 tracking-wide">{npc.name}</h2>
              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-sky-300 font-semibold">
                {npc.smcAffiliation}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{npc.title}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {npc.distortions.map((d) => (
                <span
                  key={d}
                  className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-slate-700 text-slate-300"
                >
                  Distortion: {d}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Dialogue"
            className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4th-Density Telepathic Emotion Perception */}
        {currentDensity >= 4 && (
          <div className="px-6 py-2 bg-purple-950/50 border-b border-purple-700/40 flex items-center gap-2 text-xs text-purple-200">
            <Sparkles className="w-3.5 h-3.5 text-purple-300 shrink-0" />
            <span>
              <strong>4th-Density Empathy Perceived:</strong> {npc.emotion4D}
            </span>
          </div>
        )}

        {/* Dialogue Text */}
        <div className="px-6 py-5">
          <p className="text-slate-100 text-sm md:text-base leading-relaxed">{node.text}</p>

          {/* Choices */}
          <div className="mt-6 space-y-2.5">
            {node.choices.map((choice, idx) => {
              const lockedByDensity = choice.minDensity && currentDensity < choice.minDensity;
              return (
                <button
                  key={idx}
                  disabled={Boolean(lockedByDensity)}
                  onClick={() => onSelectChoice(choice)}
                  className={`w-full text-left px-4 py-3 rounded border text-sm transition-colors flex items-center justify-between gap-3 ${
                    lockedByDensity
                      ? 'bg-slate-900/50 border-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 hover:border-amber-400/70 text-slate-100 cursor-pointer'
                  }`}
                >
                  <span>
                    <span className="font-mono text-amber-400 mr-2">{idx + 1}.</span>
                    {choice.text}
                  </span>
                  {choice.serviceEffect && !lockedByDensity && (
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded shrink-0 ${
                        choice.serviceEffect.polarity === 'STO'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                          : choice.serviceEffect.polarity === 'STS'
                            ? 'bg-rose-950 text-rose-300 border border-rose-700/60'
                            : 'bg-sky-950 text-sky-300 border border-sky-700/60'
                      }`}
                    >
                      {choice.serviceEffect.polarity === 'STO'
                        ? 'Service to Others'
                        : choice.serviceEffect.polarity === 'STS'
                          ? 'Service to Self'
                          : 'Wisdom'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
