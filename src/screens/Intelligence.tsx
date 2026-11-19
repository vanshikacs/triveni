import { useMemo } from 'react';
import { AlertTriangle, ShieldCheck, UserCheck } from 'lucide-react';
import { useStore } from '../lib/store';
import { CATEGORY_LABEL, placeById } from '../lib/seed';
import { REVIEW_THRESHOLD, findConcepts } from '../lib/pipeline';
import { computeFusion } from '../lib/fusion';
import FusionBoard from '../components/FusionBoard';
import { Badge, Button, ConfidenceMeter, PriorityBadge, clock, cx } from '../components/ui';
import { navigate } from '../App';

function Highlighted({ text, lang }: { text: string; lang: string }) {
  const terms = findConcepts(text).flatMap((c) => c.hits).sort((a, b) => b.length - a.length);
  if (!terms.length) return <>{text}</>;
  const esc = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = text.split(new RegExp(`(${esc.join('|')})`, 'gi'));
  return (
    <span lang={lang}>
      {parts.map((p, i) => terms.some((t) => t.toLowerCase() === p.toLowerCase())
        ? <mark key={i} className="bg-saffron-wash text-ink rounded-[3px] px-0.5">{p}</mark>
        : <span key={i}>{p}</span>)}
    </span>
  );
}

export default function Intelligence({ complaintId }: { complaintId?: string }) {
  const { state } = useStore();
  const rec = state.cases.find((c) => c.complaintId === complaintId) ?? (complaintId ? undefined : undefined);
  const complaint = rec ? state.complaints.find((c) => c.id === rec.complaintId) : undefined;
  const a = rec?.analysis;
  const incident = complaint ? state.incidents.find((i) => i.id === complaint.incidentId) : state.incidents.find((i) => i.id === 'INC-2041');
  const view = useMemo(() => (incident ? computeFusion(state, incident, complaint?.id) : null), [state, incident, complaint?.id]);

  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      {!rec && (
        <div className="panel p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-[22px] font-semibold">Case intelligence</h1>
            <p className="text-[14.5px] text-muted mt-1">
              {complaintId ? `Case ${complaintId} is not in this browser's demo data.` : 'Submit a complaint to see its structured case.'} Below is a proposed incident from the simulated dataset.
            </p>
          </div>
          <Button variant="primary" onClick={() => navigate('/report')}>Report an issue</Button>
        </div>
      )}

      {rec && a && complaint && (
        <>
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
                <span className="num text-ink font-medium">Case {complaint.id}</span>
                <span>received {clock(rec.createdAt)}</span>
                <Badge tone={a.engine === 'llm' ? 'indigo' : 'neutral'}>{a.engine === 'llm' ? 'LLM extraction, rule-based matching' : 'Demo rule pipeline (deterministic)'}</Badge>
              </div>
              <h1 className="font-display text-[24px] sm:text-[28px] font-semibold leading-snug mt-2">{a.complaint_summary}</h1>
              <p lang="hi" className="hi text-[16px] text-muted mt-1">{a.complaint_summary_hi}</p>
            </div>
            <Button onClick={() => navigate(`/command/${complaint.incidentId}`)}>Open in command centre</Button>
          </header>

          <div className="grid lg:grid-cols-12 gap-6">
            <section className="lg:col-span-7 panel" aria-labelledby="case-h">
              <h2 id="case-h" className="px-5 pt-4 pb-3 border-b hairline font-display text-[16px] font-semibold">Structured case</h2>
              <blockquote className="mx-5 mt-4 border-l-2 border-saffron/60 pl-4 text-[16px] leading-[1.8] text-ink/90">
                <Highlighted text={complaint.text} lang={complaint.language} />
              </blockquote>
              <p className="mx-5 mt-1.5 text-[12px] text-faint">Highlighted words are the terms the pipeline used.</p>
              <dl className="grid sm:grid-cols-2 gap-px bg-line border-t hairline mt-4">
                {([
                  ['Case ID', <span className="num">{complaint.id}</span>],
                  ['Detected language', a.language === 'hi' ? 'Hindi' : 'English'],
                  ['Issue category', <>{CATEGORY_LABEL[a.issue_category].en} <span lang="hi" className="text-muted">({CATEGORY_LABEL[a.issue_category].hi})</span></>],
                  ['Urgency', <div className="flex flex-col gap-1"><PriorityBadge p={a.urgency} /><span className="text-[12.5px] text-muted">{a.urgency_reasons.join(' ')}</span></div>],
                  ['Location', <>{a.location.label}<div className="text-[12.5px] text-muted">Match {a.location.matchQuality}. Approximate, simulated coordinates.</div></>],
                  ['Duration reported', a.duration_days ? `About ${a.duration_days} day${a.duration_days > 1 ? 's' : ''}` : 'Not stated'],
                  ['Recommended department', a.department_recommendation],
                  ['Routing destination', a.routing_desk],
                ] as [string, React.ReactNode][]).map(([k, v]) => (
                  <div key={k} className="bg-surface px-5 py-3">
                    <dt className="text-[12.5px] text-muted">{k}</dt>
                    <dd className="text-[14.5px] mt-0.5">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="lg:col-span-5 panel p-5" aria-labelledby="route-h">
              <h2 id="route-h" className="font-display text-[16px] font-semibold">Routing recommendation</h2>
              <div className={cx('mt-4 rounded-[8px] p-3.5 flex gap-3', a.human_review_required ? 'bg-saffron-wash' : 'bg-indigo-wash')}>
                {a.human_review_required ? <UserCheck className="size-5 text-saffron shrink-0 mt-0.5" aria-hidden /> : <ShieldCheck className="size-5 text-indigo shrink-0 mt-0.5" aria-hidden />}
                <div className="text-[14px]">
                  <div className="font-medium">{a.human_review_required ? 'Sent to human review' : 'Ready for officer approval'}</div>
                  <div className="text-ink/75 mt-0.5">
                    {a.human_review_required
                      ? a.review_reason
                      : `${a.department_recommendation}. An officer approves the routing; the system never routes on its own in this demo.`}
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="text-muted">Routing score</span>
                  <span className="text-faint">demo heuristic, not a calibrated probability</span>
                </div>
                <div className="mt-2"><ConfidenceMeter value={a.routing_confidence} threshold={REVIEW_THRESHOLD} /></div>
              </div>
              <h3 className="mt-6 text-[13.5px] font-medium">Why this recommendation</h3>
              <ul className="mt-2 space-y-2 text-[13.5px] text-ink/85">
                {a.reasoning.map((r, i) => (
                  <li key={i} className="flex gap-2.5"><span className="mt-2 size-1 rounded-full bg-indigo shrink-0" aria-hidden />{r}</li>
                ))}
              </ul>
              {a.alternatives.length > 0 && (
                <>
                  <h3 className="mt-6 text-[13.5px] font-medium">Other possible departments</h3>
                  <ul className="mt-2 space-y-1.5">
                    {a.alternatives.map((alt) => (
                      <li key={alt.department} className="flex items-center justify-between gap-3 text-[13.5px]">
                        <span>{alt.department}</span>
                        <span className="num text-muted">{alt.score.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {a.potential_related_incidents.length === 0 && (
                <p className="mt-6 text-[13.5px] text-muted flex gap-2"><AlertTriangle className="size-4 text-faint shrink-0" aria-hidden />No related reports nearby. A new incident was created.</p>
              )}
            </section>
          </div>
        </>
      )}

      {view && <FusionBoard view={view} newComplaintId={complaint?.id} />}

      {view && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-[13.5px] text-muted">
            {placeById(view.incident.placeId)?.village}: {view.members.length} reports, one {view.incident.mergeState === 'confirmed' ? 'confirmed' : 'proposed'} incident.
          </p>
          <Button variant="primary" onClick={() => navigate(`/command/${view.incident.id}`)}>Review in command centre</Button>
        </div>
      )}
    </div>
  );
}
