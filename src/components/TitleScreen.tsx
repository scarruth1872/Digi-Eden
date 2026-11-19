import React, { useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface TitleScreenProps {
  hasSave: boolean;
  muted: boolean;
  onStartNew: () => void;
  onResumeSave: () => void;
  onToggleMute: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  hasSave,
  muted,
  onStartNew,
  onResumeSave,
  onToggleMute,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        if (hasSave) onResumeSave();
        else onStartNew();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasSave, onResumeSave, onStartNew]);

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-none select-none p-8 md:p-12">
      {/* Top Bar: Audio Toggle only */}
      <div className="flex items-center justify-end pointer-events-auto">
        <button
          onClick={onToggleMute}
          className="flex items-center gap-2 px-3 py-1.5 rounded border border-slate-700/80 bg-slate-950/85 text-slate-300 hover:text-amber-300 hover:border-amber-400/60 text-xs tracking-widest uppercase transition-colors cursor-pointer"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          <span>{muted ? 'Audio Muted' : 'Audio On'}</span>
        </button>
      </div>

      {/* Left-aligned Title Lockup over calm negative space */}
      <div className="max-w-xl my-auto">
        <div className="mb-5">
          {/* Bespoke inline SVG Sacred Geometry & Title Lockup */}
          <svg
            viewBox="0 0 520 130"
            className="w-full max-w-[460px] h-auto"
            aria-label="Digital Eden"
          >
            <defs>
              <linearGradient id="edenGold" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#fde68a" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#7dd3fc" />
              </linearGradient>
            </defs>
            {/* Sub-Logos Octahedron Crest */}
            <g transform="translate(46, 65)">
              <polygon
                points="0,-40 34,0 0,40 -34,0"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
              />
              <circle cx="0" cy="0" r="24" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
              <polygon points="0,-16 14,0 0,16 -14,0" fill="#fde68a" opacity="0.9" />
            </g>
            <text
              x="102"
              y="56"
              fill="#94a3b8"
              fontSize="12"
              fontWeight="600"
              letterSpacing="5"
              fontFamily="system-ui, sans-serif"
            >
              LAW OF ONE · SUB-LOGOS CHRONICLE
            </text>
            <text
              x="100"
              y="100"
              fill="url(#edenGold)"
              fontSize="50"
              fontWeight="800"
              letterSpacing="6"
              fontFamily="system-ui, sans-serif"
            >
              DIGITAL EDEN
            </text>
          </svg>
        </div>

        <p className="text-slate-200/90 text-sm md:text-base leading-relaxed mb-7 max-w-md bg-slate-950/65 px-4 py-3 rounded border-l-2 border-amber-400">
          Walk as a Guardian Wanderer across the planes of 3rd, 4th, and 5th Density.
          Channel Love Energy, confront Orion distortions, and shape your Harvest polarity by Free Will.
        </p>

        <div className="flex flex-wrap items-center gap-3 pointer-events-auto">
          <button
            onClick={onStartNew}
            className="px-7 py-3.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm tracking-[0.18em] uppercase transition-colors cursor-pointer shadow-lg"
          >
            {hasSave ? 'New Awakening' : 'Enter Digital Eden'}
          </button>
          {hasSave && (
            <button
              onClick={onResumeSave}
              className="px-6 py-3.5 rounded border border-sky-400/70 bg-slate-950/90 hover:bg-sky-950/90 text-sky-200 font-semibold text-sm tracking-[0.16em] uppercase transition-colors cursor-pointer"
            >
              Resume Save
            </button>
          )}
        </div>
      </div>

      {/* Single flat control hint line */}
      <div className="text-slate-300/85 text-xs tracking-wider uppercase font-mono bg-slate-950/75 px-4 py-2 rounded border border-slate-800/80 self-start">
        WASD Move · Space Jump · Shift Dash · Mouse Aim &amp; Fire · E Interact · Q Love Heal · 1/2/3 Shift Density · Tab Codex · Esc Pause
      </div>
    </div>
  );
};
