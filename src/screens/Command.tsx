import { useEffect, useMemo, useState } from 'react';
import { Bot, CheckCircle2, GitMerge, Search, ShieldCheck, Scissors, UserRound, X, XCircle } from 'lucide-react';
import { STATUS_LABEL, useStore } from '../lib/store';
import { CATEGORY_LABEL, DEPARTMENTS, placeById } from '../lib/seed';
import { REVIEW_THRESHOLD } from '../lib/pipeline';
import { computeFusion } from '../lib/fusion';
import { ComplaintDetail } from '../components/FusionBoard';
import LocalityPanel from '../components/LocalityPanel';
import { Badge, Button, ConfidenceMeter, Dialog, PriorityBadge, StatusBadge, ago, clock, cx, useConfirm, useToast } from '../components/ui';
import { navigate } from '../App';
import type { Incident, IncidentStatus, Priority } from '../lib/types';

type Tab = 'incidents' | 'review' | 'activity';
const STATUSES: IncidentStatus[] = ['pending_review', 'open', 'routed', 'in_progress', 'resolved'];

function IncidentDetail({ inc, onClose }: { inc: Incident; onClose: () => void }) {
  const { state, confirmMerge, rejectMerge, approveRouting, reroute, setStatus, addNote, splitComplaint } = useStore();
  const toast = useToast();
  const { ask, node } = useConfirm();
  const [note, setNote] = useState('');
  const [inspect, setInspect] = useState<string | null>(null);
  const view = useMemo(() => computeFusion(state, inc), [state, inc]);
  const place = placeById(inc.placeId);
  const activity = state.activity.filter((a) => a.incidentId === inc.id);
  const caseFor = inc.complaintIds.find((id) => state.cases.some((c) => c.complaintId === id));
  const proposed = inc.mergeState === 'proposed';
  const lowConf = inc.routing.confidence < REVIEW_THRESHOLD;
  const inspected = view?.members.find((m) => m.complaint.id === inspect);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !inspect) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, inspect]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-ink/25" onClick={onClose} aria-hidden />
      <aside role="dialog" aria-modal="true" aria-label={`Incident ${inc.id}`}
        className="fade-in relative h-full w-full sm:max-w-[640px] bg-surface border-l hairline overflow-y-auto">
        <div className="sticky top-0 z-10 bg-surface border-b hairline px-5 sm:px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[13px] text-muted"><span className="num text-ink font-medium">{inc.id}</span> updated {ago(inc.updatedAt)}</div>
              <h2 className="font-display text-[20px] font-semibold leading-snug mt-1">{inc.title}</h2>
              <p lang="hi" className="hi text-[14px] text-muted">{inc.titleHi}</p>
            </div>
            <button onClick={onClose} className="p-1.5 -m-1 text-muted hover:text-ink" aria-label="Close incident"><X className="size-5" /></button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <PriorityBadge p={inc.priority} /><StatusBadge s={inc.status} />
            <Badge>{CATEGORY_LABEL[inc.category].en}</Badge>
            <Badge>{inc.complaintIds.length} {inc.complaintIds.length === 1 ? 'report' : 'reports'}</Badge>
          </div>
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-7">
          {/* AI recommendation */}
          <section aria-labelledby="rec-h">
            <h3 id="rec-h" className="font-display text-[15px] font-semibold flex items-center gap-2"><Bot className="size-4 text-indigo" aria-hidden /> Recommendation</h3>
            <p className="mt-2 text-[14px] text-ink/85">{inc.aiSummary}</p>
            <div className="mt-3 rounded-[8px] border hairline p-4 space-y-3">
              <div className="grid grid-cols-[120px_1fr] gap-y-1.5 text-[13.5px]">
                <span className="text-muted">Department</span><span>{inc.routing.department}</span>
                <span className="text-muted">Desk</span><span>{inc.routing.desk}</span>
                <span className="text-muted">Location</span><span>{place ? `${place.village}, ${place.block}, ${place.district}` : '—'} <span className="text-faint">(approximate)</span></span>
              </div>
              <ConfidenceMeter value={inc.routing.confidence} threshold={REVIEW_THRESHOLD} />
              {inc.reviewReason && inc.humanReview && <p className="text-[13px] text-saffron">{inc.reviewReason}</p>}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {inc.routing.approved ? (
                  <span className="inline-flex items-center gap-1.5 text-[13.5px] text-leaf font-medium"><CheckCircle2 className="size-4" aria-hidden /> Routing approved (simulated)</span>
                ) : (
                  <Button variant="success" size="sm" onClick={() => ask({
                    title: 'Approve simulated routing?',
                    body: <p>Route {inc.id} to <b>{inc.routing.department}</b>, {inc.routing.desk}. In this demo nothing is sent to a real department.</p>,
                    confirm: 'Approve routing', tone: 'success',
                    onConfirm: () => { approveRouting(inc.id); toast({ tone: 'success', text: `Routing approved for ${inc.id} (simulated).` }); },
                  })}><ShieldCheck className="size-3.5" aria-hidden /> Approve routing</Button>
                )}
                <label className="sr-only" htmlFor="dept">Change department</label>
                <select id="dept" className="field !w-auto !py-1 text-[13px] h-8" value={inc.routing.department}
                  onChange={(e) => { reroute(inc.id, e.target.value); toast({ tone: 'info', text: `Department changed to ${e.target.value}. Approve the routing to apply it.` }); }}>
                  {[...new Set([...Object.values(DEPARTMENTS).map((d) => d.name), 'Rural Engineering (construction)', 'Block development office', inc.routing.department])].map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              {lowConf && !inc.routing.approved && <p className="text-[12.5px] text-muted">Low score: check the department before approving. Other candidates are in the list.</p>}
            </div>
          </section>

          {/* Merge proposal */}
          {proposed && view && (
            <section aria-labelledby="merge-h" className="rounded-[10px] border border-saffron/50 bg-saffron-wash/40 p-4">
              <h3 id="merge-h" className="font-display text-[15px] font-semibold flex items-center gap-2"><GitMerge className="size-4 text-saffron" aria-hidden /> Proposed merge: {inc.complaintIds.length} reports</h3>
              <ul className="mt-3 space-y-2">
                {view.evidence.map((e) => (
                  <li key={e.kind} className="text-[13.5px]"><span className="font-medium">{e.label}.</span> <span className="text-ink/75">{e.detail}</span></li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="primary" size="sm" onClick={() => ask({
                  title: `Approve merge into ${inc.id}?`,
                  body: <p>{inc.complaintIds.length} reports become one incident with one owner. All original reports are kept and can be split out later.</p>,
                  confirm: 'Approve merge',
                  onConfirm: () => { confirmMerge(inc.id); toast({ tone: 'success', text: `Merge approved. ${inc.complaintIds.length} reports in ${inc.id}.` }); },
                })}><GitMerge className="size-3.5" aria-hidden /> Approve merge</Button>
                <Button variant="danger" size="sm" onClick={() => ask({
                  title: 'Reject the proposed merge?',
                  body: <p>Each report stays a separate incident with its own routing.</p>, confirm: 'Reject merge', tone: 'danger',
                  onConfirm: () => { rejectMerge(inc.id); toast({ tone: 'info', text: 'Merge rejected. Reports kept separate.' }); onClose(); },
                })}><XCircle className="size-3.5" aria-hidden /> Reject merge</Button>
              </div>
            </section>
          )}
          {inc.mergeState === 'confirmed' && inc.complaintIds.length > 1 && (
            <p className="text-[13.5px] text-leaf flex items-center gap-2"><CheckCircle2 className="size-4" aria-hidden /> One consolidated incident. All {inc.complaintIds.length} citizen reports are preserved below.</p>
          )}

          {/* Complaints */}
          <section aria-labelledby="cmp-h">
            <h3 id="cmp-h" className="font-display text-[15px] font-semibold">Citizen reports</h3>
            <ul className="mt-2 divide-y divide-line border-y hairline">
              {view?.members.map(({ complaint: c }) => (
                <li key={c.id} className="py-2.5 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[12.5px] text-muted"><span className="num text-ink">{c.id}</span>{placeById(c.placeId)?.village}<span className="num">{ago(c.createdAt)}</span>{c.submittedInDemo && <Badge tone="saffron">New</Badge>}</div>
                    <p lang={c.language} className="text-[14px] text-ink/85 line-clamp-2">{c.text}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setInspect(c.id)}>Inspect</Button>
                </li>
              ))}
            </ul>
            {caseFor && <button onClick={() => navigate(`/intelligence/${caseFor}`)} className="mt-2 text-[13px] text-indigo hover:underline">Open the fusion view for this incident</button>}
          </section>

          {/* Status + notes */}
          <section aria-labelledby="act-h" className="grid sm:grid-cols-2 gap-5">
            <div>
              <h3 id="act-h" className="font-display text-[15px] font-semibold">Status</h3>
              <label htmlFor="status" className="sr-only">Incident status</label>
              <select id="status" className="field mt-2" value={inc.status} onChange={(e) => {
                setStatus(inc.id, e.target.value as IncidentStatus); toast({ tone: 'success', text: `Status set to ${STATUS_LABEL[e.target.value as IncidentStatus]}.` });
              }}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; addNote(inc.id, note.trim()); setNote(''); toast({ tone: 'success', text: 'Note added.' }); }}>
              <label htmlFor="note" className="font-display text-[15px] font-semibold block">Officer note</label>
              <textarea id="note" rows={2} className="field mt-2 text-[14px]" placeholder="For example: lineman dispatched" value={note} onChange={(e) => setNote(e.target.value)} />
              <Button type="submit" size="sm" className="mt-2" disabled={!note.trim()}>Add note</Button>
            </form>
          </section>
          {inc.notes.length > 0 && (
            <ul className="space-y-2">
              {inc.notes.map((n) => (
                <li key={n.id} className="rounded-[8px] bg-paper border hairline px-3.5 py-2.5 text-[13.5px]">
                  <div className="text-[12px] text-muted mb-0.5">Officer (simulated), {clock(n.at)}</div>{n.text}
                </li>
              ))}
            </ul>
          )}

          {/* Activity */}
          <section aria-labelledby="hist-h">
            <h3 id="hist-h" className="font-display text-[15px] font-semibold">Activity</h3>
            <ol className="mt-2 space-y-2.5">
              {activity.map((a) => (
                <li key={a.id} className="flex gap-3 text-[13.5px]">
                  {a.actor === 'pipeline' ? <Bot className="size-4 text-indigo mt-0.5 shrink-0" aria-label="Pipeline" /> : <UserRound className="size-4 text-leaf mt-0.5 shrink-0" aria-label="Officer" />}
                  <div><div className="text-ink/85">{a.text}</div><div className="text-[12px] text-faint">{a.actor === 'pipeline' ? 'TRIVENI demo pipeline' : 'Officer (simulated)'}, {clock(a.at)}</div></div>
                </li>
              ))}
              {!activity.length && <li className="text-[13.5px] text-muted">No activity yet.</li>}
            </ol>
          </section>
        </div>
      </aside>

      <Dialog open={!!inspected} onClose={() => setInspect(null)} wide title={inspected ? `Citizen report ${inspected.complaint.id}` : ''}>
        {inspected && <ComplaintDetail c={inspected.complaint} match={inspected.match}
          onSplit={inc.mergeState === 'confirmed' && inc.complaintIds.length > 1 ? () => {
            const id = inspected.complaint.id; setInspect(null);
            ask({ title: `Split ${id} out of ${inc.id}?`, body: <p>{id} becomes its own incident. The report itself is unchanged.</p>, confirm: 'Split report',
              onConfirm: () => { splitComplaint(inc.id, id); toast({ tone: 'success', text: `${id} split into a new incident.` }); } });
          } : undefined} />}
      </Dialog>
      {node}
    </div>
  );
}

export default function Command({ incidentId }: { incidentId?: string }) {
  const { state } = useStore();
  const [tab, setTab] = useState<Tab>('incidents');
  const [q, setQ] = useState('');
  const [status, setStatusF] = useState<'all' | 'active' | IncidentStatus>('all');
  const [priority, setPriority] = useState<'all' | 'high' | Priority>('all');
  const [dept, setDept] = useState('all');
  const selected = state.incidents.find((i) => i.id === incidentId);

  const k = useMemo(() => ({
    complaints: state.complaints.length,
    open: state.incidents.filter((i) => i.status !== 'resolved').length,
    review: state.incidents.filter((i) => i.humanReview && i.status !== 'resolved').length,
    high: state.incidents.filter((i) => (i.priority === 'P1' || i.priority === 'P2') && i.status !== 'resolved').length,
    resolved: state.incidents.filter((i) => i.status === 'resolved').length,
  }), [state]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return state.incidents
      .filter((i) => status === 'all' || (status === 'active' ? i.status !== 'resolved' : i.status === status))
      .filter((i) => priority === 'all' || (priority === 'high' ? (i.priority === 'P1' || i.priority === 'P2') && i.status !== 'resolved' : i.priority === priority))
      .filter((i) => dept === 'all' || i.routing.department === dept)
      .filter((i) => {
        if (!t) return true;
        const p = placeById(i.placeId);
        const texts = i.complaintIds.map((id) => state.complaints.find((c) => c.id === id)?.text ?? '').join(' ');
        return [i.id, i.title, i.titleHi, p?.village, p?.villageHi, p?.district, i.routing.department, texts].join(' ').toLowerCase().includes(t);
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [state, q, status, priority, dept]);

  const reviewQueue = state.incidents.filter((i) => i.humanReview && i.status !== 'resolved').sort((a, b) => a.priority.localeCompare(b.priority));
  const filtersOn = q || status !== 'all' || priority !== 'all' || dept !== 'all';
  const clear = () => { setQ(''); setStatusF('all'); setPriority('all'); setDept('all'); };

  const kpis: { label: string; value: number; onClick: () => void; tone?: string }[] = [
    { label: 'Citizen complaints', value: k.complaints, onClick: () => { clear(); setTab('incidents'); } },
    { label: 'Open incidents', value: k.open, onClick: () => { clear(); setStatusF('active'); setTab('incidents'); } },
    { label: 'Pending human review', value: k.review, onClick: () => setTab('review'), tone: 'text-saffron' },
    { label: 'High priority (P1–P2)', value: k.high, onClick: () => { clear(); setPriority('high'); setTab('incidents'); }, tone: 'text-alarm' },
    { label: 'Resolved', value: k.resolved, onClick: () => { clear(); setStatusF('resolved'); setTab('incidents'); }, tone: 'text-leaf' },
  ];

  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-semibold leading-tight">Command centre</h1>
          <p className="text-[14.5px] text-muted mt-1">Simulated officer view. Every action here changes this demo only.</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-px bg-line border hairline rounded-[10px] overflow-hidden">
        {kpis.map((x) => (
          <button key={x.label} onClick={x.onClick} className="bg-surface text-left px-4 py-3.5 hover:bg-paper transition-colors">
            <div className="text-[12.5px] text-muted">{x.label}</div>
            <div className={cx('font-display text-[28px] font-extrabold num leading-tight mt-0.5', x.tone ?? 'text-ink')}>{x.value}</div>
          </button>
        ))}
      </div>

      <div className="mt-7 flex items-center gap-1 border-b hairline" role="tablist" aria-label="Command centre views">
        {([['incidents', 'Incidents', rows.length], ['review', 'Review queue', reviewQueue.length], ['activity', 'Activity', state.activity.length]] as [Tab, string, number][]).map(([key, label, n]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={cx('relative px-3.5 py-2.5 text-[14px] -mb-px border-b-2', tab === key ? 'border-indigo text-ink font-medium' : 'border-transparent text-muted hover:text-ink')}>
            {label} <span className="num text-faint ml-1">{n}</span>
          </button>
        ))}
      </div>

      {tab === 'incidents' && (
        <div className="mt-5 grid 2xl:grid-cols-12 gap-6">
          <div className="2xl:col-span-9 min-w-0">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="size-4 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden />
                <label htmlFor="q" className="sr-only">Search incidents</label>
                <input id="q" className="field pl-8 h-9 !py-0" placeholder="Search ID, village, issue or complaint text (Hindi or English)" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <label className="sr-only" htmlFor="fs">Status</label>
              <select id="fs" className="field !w-auto h-9 !py-0 text-[14px]" value={status} onChange={(e) => setStatusF(e.target.value as typeof status)}>
                <option value="all">All statuses</option><option value="active">All open</option>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
              <label className="sr-only" htmlFor="fp">Priority</label>
              <select id="fp" className="field !w-auto h-9 !py-0 text-[14px]" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
                <option value="all">All priorities</option><option value="high">P1–P2 open</option>
                {(['P1', 'P2', 'P3', 'P4'] as Priority[]).map((p) => <option key={p}>{p}</option>)}
              </select>
              <label className="sr-only" htmlFor="fd">Department</label>
              <select id="fd" className="field !w-auto h-9 !py-0 text-[14px] max-w-[220px]" value={dept} onChange={(e) => setDept(e.target.value)}>
                <option value="all">All departments</option>
                {[...new Set(state.incidents.map((i) => i.routing.department))].map((d) => <option key={d}>{d}</option>)}
              </select>
              {filtersOn && <Button variant="ghost" size="sm" onClick={clear}>Clear filters</Button>}
            </div>

            <div className="mt-3 panel overflow-x-auto">
              <table className="w-full text-[14px] min-w-[960px]">
                <thead>
                  <tr className="text-left text-[12.5px] text-muted border-b hairline">
                    {['Incident', 'Issue', 'Location', 'Reports', 'Priority', 'Department', 'Status', 'Updated'].map((h) => <th key={h} scope="col" className="font-medium px-4 py-2.5">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((i) => {
                    const p = placeById(i.placeId);
                    return (
                      <tr key={i.id} tabIndex={0} onClick={() => navigate(`/command/${i.id}`)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/command/${i.id}`); } }}
                        className={cx('border-b hairline last:border-0 cursor-pointer hover:bg-paper/70 focus:bg-indigo-wash/50 outline-none', selected?.id === i.id && 'bg-indigo-wash/40')}>
                        <td className="px-4 py-3 num font-medium whitespace-nowrap">{i.id}</td>
                        <td className="px-4 py-3 max-w-[300px]">
                          <div className="leading-snug">{i.title}</div>
                          {i.mergeState === 'proposed' && <div className="mt-1"><Badge tone="saffron">Merge proposed</Badge></div>}
                        </td>
                        <td className="px-4 py-3 text-muted whitespace-nowrap">{p ? `${p.village.split(',')[0]}, ${p.district}` : '—'}</td>
                        <td className="px-4 py-3 num">{i.complaintIds.length}</td>
                        <td className="px-4 py-3"><PriorityBadge p={i.priority} /></td>
                        <td className="px-4 py-3 text-muted leading-snug max-w-[200px]">{i.routing.department}</td>
                        <td className="px-4 py-3"><StatusBadge s={i.status} /></td>
                        <td className="px-4 py-3 text-muted num whitespace-nowrap">{ago(i.updatedAt)}</td>
                      </tr>
                    );
                  })}
                  {!rows.length && (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">No incidents match these filters. <button onClick={clear} className="text-indigo hover:underline">Clear filters</button></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="2xl:col-span-3">
            <LocalityPanel incidents={state.incidents} selected={selected?.id} onSelect={(id) => navigate(`/command/${id}`)} />
          </div>
        </div>
      )}

      {tab === 'review' && (
        <div className="mt-5 grid md:grid-cols-2 gap-4">
          {reviewQueue.map((i) => (
            <div key={i.id} className="panel p-5 flex flex-col">
              <div className="flex items-center gap-2 text-[13px] text-muted"><span className="num text-ink font-medium">{i.id}</span>{placeById(i.placeId)?.village}<span className="ml-auto"><PriorityBadge p={i.priority} /></span></div>
              <div className="font-display text-[16px] font-semibold mt-1.5">{i.title}</div>
              <p className="text-[13.5px] text-saffron mt-1.5">{i.reviewReason}</p>
              <div className="mt-3"><ConfidenceMeter value={i.routing.confidence} threshold={REVIEW_THRESHOLD} /></div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[13px] text-muted">{i.complaintIds.length} {i.complaintIds.length === 1 ? 'report' : 'reports'}, {i.mergeState === 'proposed' ? 'merge proposed' : 'routing needs a decision'}</span>
                <Button size="sm" variant="primary" onClick={() => navigate(`/command/${i.id}`)}>Review</Button>
              </div>
            </div>
          ))}
          {!reviewQueue.length && (
            <div className="panel p-10 text-center md:col-span-2">
              <CheckCircle2 className="size-6 text-leaf mx-auto" aria-hidden />
              <p className="mt-2 font-medium">Review queue is clear.</p>
              <p className="text-[14px] text-muted mt-1">Submit a complaint or reset the demo to see new proposals.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <ol className="mt-5 panel divide-y divide-line">
          {state.activity.map((a) => (
            <li key={a.id} className="px-5 py-3 flex gap-3 text-[14px]">
              {a.actor === 'pipeline' ? <Bot className="size-4 text-indigo mt-1 shrink-0" aria-label="Pipeline" /> : <UserRound className="size-4 text-leaf mt-1 shrink-0" aria-label="Officer" />}
              <div className="flex-1 min-w-0">
                <div>{a.text}</div>
                <div className="text-[12.5px] text-faint mt-0.5">{a.actor === 'pipeline' ? 'TRIVENI demo pipeline' : 'Officer (simulated)'}, {clock(a.at)}</div>
              </div>
              {a.incidentId && <button onClick={() => navigate(`/command/${a.incidentId}`)} className="text-[13px] text-indigo hover:underline num shrink-0">{a.incidentId}</button>}
            </li>
          ))}
        </ol>
      )}

      {selected && <IncidentDetail inc={selected} onClose={() => navigate('/command')} />}
      {incidentId && !selected && (
        <p className="mt-4 text-[14px] text-alarm flex items-center gap-2"><Scissors className="size-4" aria-hidden />Incident {incidentId} is not in this demo dataset. It may have been reset.</p>
      )}
    </div>
  );
}
