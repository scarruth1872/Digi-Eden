import React from 'react';
import { GamePhase, PlayerStats } from '../types/game';

interface PauseModalProps {
  phase: Extract<GamePhase, 'paused' | 'victory' | 'gameover'>;
  player: PlayerStats;
  onResume: () => void;
  onSave: () => void;
  onRestart: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  phase,
  player,
  onResume,
  onSave,
  onRestart,
}) => {
  const isVictory = phase === 'victory';
  const isGameOver = phase === 'gameover';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-md bg-slate-950 border border-slate-700 rounded-lg p-7 text-center shadow-2xl space-y-5">
        <div className="text-xs uppercase tracking-[0.25em] text-sky-400 font-semibold">
          {isVictory
            ? 'Harvest Attainment'
            : isGameOver
              ? 'Vessel Dispersed'
              : 'Sanctuary Paused'}
        </div>

        <h2 className="text-2xl font-extrabold tracking-wider text-amber-300 uppercase">
          {isVictory
            ? 'Harmonic Harvest Complete'
            : isGameOver
              ? 'Return to the Light'
              : 'Digital Eden'}
        </h2>

        <p className="text-xs text-slate-300 leading-relaxed">
          {isVictory
            ? `All paths across Digital Eden have awakened. Your Harvest Score stands at ${player.harvestScore} with ${player.serviceToOthers} Service to Others and ${player.serviceToSelf} Service to Self.`
            : isGameOver
              ? 'Your physical 3rd-density vessel faltered, yet consciousness endures. Reconstitute at Sanctuary Meadow.'
              : 'Take a breath in stillness. Your polarity and progress remain anchored in the Sub-Logos.'}
        </p>

        <div className="bg-slate-900/90 border border-slate-800 rounded p-3 text-[11px] text-slate-300 font-mono space-y-1 text-left">
          <div>WASD / Space / Shift : Move, Jump, Blink Dash</div>
          <div>Left Click / R : Fire Light Weapon / Cycle Weapon</div>
          <div>E / Q / F : Interact / Love Heal / Sub-Logos Nova</div>
          <div>1 / 2 / 3 : Shift to 3rd, 4th, or 5th Density</div>
          <div>Tab / H : Open Codex / Toggle Bottom Dock</div>
        </div>

        <div className="flex flex-col gap-2.5 pt-1">
          {!isGameOver && (
            <button
              onClick={onResume}
              className="w-full py-2.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-widest cursor-pointer"
            >
              {isVictory ? 'Continue Exploring' : 'Resume Journey'}
            </button>
          )}
          {!isGameOver && (
            <button
              onClick={onSave}
              className="w-full py-2.5 rounded border border-sky-500/60 bg-slate-900 hover:bg-slate-800 text-sky-200 font-bold text-xs uppercase tracking-widest cursor-pointer"
            >
              Save Progress
            </button>
          )}
          <button
            onClick={onRestart}
            className="w-full py-2.5 rounded border border-slate-700 bg-slate-950 hover:bg-slate-900 text-slate-300 font-semibold text-xs uppercase tracking-widest cursor-pointer"
          >
            {isGameOver ? 'Reawaken in Sanctuary Meadow' : 'Restart New Journey'}
          </button>
        </div>
      </div>
    </div>
  );
};
