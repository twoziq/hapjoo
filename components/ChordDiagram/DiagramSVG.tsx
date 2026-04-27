import { FRETBOARD } from '@/lib/constants';

interface Props {
  frets: string;
  label?: string;
  size?: number;
}

const { strings: STRINGS, fretsShown: FRETS_SHOWN } = FRETBOARD;

export default function DiagramSVG({ frets, label, size = 1 }: Props) {
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
  const start = hasOpen || minFret <= 1 ? 1 : minFret;
  const showNut = start === 1;

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
        const rel = parseInt(f, 10) - start + 1;
        if (rel < 1 || rel > FRETS_SHOWN) return null;
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
