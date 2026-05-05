import { FRETBOARD } from '@/lib/constants';

interface Props {
  frets: string;
  fingers?: string;
  baseFret?: number;
  label?: string;
  size?: number;
}

const { strings: STRINGS, fretsShown: FRETS_SHOWN } = FRETBOARD;

export default function DiagramSVG({ frets, fingers, baseFret, label, size = 1 }: Props) {
  const cellW = 28 * size;
  const cellH = 24 * size;
  const ox = 20 * size;
  const oy = 28 * size;
  const width = ox + cellW * (STRINGS - 1) + 24 * size;
  const height = oy + cellH * FRETS_SHOWN + (label ? 20 : 10) * size;

  const notes = (frets || 'xxxxxx').split('');
  const nums = notes.filter((f) => f !== 'x' && f !== '0').map(Number);
  const minFret = nums.length ? Math.min(...nums) : 1;
  const hasOpen = notes.some((f) => f === '0');
  const start = baseFret ?? (hasOpen || minFret <= 1 ? 1 : minFret);
  const showNut = start === 1;

  // Barre detection: finger=1 positions on same fret with 2+ strings
  const fingerArr = (fingers ?? '').split('').map((n) => parseInt(n) || 0);
  const barreMap = new Map<number, number[]>();
  notes.forEach((f, i) => {
    if (f === 'x' || f === '0') return;
    const fv = parseInt(f, 10);
    if (fingerArr[i] === 1) {
      const g = barreMap.get(fv) ?? [];
      g.push(i);
      barreMap.set(fv, g);
    }
  });
  const barres: { fret: number; minStr: number; maxStr: number }[] = [];
  const barreStringFrets = new Set<string>();
  for (const [fret, strs] of barreMap.entries()) {
    if (strs.length >= 2) {
      const minStr = Math.min(...strs);
      const maxStr = Math.max(...strs);
      barres.push({ fret, minStr, maxStr });
      for (let s = minStr; s <= maxStr; s++) barreStringFrets.add(`${s}:${fret}`);
    }
  }

  return (
    <svg width={width} height={height} className="overflow-visible">
      {showNut ? (
        <line
          x1={ox}
          y1={oy}
          x2={ox + cellW * (STRINGS - 1)}
          y2={oy}
          stroke="#1a1a1a"
          strokeWidth={3 * size}
          strokeLinecap="round"
        />
      ) : (
        <text x={ox - 4} y={oy + cellH * 0.7} fontSize={9 * size} fill="#9ca3af" textAnchor="end">
          {start}fr
        </text>
      )}
      {Array.from({ length: FRETS_SHOWN + 1 }).map((_, i) => (
        <line
          key={i}
          x1={ox}
          y1={oy + cellH * i}
          x2={ox + cellW * (STRINGS - 1)}
          y2={oy + cellH * i}
          stroke="#d1d5db"
          strokeWidth={1}
        />
      ))}
      {Array.from({ length: STRINGS }).map((_, i) => (
        <line
          key={i}
          x1={ox + cellW * i}
          y1={oy}
          x2={ox + cellW * i}
          y2={oy + cellH * FRETS_SHOWN}
          stroke="#9ca3af"
          strokeWidth={1}
        />
      ))}

      {/* Barre bars */}
      {barres.map((b) => {
        const rel = b.fret - start + 1;
        if (rel < 1 || rel > FRETS_SHOWN) return null;
        const x1 = ox + cellW * b.minStr;
        const x2 = ox + cellW * b.maxStr;
        const cy = oy + cellH * (rel - 1) + cellH / 2;
        const r = 10 * size;
        return (
          <rect
            key={`barre-${b.fret}`}
            x={x1 - r}
            y={cy - r}
            width={x2 - x1 + r * 2}
            height={r * 2}
            rx={r}
            fill="#1a1a1a"
          />
        );
      })}

      {notes.map((f, i) => {
        const x = ox + cellW * i;
        if (f === 'x')
          return (
            <text
              key={i}
              x={x}
              y={oy - 11 * size}
              textAnchor="middle"
              fontSize={13 * size}
              fill="#ef4444"
              fontWeight="bold"
            >
              ×
            </text>
          );
        if (f === '0')
          return (
            <circle
              key={i}
              cx={x}
              cy={oy - 12 * size}
              r={6 * size}
              fill="none"
              stroke="#374151"
              strokeWidth={1.8}
            />
          );
        const fv = parseInt(f, 10);
        const rel = fv - start + 1;
        if (rel < 1 || rel > FRETS_SHOWN) return null;
        if (barreStringFrets.has(`${i}:${fv}`)) return null;
        return (
          <circle
            key={i}
            cx={x}
            cy={oy + cellH * (rel - 1) + cellH / 2}
            r={10 * size}
            fill="#1a1a1a"
          />
        );
      })}

      {label && (
        <text x={width / 2} y={height - 3} textAnchor="middle" fontSize={10 * size} fill="#9ca3af">
          {label}
        </text>
      )}
    </svg>
  );
}
