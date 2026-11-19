import { useLayoutEffect, useRef, useState } from 'react';
import { FileText, ImageIcon, Mic } from 'lucide-react';
import { useStore } from '../lib/store';
import { placeById } from '../lib/seed';
import { Button } from '../components/ui';
import { navigate } from '../App';
import type { Channel } from '../lib/types';

const CHANNEL_ICON: Record<Channel, typeof Mic> = { voice: Mic, text: FileText, photo: ImageIcon };

function ConfluenceHero() {
  const { state } = useStore();
  const inc = state.incidents.find((i) => i.id === 'INC-2041');
  const linked = (inc?.complaintIds ?? []).map((id) => state.complaints.find((c) => c.id === id)!).filter(Boolean).slice(0, 9);
  const decoy = state.complaints.find((c) => c.id === 'C-1109');
  const rows = [...linked, ...(decoy ? [decoy] : [])];
  const n = rows.length;
  const top = 6, bottom = 94;
  const y = (i: number) => top + ((bottom - top) * i) / Math.max(1, n - 1);
  const cy = 50;
  const confirmed = inc?.mergeState === 'confirmed';

  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const px = (xPct: number) => (xPct / 100) * size.w;
  const py = (yPct: number) => (yPct / 100) * size.h;

  return (
    <div ref={wrap} className="relative h-[440px] sm:h-[460px]" aria-label="Diagram: separate citizen reports converging into one proposed incident">
      {size.w > 0 && (
        <svg className="absolute inset-0" width={size.w} height={size.h} aria-hidden>
          {rows.map((c, i) => {
            const isDecoy = c.id === 'C-1109';
            const x0 = px(47), y0 = py(y(i)), x1 = px(71), y1 = py(cy);
            const mx = x0 + (x1 - x0) * 0.55;
            const d = isDecoy ? `M ${x0} ${y0} L ${px(60)} ${y0}` : `M ${x0} ${y0} C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`;
            return (
              <path key={c.id + size.w} d={d} pathLength={isDecoy ? undefined : 1} fill="none"
                stroke={isDecoy ? '#cfc8b8' : '#24306b'} strokeOpacity={isDecoy ? 1 : 0.5} strokeWidth={isDecoy ? 1.2 : 1.4}
                strokeDasharray={isDecoy ? '3 4' : undefined}
                className={isDecoy ? undefined : 'thread-draw'} style={{ animationDelay: `${i * 70}ms` }} />
            );
          })}
        </svg>
      )}

      {rows.map((c, i) => {
        const Icon = CHANNEL_ICON[c.channel];
        const isDecoy = c.id === 'C-1109';
        const p = placeById(c.placeId);
        return (
          <div key={c.id} className="absolute left-0 w-[47%] -translate-y-1/2" style={{ top: `${y(i)}%` }}>
            <div className={`flex items-center gap-2 rounded-[6px] border px-2.5 py-1.5 bg-surface ${isDecoy ? 'border-dashed border-line-strong opacity-70' : 'border-line'}`}>
              <Icon className="size-3.5 shrink-0 text-muted" aria-hidden />
              <span lang={c.language} className="truncate text-[12.5px] text-ink/85">{c.text}</span>
              <span className="ml-auto shrink-0 text-[11px] text-faint hidden sm:inline">{p?.village.split(' ')[0]}</span>
            </div>
          </div>
        );
      })}
      <div className="absolute right-[3%] top-1/2 translate-y-[54%] w-[46%] text-right text-[11.5px] text-faint hidden sm:block" style={{ top: `${y(n - 1)}%` }}>
        Same village, different issue. Not linked.
      </div>

      <div className="absolute left-[71%] right-0 top-1/2 -translate-y-1/2">
        <div className="relative rounded-[10px] border border-indigo/30 bg-surface p-3.5 shadow-[0_10px_30px_-18px_rgba(36,48,107,.6)]">
          <span className="absolute -left-[5px] top-1/2 -translate-y-1/2 size-2.5 rounded-full bg-saffron ring-4 ring-paper" aria-hidden />
          <div className="text-[11.5px] text-muted num">{inc?.id}</div>
          <div className="font-display text-[14px] font-semibold leading-snug mt-0.5">Transformer failure</div>
          <div className="text-[12.5px] text-muted leading-snug">{placeById(inc?.placeId)?.village}</div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="font-display text-[26px] font-extrabold text-indigo num leading-none">{inc?.complaintIds.length ?? 0}</span>
            <span className="text-[12.5px] text-muted">citizen reports</span>
          </div>
          <div className={`mt-2 text-[12px] font-medium ${confirmed ? 'text-leaf' : 'text-saffron'}`}>
            {confirmed ? 'Merge confirmed by officer' : 'Proposed, awaiting officer'}
          </div>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  { t: 'Understand', d: 'Reads Hindi or English text, a voice note or a photo caption, and extracts the issue.' },
  { t: 'Locate', d: 'Matches the place to a village or ward, and says how sure the match is.' },
  { t: 'Route with care', d: 'Recommends a department, and sends uncertain cases to a person instead of guessing.' },
  { t: 'Fuse', d: 'Proposes linking reports that describe the same fault. An officer confirms or rejects it.' },
];

export default function Entry() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
      <section className="grid lg:grid-cols-12 gap-10 lg:gap-12 pt-10 sm:pt-16 pb-12">
        <div className="lg:col-span-5 flex flex-col justify-center">
          <p className="text-[13px] text-muted">Universal intake, triage and routing for citizen complaints in Uttar Pradesh</p>
          <h1 className="font-display font-semibold text-[32px] sm:text-[38px] leading-[1.18] tracking-[-0.01em] mt-4 text-ink [text-wrap:balance]">
            Every voice matters. Every incident finds its way.
          </h1>
          <p className="mt-5 text-[16.5px] leading-relaxed text-ink/80 max-w-[34rem]">
            When forty people report the same broken transformer, a department should see one incident, not forty tickets.
            TRIVENI reads each complaint, works out what it is, where it is and who should act, and proposes linking reports
            that describe the same fault. An officer always makes the final call.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button variant="primary" size="lg" onClick={() => navigate('/report')}>Report an issue</Button>
            <Button size="lg" onClick={() => navigate('/command')}>Open command centre</Button>
          </div>
          <p className="mt-4 text-[13px] text-faint">Runs on simulated data in this browser. Nothing here reaches a real department.</p>
        </div>
        <div className="lg:col-span-7">
          <div className="panel p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[13px] font-medium text-ink">Reports from three neighbouring villages, last 30 hours</h2>
              <span className="text-[12px] text-faint">Simulated</span>
            </div>
            <ConfluenceHero />
          </div>
        </div>
      </section>

      <section className="border-t hairline py-10" aria-label="How TRIVENI works">
        <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line rounded-[10px] overflow-hidden border hairline">
          {STEPS.map((s, i) => (
            <li key={s.t} className="bg-surface p-5">
              <div className="flex items-baseline gap-2.5">
                <span className="font-display text-[13px] font-extrabold text-saffron num">{i + 1}</span>
                <h3 className="font-display text-[15px] font-semibold">{s.t}</h3>
              </div>
              <p className="mt-2 text-[14px] text-muted leading-relaxed">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
