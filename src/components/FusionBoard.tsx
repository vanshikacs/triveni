import { useLayoutEffect, useRef, useState } from 'react';
import { CheckCircle2, FileText, GitMerge, ImageIcon, Mic, Scissors, Search, Split, XCircle } from 'lucide-react';
import type { FusionView } from '../lib/fusion';
import { placeById } from '../lib/seed';
import { useStore } from '../lib/store';
import type { Channel, Complaint, EvidenceItem, RelatedMatch } from '../lib/types';
import { Badge, Button, Dialog, ago, clock, cx, useConfirm, useToast } from './ui';

const CHANNEL: Record<Channel, { icon: typeof Mic; label: string }> = {
  voice: { icon: Mic, label: 'Voice note' },
  text: { icon: FileText, label: 'Text' },
  photo: { icon: ImageIcon, label: 'Photo + caption' },
};

const EVIDENCE_ICON: Record<EvidenceItem['kind'], string> = {
  description: 'Similar descriptions',
  proximity: 'Geographic proximity',
  time: 'Compatible time window',
  infrastructure: 'Shared infrastructure',
};

function Strength({ s }: { s: EvidenceItem['strength'] }) {
  const n = s === 'strong' ? 3 : s === 'moderate' ? 2 : 1;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${s} signal`} title={`${s} signal`}>
      {[0, 1, 2].map((i) => <span key={i} className={cx('h-2.5 w-1 rounded-[1px]', i < n ? 'bg-indigo' : 'bg-ink/10')} />)}
    </span>
  );
}

export function ComplaintDetail({ c, match, onSplit }: { c: Complaint; match: RelatedMatch | null; onSplit?: () => void }) {
  const p = placeById(c.placeId);
  const Ch = CHANNEL[c.channel];
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[12.5px] text-muted mb-1">Original ({c.language === 'hi' ? 'Hindi' : 'English'})</div>
        <p lang={c.language} className={cx('text-[16px] text-ink', c.language === 'hi' && 'hi')}>{c.text}</p>
        {c.textEn && <p className="mt-2 text-[14px] text-muted">English: {c.textEn}</p>}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13.5px] border-t hairline pt-4">
        <dt className="text-muted">Citizen</dt><dd>{c.citizen} <span className="text-faint">(fictional)</span></dd>
        <dt className="text-muted">Channel</dt><dd className="flex items-center gap-1.5"><Ch.icon className="size-3.5" aria-hidden />{Ch.label}</dd>
        <dt className="text-muted">Place</dt><dd>{p ? `${p.village}, ${p.block}, ${p.district}` : 'Not matched'}</dd>
        <dt className="text-muted">Coordinates</dt><dd className="num">{p ? `${p.lat.toFixed(3)}, ${p.lng.toFixed(3)} (approximate, simulated)` : '—'}</dd>
        <dt className="text-muted">Received</dt><dd>{clock(c.createdAt)}</dd>
        {c.splitFrom && (<><dt className="text-muted">History</dt><dd>Split out of {c.splitFrom} by an officer</dd></>)}
      </dl>
      {match && (
        <div className="rounded-[8px] bg-indigo-wash/60 p-3.5 text-[13.5px]">
          <div className="font-medium text-indigo mb-1.5">Why it may be related</div>
          <ul className="space-y-1 text-ink/85">
            <li>Similarity score {match.score.toFixed(2)} (demo heuristic: issue type, wording, distance, time)</li>
            <li>{match.distanceKm < 0.5 ? 'Same locality' : `${match.distanceKm} km from the newest report`}, {match.hoursApart} h apart</li>
            {match.sharedConcepts.length > 0 && <li>Shared terms: {match.sharedConcepts.join(', ')}</li>}
          </ul>
        </div>
      )}
      {onSplit && (
        <div className="border-t hairline pt-4">
          <Button variant="secondary" size="sm" onClick={onSplit}><Scissors className="size-3.5" aria-hidden /> Split this report into its own incident</Button>
        </div>
      )}
    </div>
  );
}

export default function FusionBoard({ view, newComplaintId }: { view: FusionView; newComplaintId?: string }) {
  const { confirmMerge, rejectMerge, splitComplaint } = useStore();
  const toast = useToast();
  const { ask, node } = useConfirm();
  const [inspect, setInspect] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [paths, setPaths] = useState<{ id: string; d: string; isNew: boolean }[]>([]);
  const inc = view.incident;
  const proposed = inc.mergeState === 'proposed';
  const confirmed = inc.mergeState === 'confirmed';
  const dept = inc.routing.department;

  useLayoutEffect(() => {
    const compute = () => {
      const wrap = wrapRef.current, n = nodeRef.current;
      if (!wrap || !n || window.innerWidth < 1024) { setPaths([]); return; }
      const wr = wrap.getBoundingClientRect(), nr = n.getBoundingClientRect();
      const tx = nr.left - wr.left, ty = nr.top - wr.top + Math.min(72, nr.height / 2);
      const out = view.members.map((m) => {
        const el = cardRefs.current[m.complaint.id];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const sx = r.right - wr.left, sy = r.top - wr.top + r.height / 2;
        const mx = sx + (tx - sx) * 0.55;
        return { id: m.complaint.id, d: `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`, isNew: m.complaint.id === newComplaintId };
      }).filter(Boolean) as { id: string; d: string; isNew: boolean }[];
      setPaths(out);
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener('resize', compute);
    return () => { ro.disconnect(); window.removeEventListener('resize', compute); };
  }, [view, newComplaintId]);

  const inspected = view.members.find((m) => m.complaint.id === inspect);
  const place = placeById(inc.placeId);

  return (
    <section aria-labelledby="fusion-h" className="panel overflow-hidden">
      <div className="px-5 sm:px-6 pt-5 pb-4 border-b hairline flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="fusion-h" className="font-display text-[19px] font-semibold flex items-center gap-2">
            <GitMerge className="size-[18px] text-indigo" aria-hidden /> Incident fusion
          </h2>
          <p className="text-[14px] text-muted mt-1">
            {view.members.length} citizen reports {proposed ? 'may describe' : confirmed ? 'describe' : 'were considered for'} one shared incident.
            {proposed && ' Nothing is merged until an officer confirms.'}
          </p>
        </div>
        <Badge tone={confirmed ? 'leaf' : proposed ? 'saffron' : 'neutral'}>
          {confirmed ? <><CheckCircle2 className="size-3.5" aria-hidden /> Merge confirmed by officer</> : proposed ? 'Proposed merge' : inc.mergeState === 'rejected' ? 'Merge rejected' : 'Single report'}
        </Badge>
      </div>

      <div ref={wrapRef} className="relative grid lg:grid-cols-12 gap-6 lg:gap-0 p-5 sm:p-6">
        <svg className="pointer-events-none absolute inset-0 size-full hidden lg:block" aria-hidden>
          {paths.map((p, i) => (
            <path key={p.id + p.d.length} d={p.d} pathLength={1} fill="none" className="thread-draw" style={{ animationDelay: `${i * 60}ms` }}
              stroke={p.isNew ? '#b8711a' : '#24306b'} strokeOpacity={p.isNew ? 0.95 : confirmed ? 0.55 : 0.35}
              strokeWidth={p.isNew ? 2 : 1.4} strokeDasharray={proposed && !p.isNew ? undefined : undefined} />
          ))}
        </svg>

        {/* Reports */}
        <div className="lg:col-span-5 space-y-2.5 relative">
          <h3 className="text-[13px] font-medium text-muted mb-1">Individual reports, all preserved</h3>
          {view.members.map(({ complaint: c, match, isAnchor }) => {
            const Ch = CHANNEL[c.channel].icon;
            const isNew = c.id === newComplaintId;
            const p = placeById(c.placeId);
            return (
              <div key={c.id} ref={(el) => { cardRefs.current[c.id] = el; }}
                className={cx('group relative rounded-[8px] border bg-surface px-3.5 py-2.5 transition-colors',
                  isNew ? 'border-saffron/60 bg-saffron-wash/40' : 'border-line hover:border-line-strong')}>
                <div className="flex items-center gap-2 text-[12.5px] text-muted">
                  <Ch className="size-3.5" aria-hidden />
                  <span className="text-ink font-medium num">{c.id}</span>
                  <span>{p?.village ?? 'Unmatched place'}</span>
                  <span className="ml-auto num">{ago(c.createdAt)}</span>
                </div>
                <p lang={c.language} className={cx('mt-1 text-[14px] text-ink/90 line-clamp-2', c.language === 'hi' && 'hi')}>{c.text}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  {isNew && <Badge tone="saffron">New report</Badge>}
                  {isAnchor && !isNew && <Badge>Newest report</Badge>}
                  {match && <span className="text-[12px] text-muted num">score {match.score.toFixed(2)}, {match.distanceKm < 0.5 ? 'same locality' : `${match.distanceKm} km`}</span>}
                  <button onClick={() => setInspect(c.id)} className="ml-auto inline-flex items-center gap-1 text-[12.5px] text-indigo hover:underline">
                    <Search className="size-3.5" aria-hidden /> Inspect
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden lg:block lg:col-span-2" aria-hidden />

        {/* Proposed incident + evidence */}
        <div className="lg:col-span-5 space-y-4 relative">
          <div ref={nodeRef} className={cx('rounded-[10px] border-2 bg-surface p-5', confirmed ? 'border-leaf/50' : 'border-indigo/40')}>
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-muted num">{inc.id}</span>
              <span className={confirmed ? 'text-leaf font-medium' : 'text-saffron font-medium'}>{confirmed ? 'Shared incident' : 'Proposed shared incident'}</span>
            </div>
            <div className="font-display text-[20px] font-semibold leading-snug mt-1">{inc.title}</div>
            <div lang="hi" className="hi text-[14px] text-muted">{inc.titleHi}</div>
            <div className="mt-4 grid grid-cols-2 gap-px bg-line rounded-[8px] overflow-hidden border hairline">
              {([
                ['Linked reports', <span className="font-display text-[22px] font-extrabold text-indigo num">{view.members.length}</span>],
                ['Affected locality', <>{place?.village}<span className="text-muted">, {view.villages.length} {view.villages.length === 1 ? 'village' : 'villages'}</span></>],
                ['First report', <span className="num">{clock(view.first)}</span>],
                ['Latest report', <span className="num">{clock(view.latest)}</span>],
              ] as [string, React.ReactNode][]).map(([k, v]) => (
                <div key={k} className="bg-surface p-3">
                  <div className="text-[12px] text-muted">{k}</div>
                  <div className="text-[14px] mt-0.5">{v}</div>
                </div>
              ))}
            </div>
            <dl className="mt-4 space-y-1.5 text-[13.5px]">
              <div className="flex gap-2"><dt className="text-muted w-36 shrink-0">Common issue</dt><dd>{inc.aiSummary}</dd></div>
              <div className="flex gap-2"><dt className="text-muted w-36 shrink-0">Geographic context</dt><dd>{place ? `${place.block} block, ${place.district} district (approximate)` : '—'}</dd></div>
              <div className="flex gap-2"><dt className="text-muted w-36 shrink-0">Suggested department</dt><dd>{dept}<span className="text-muted">, {inc.routing.desk}</span></dd></div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              {proposed && (
                <>
                  <Button variant="primary" onClick={() => ask({
                    title: `Confirm merge into ${inc.id}?`,
                    body: <p>{view.members.length} citizen reports will be handled as one incident with one owner. Every original report stays on record and can be split out later. This is a simulated officer action.</p>,
                    confirm: 'Confirm merge', tone: 'primary',
                    onConfirm: () => { confirmMerge(inc.id); toast({ tone: 'success', text: `Merge confirmed. ${view.members.length} reports now form ${inc.id}.` }); },
                  })}><GitMerge className="size-4" aria-hidden /> Confirm merge</Button>
                  <Button variant="danger" onClick={() => ask({
                    title: 'Reject the proposed merge?',
                    body: <p>The reports will stay as separate incidents, each needing its own routing. You can still link them manually later.</p>,
                    confirm: 'Reject merge', tone: 'danger',
                    onConfirm: () => { rejectMerge(inc.id); toast({ tone: 'info', text: 'Merge rejected. Reports kept as separate incidents.' }); },
                  })}><XCircle className="size-4" aria-hidden /> Reject merge</Button>
                </>
              )}
              {confirmed && view.members.length > 1 && (
                <p className="text-[13px] text-muted flex items-center gap-1.5"><Split className="size-3.5" aria-hidden /> To split a report out, use Inspect on that report.</p>
              )}
            </div>
          </div>

          <div className="rounded-[10px] border hairline bg-paper/60 p-5">
            <h3 className="font-display text-[15px] font-semibold">Why these reports may be related</h3>
            <ul className="mt-3 divide-y divide-line">
              {view.evidence.map((e) => (
                <li key={e.kind} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13.5px] font-medium">{EVIDENCE_ICON[e.kind]}</span>
                    <Strength s={e.strength} />
                  </div>
                  <p className="text-[13.5px] text-muted mt-0.5 leading-relaxed">{e.detail}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] text-faint">Signals come from the demo similarity rules. They suggest a link; they do not prove one.</p>
          </div>
        </div>
      </div>

      {view.nearMisses.length > 0 && (
        <div className="border-t hairline px-5 sm:px-6 py-4 bg-paper/40">
          <h3 className="text-[13px] font-medium text-muted">Considered but not linked</h3>
          <ul className="mt-2 grid md:grid-cols-2 gap-2">
            {view.nearMisses.map((n) => (
              <li key={n.complaintId} className="rounded-[8px] border border-dashed border-line-strong px-3.5 py-2.5 text-[13.5px]">
                <div className="flex items-center gap-2 text-[12.5px] text-muted"><span className="text-ink num">{n.complaintId}</span>{placeById(n.complaint.placeId)?.village}</div>
                <p lang={n.complaint.language} className="mt-0.5 line-clamp-1 text-ink/80">{n.complaint.text}</p>
                <p className="mt-1 text-[12.5px] text-saffron">{n.excludedReason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={!!inspected} onClose={() => setInspect(null)} wide title={inspected ? `Citizen report ${inspected.complaint.id}` : ''}>
        {inspected && (
          <ComplaintDetail c={inspected.complaint} match={inspected.match}
            onSplit={confirmed && view.members.length > 1 ? () => {
              const id = inspected.complaint.id;
              setInspect(null);
              ask({
                title: `Split ${id} out of ${inc.id}?`,
                body: <p>{id} becomes its own incident with its own routing. The report itself is unchanged.</p>,
                confirm: 'Split report', tone: 'primary',
                onConfirm: () => { splitComplaint(inc.id, id); toast({ tone: 'success', text: `${id} split into a new incident.` }); },
              });
            } : undefined} />
        )}
      </Dialog>
      {node}
    </section>
  );
}
