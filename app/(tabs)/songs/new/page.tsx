'use client';

import { useState, useRef, useId } from 'react';
import { useRouter } from 'next/navigation';
import { dbInsertSong, supabaseConfigured } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Measure  { chord: string; lyric: string; }
interface Row      { id: string; measures: Measure[]; }
interface Section  { id: string; name: string; rows: Row[]; }

const KEYS = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const TIME_SIGS = ['4/4', '3/4', '6/8'];

// ── Helpers ───────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 8);
const emptyMeasure = (): Measure => ({ chord: '', lyric: '' });
const emptyRow = (): Row => ({ id: uid(), measures: [emptyMeasure(), emptyMeasure(), emptyMeasure(), emptyMeasure()] });
const emptySection = (name = ''): Section => ({ id: uid(), name, rows: [emptyRow()] });

function generateContent(title: string, artist: string, key: string, capo: number, bpm: number, sections: Section[]): string {
  const front = `---\ntitle: ${title}\nartist: ${artist}\nkey: ${key}\ncapo: ${capo}\nbpm: ${bpm}\n---\n`;
  const body = sections.map(sec => {
    const header = `[${sec.name || '구간'}]`;
    const rows = sec.rows.map(row => {
      const parts = row.measures.map(m => m.chord ? `${m.chord} ${m.lyric}`.trim() : m.lyric);
      return parts.join(' / ') + ' //';
    });
    return [header, ...rows].join('\n');
  }).join('\n\n');
  return front + '\n' + body + '\n';
}

function slugify(text: string): string {
  return text.trim().toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w가-힣]/g, '')
    .slice(0, 40)
    || `song_${uid()}`;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function NewSongPage() {
  const router = useRouter();

  const [title,   setTitle]   = useState('');
  const [artist,  setArtist]  = useState('');
  const [key,     setKey]     = useState('G');
  const [capo,    setCapo]    = useState(0);
  const [bpm,     setBpm]     = useState(80);
  const [sections, setSections] = useState<Section[]>([emptySection('Verse')]);
  const [showPreview, setShowPreview] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [result,  setResult]  = useState<{ ok: boolean; msg: string } | null>(null);

  // ── Section / row operations ─────────────────────────────────────────────────
  function updateSection(si: number, patch: Partial<Section>) {
    setSections(prev => prev.map((s, i) => i === si ? { ...s, ...patch } : s));
  }
  function addSection() { setSections(prev => [...prev, emptySection()]); }
  function removeSection(si: number) { setSections(prev => prev.filter((_, i) => i !== si)); }
  function addRow(si: number) {
    setSections(prev => prev.map((s, i) => i === si ? { ...s, rows: [...s.rows, emptyRow()] } : s));
  }
  function removeRow(si: number, ri: number) {
    setSections(prev => prev.map((s, i) => {
      if (i !== si) return s;
      const rows = s.rows.filter((_, j) => j !== ri);
      return { ...s, rows: rows.length ? rows : [emptyRow()] };
    }));
  }
  function updateMeasure(si: number, ri: number, mi: number, patch: Partial<Measure>) {
    setSections(prev => prev.map((s, i) => {
      if (i !== si) return s;
      const rows = s.rows.map((r, j) => {
        if (j !== ri) return r;
        const measures = r.measures.map((m, k) => k === mi ? { ...m, ...patch } : m);
        return { ...r, measures };
      });
      return { ...s, rows };
    }));
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function save() {
    if (!title.trim()) { setResult({ ok: false, msg: '제목을 입력해주세요.' }); return; }
    setSaving(true); setResult(null);
    const content = generateContent(title, artist, key, capo, bpm, sections);
    const id = slugify(title);

    if (supabaseConfigured) {
      const err = await dbInsertSong({ id, title, artist, key, capo, bpm, content });
      if (err) {
        setResult({ ok: false, msg: `저장 실패: ${err}` });
      } else {
        setResult({ ok: true, msg: '저장 완료!' });
        setTimeout(() => router.push('/songs'), 800);
      }
    } else {
      // Supabase 미설정: 생성된 텍스트를 클립보드로
      try {
        await navigator.clipboard.writeText(content);
        setResult({ ok: true, msg: '악보 텍스트가 클립보드에 복사됐습니다. data/songs/ 폴더에 .ts 파일로 붙여넣어 추가하세요.' });
      } catch {
        setResult({ ok: false, msg: '클립보드 복사 실패. 미리보기에서 직접 복사해주세요.' });
        setShowPreview(true);
      }
    }
    setSaving(false);
  }

  const content = generateContent(title, artist, key, capo, bpm, sections);

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 text-lg px-1">←</button>
          <h1 className="flex-1 text-base font-bold">새 악보 작성</h1>
          <button
            onClick={() => setShowPreview(p => !p)}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold ${showPreview ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-400'}`}
          >미리보기</button>
          <button
            onClick={save}
            disabled={saving}
            className="text-xs px-4 py-1.5 rounded-full font-bold bg-indigo-600 text-white disabled:opacity-50"
          >{saving ? '저장 중…' : '저장'}</button>
        </div>
        {result && (
          <div className={`text-center text-xs py-1.5 px-4 ${result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {result.msg}
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-5">

        {/* Meta */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 flex flex-col gap-3">
          <MetaField label="제목" value={title} onChange={setTitle} placeholder="곡 제목" />
          <MetaField label="아티스트" value={artist} onChange={setArtist} placeholder="아티스트명" />
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">키</label>
              <select value={key} onChange={e => setKey(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-indigo-600 outline-none focus:border-indigo-400 bg-white">
                {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">카포</label>
              <input type="number" min={0} max={7} value={capo} onChange={e => setCapo(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-indigo-400" />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">BPM</label>
              <input type="number" min={20} max={300} value={bpm} onChange={e => setBpm(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-indigo-400" />
            </div>
          </div>
        </div>

        {/* Supabase 미설정 안내 */}
        {!supabaseConfigured && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 leading-relaxed">
            <strong>Supabase 미연결:</strong> 저장 시 악보 텍스트를 클립보드에 복사합니다.<br />
            연결하려면 <code>.env.local</code>에 SUPABASE_URL / ANON_KEY를 설정하세요.
          </div>
        )}

        {/* Sections */}
        {sections.map((sec, si) => (
          <SectionEditor
            key={sec.id}
            section={sec}
            sectionIdx={si}
            sectionCount={sections.length}
            onNameChange={name => updateSection(si, { name })}
            onRemoveSection={() => removeSection(si)}
            onAddRow={() => addRow(si)}
            onRemoveRow={ri => removeRow(si, ri)}
            onMeasureChange={(ri, mi, patch) => updateMeasure(si, ri, mi, patch)}
          />
        ))}

        <button onClick={addSection}
          className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 font-semibold hover:border-indigo-300 hover:text-indigo-500 transition-colors">
          + 구간 추가
        </button>

        {/* Preview */}
        {showPreview && (
          <div className="bg-gray-900 rounded-2xl p-4">
            <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider">생성된 악보 텍스트</p>
            <pre className="text-[11px] text-green-300 font-mono leading-relaxed whitespace-pre-wrap break-all">{content}</pre>
          </div>
        )}

        <div className="h-10" />
      </div>
    </div>
  );
}

// ── MetaField ─────────────────────────────────────────────────────────────────
function MetaField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-400" />
    </div>
  );
}

// ── SectionEditor ─────────────────────────────────────────────────────────────
function SectionEditor({ section, sectionIdx, sectionCount, onNameChange, onRemoveSection, onAddRow, onRemoveRow, onMeasureChange }: {
  section: Section;
  sectionIdx: number;
  sectionCount: number;
  onNameChange: (name: string) => void;
  onRemoveSection: () => void;
  onAddRow: () => void;
  onRemoveRow: (ri: number) => void;
  onMeasureChange: (ri: number, mi: number, patch: Partial<Measure>) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
        <span className="text-[10px] text-gray-400 font-semibold uppercase">[</span>
        <input
          value={section.name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="구간 이름 (예: Chorus, Verse)"
          className="flex-1 text-sm font-bold text-indigo-600 bg-transparent outline-none placeholder:text-gray-300"
        />
        <span className="text-[10px] text-gray-400 font-semibold uppercase">]</span>
        {sectionCount > 1 && (
          <button onClick={onRemoveSection} className="text-xs text-red-400 hover:text-red-600 ml-1 px-1">✕</button>
        )}
      </div>

      {/* Rows */}
      <div className="flex flex-col divide-y divide-gray-100">
        {section.rows.map((row, ri) => (
          <RowEditor
            key={row.id}
            row={row}
            rowIdx={ri}
            sectionIdx={sectionIdx}
            totalRows={section.rows.length}
            onRemove={() => onRemoveRow(ri)}
            onChange={(mi, patch) => onMeasureChange(ri, mi, patch)}
          />
        ))}
      </div>

      <button onClick={onAddRow}
        className="w-full py-2 text-xs text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors font-semibold">
        + 줄 추가
      </button>
    </div>
  );
}

// ── RowEditor ─────────────────────────────────────────────────────────────────
// Tab order: chord0 → chord1 → chord2 → chord3 → lyric0 → lyric1 → lyric2 → lyric3
// Achieved by DOM order: all chords first, then all lyrics; CSS grid places them visually
function RowEditor({ row, rowIdx, sectionIdx, totalRows, onRemove, onChange }: {
  row: Row;
  rowIdx: number;
  sectionIdx: number;
  totalRows: number;
  onRemove: () => void;
  onChange: (mi: number, patch: Partial<Measure>) => void;
}) {
  return (
    <div className="relative group px-3 py-2">
      {/* 4-column grid: row1 = chords, row2 = lyrics. DOM order: all chords then all lyrics */}
      <div
        className="grid gap-px"
        style={{ gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'auto auto' }}
      >
        {/* Chord inputs — all 4, placed in row 1 */}
        {row.measures.map((m, mi) => (
          <input
            key={`c_${mi}`}
            type="text"
            value={m.chord}
            onChange={e => onChange(mi, { chord: e.target.value.toUpperCase() })}
            placeholder={['G', 'D', 'Em', 'Am'][mi]}
            style={{ gridColumn: mi + 1, gridRow: 1 }}
            className="bg-indigo-50 text-indigo-700 font-bold text-sm text-center rounded-t px-1 py-1.5 outline-none focus:bg-indigo-100 placeholder:text-indigo-200 placeholder:font-normal w-full"
          />
        ))}
        {/* Lyric inputs — all 4, placed in row 2 */}
        {row.measures.map((m, mi) => (
          <input
            key={`l_${mi}`}
            type="text"
            value={m.lyric}
            onChange={e => onChange(mi, { lyric: e.target.value })}
            placeholder="가사"
            style={{ gridColumn: mi + 1, gridRow: 2 }}
            className="bg-white text-gray-800 text-sm text-center border-t border-gray-100 rounded-b px-1 py-1.5 outline-none focus:bg-gray-50 placeholder:text-gray-200 w-full"
          />
        ))}
      </div>

      {/* Row remove button */}
      {totalRows > 1 && (
        <button
          onClick={onRemove}
          className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center text-[10px] text-gray-300 hover:text-red-400"
        >✕</button>
      )}
    </div>
  );
}
