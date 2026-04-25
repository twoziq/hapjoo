'use client';

const STRINGS = 6;
const FRETS = 5;
const STAR: Record<number, string> = { 1: '★☆☆', 2: '★★☆', 3: '★★★' };

interface ChordEntry {
  frets: string;
  difficulty?: number;
  label?: string;
  alternatives?: ChordEntry[];
}

interface Props {
  chordName: string;
  chordData: ChordEntry | null | undefined;
  onClose: () => void;
}

function DiagramSVG({ frets, label }: { frets: string; label?: string }) {
  const cellW = 30, cellH = 26;
  const ox = 22, oy = 32;
  const width = ox + cellW * (STRINGS - 1) + 24;
  const height = oy + cellH * FRETS + (label ? 20 : 8);

  const notes = (frets || 'xxxxxx').split('');
  const nums = notes.filter(f => f !== 'x' && f !== '0').map(Number);
  const minFret = nums.length ? Math.min(...nums) : 1;
  const hasOpen = notes.some(f => f === '0');
  const start = (hasOpen || minFret <= 1) ? 1 : minFret;
  const showNut = start === 1;

  return (
    <svg width={width} height={height} className="overflow-visible">
      {showNut
        ? <line x1={ox} y1={oy} x2={ox + cellW * (STRINGS - 1)} y2={oy} stroke="#1a1a1a" strokeWidth={3.5} strokeLinecap="round" />
        : <text x={ox - 4} y={oy + cellH * 0.7} fontSize={10} fill="#9ca3af" textAnchor="end">{start}fr</text>
      }
      {Array.from({ length: FRETS + 1 }).map((_, i) => (
        <line key={i} x1={ox} y1={oy + cellH * i} x2={ox + cellW * (STRINGS - 1)} y2={oy + cellH * i} stroke="#d1d5db" strokeWidth={1} />
      ))}
      {Array.from({ length: STRINGS }).map((_, i) => (
        <line key={i} x1={ox + cellW * i} y1={oy} x2={ox + cellW * i} y2={oy + cellH * FRETS} stroke="#9ca3af" strokeWidth={1} />
      ))}
      {notes.map((f, i) => {
        const x = ox + cellW * i;
        if (f === 'x') return <text key={i} x={x} y={oy - 11} textAnchor="middle" fontSize={13} fill="#ef4444" fontWeight="bold">×</text>;
        if (f === '0') return <circle key={i} cx={x} cy={oy - 12} r={6} fill="none" stroke="#374151" strokeWidth={1.8} />;
        const rel = parseInt(f, 10) - start + 1;
        if (rel < 1 || rel > FRETS) return null;
        return <circle key={i} cx={x} cy={oy + cellH * (rel - 1) + cellH / 2} r={10} fill="#1a1a1a" />;
      })}
      {label && <text x={width / 2} y={height - 3} textAnchor="middle" fontSize={10} fill="#9ca3af">{label}</text>}
    </svg>
  );
}

export default function ChordDiagram({ chordName, chordData, onClose }: Props) {
  if (!chordData) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{chordName}</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl w-8 h-8 flex items-center justify-center">×</button>
        </div>
        <div className="flex gap-6 overflow-x-auto pb-2">
          <div className="flex flex-col items-center shrink-0">
            <DiagramSVG frets={chordData.frets} />
            <p className="text-xs text-amber-500 mt-1">{STAR[chordData.difficulty ?? 1]}</p>
          </div>
          {chordData.alternatives?.map((v, i) => (
            <div key={i} className="flex flex-col items-center shrink-0">
              <DiagramSVG frets={v.frets} label={v.label} />
              <p className="text-xs text-amber-500 mt-1">{STAR[v.difficulty ?? 1]}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
