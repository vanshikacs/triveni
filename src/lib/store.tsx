import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { analyzeComplaint, validateLlmExtraction } from './pipeline';
import { DEPARTMENTS, buildSeed, deskFor } from './seed';
import type { Activity, Analysis, Channel, Complaint, DemoState, Incident, IncidentStatus, Lang } from './types';

const KEY = 'triveni-demo-state-v1';

function load(): DemoState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as DemoState;
      if (s && s.version === 1 && Array.isArray(s.incidents)) return s;
    }
  } catch {
    /* storage unavailable: fall back to a fresh seed */
  }
  return buildSeed();
}

function save(s: DemoState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore: state lives in memory only */
  }
}

type Action =
  | { type: 'replace'; state: DemoState }
  | { type: 'mutate'; fn: (s: DemoState) => DemoState };

function reducer(state: DemoState, action: Action): DemoState {
  if (action.type === 'replace') return action.state;
  return action.fn(state);
}

const now = () => Date.now();
const actId = () => `A-${Math.random().toString(36).slice(2, 9)}`;
const log = (s: DemoState, a: Omit<Activity, 'id' | 'at'>): DemoState => ({
  ...s,
  activity: [{ ...a, id: actId(), at: now() }, ...s.activity],
});
const patchIncident = (s: DemoState, id: string, patch: Partial<Incident>): DemoState => ({
  ...s,
  incidents: s.incidents.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: now() } : i)),
});

export interface SubmitInput {
  text: string;
  language: Lang;
  locationText: string;
  channel: Channel;
  hasPhoto: boolean;
}

interface StoreApi {
  state: DemoState;
  submit: (input: SubmitInput) => Promise<{ complaintId: string; analysis: Analysis }>;
  confirmMerge: (incidentId: string) => void;
  rejectMerge: (incidentId: string) => void;
  splitComplaint: (incidentId: string, complaintId: string) => void;
  approveRouting: (incidentId: string) => void;
  reroute: (incidentId: string, department: string) => void;
  setStatus: (incidentId: string, status: IncidentStatus) => void;
  addNote: (incidentId: string, text: string) => void;
  reset: () => void;
}

const Ctx = createContext<StoreApi | null>(null);

const API_BASE = (import.meta.env.VITE_TRIVENI_API as string | undefined)?.replace(/\/$/, '');

async function llmExtract(text: string, locationText: string) {
  if (!API_BASE) return null;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, location: locationText }),
      signal: ctl.signal,
    });
    if (!r.ok) return null;
    return validateLlmExtraction(await r.json());
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => save(state), [state]);
  const mutate = useCallback((fn: (s: DemoState) => DemoState) => dispatch({ type: 'mutate', fn }), []);

  const submit = useCallback(async (input: SubmitInput) => {
    const createdAt = now();
    const complaintId = `C-${state.counter + 1}`;
    let analysis = analyzeComplaint({ text: input.text, locationText: input.locationText, createdAt, id: complaintId }, state);
    const llm = await llmExtract(input.text, input.locationText);
    if (llm) {
      // The model may refine extraction; related-report matching stays deterministic.
      analysis = { ...analysis, ...Object.fromEntries(Object.entries(llm).filter(([, v]) => v !== undefined)), engine: 'llm' };
      if (llm.issue_category) {
        analysis.department_recommendation = DEPARTMENTS[llm.issue_category].name;
        analysis.routing_desk = deskFor(llm.issue_category, analysis.location.placeId);
      }
    }
    const finalAnalysis = analysis;
    mutate((s) => {
      const related = finalAnalysis.potential_related_incidents[0];
      const incNo = 2049 + s.incidents.filter((i) => Number(i.id.slice(4)) >= 2049).length;
      const incidentId = related ? related.incidentId : `INC-${incNo}`;
      const complaint: Complaint = {
        id: complaintId, citizen: 'You (demo submission)', channel: input.channel, language: finalAnalysis.language,
        text: input.text, placeId: finalAnalysis.location.placeId ?? '', createdAt,
        category: finalAnalysis.issue_category, incidentId, hasPhoto: input.hasPhoto, submittedInDemo: true,
      };
      let next: DemoState = {
        ...s,
        counter: s.counter + 1,
        complaints: [complaint, ...s.complaints],
        cases: [{ complaintId, analysis: finalAnalysis, createdAt }, ...s.cases],
      };
      if (related) {
        const inc = next.incidents.find((i) => i.id === related.incidentId)!;
        next = patchIncident(next, inc.id, {
          complaintIds: [...inc.complaintIds, complaintId],
          mergeState: 'proposed',
          status: 'pending_review',
          humanReview: true,
          reviewReason: 'New report proposed for this incident. Officer confirmation needed.',
        });
        next = log(next, {
          actor: 'pipeline', incidentId: inc.id, complaintId,
          text: `Proposed adding ${complaintId} to ${inc.id}. ${related.matches.length} related reports found within ${Math.max(...related.matches.map((m) => m.distanceKm)).toFixed(1)} km.`,
        });
      } else {
        const incident: Incident = {
          id: incidentId, title: finalAnalysis.complaint_summary.replace(/\.$/, ''), titleHi: finalAnalysis.complaint_summary_hi,
          category: finalAnalysis.issue_category, placeId: complaint.placeId, priority: finalAnalysis.urgency,
          status: finalAnalysis.human_review_required ? 'pending_review' : 'open', mergeState: 'single',
          complaintIds: [complaintId],
          routing: { department: finalAnalysis.department_recommendation, desk: finalAnalysis.routing_desk, confidence: finalAnalysis.routing_confidence, approved: false },
          humanReview: finalAnalysis.human_review_required, reviewReason: finalAnalysis.review_reason,
          aiSummary: finalAnalysis.complaint_summary, notes: [], updatedAt: createdAt,
        };
        next = { ...next, incidents: [incident, ...next.incidents] };
        next = log(next, {
          actor: 'pipeline', incidentId, complaintId,
          text: finalAnalysis.human_review_required
            ? `Created ${incidentId}. Sent to human review: ${finalAnalysis.review_reason}`
            : `Created ${incidentId} and recommended ${finalAnalysis.department_recommendation}.`,
        });
      }
      return next;
    });
    return { complaintId, analysis: finalAnalysis };
  }, [state, mutate]);

  const confirmMerge = useCallback((id: string) => mutate((s) => {
    const inc = s.incidents.find((i) => i.id === id)!;
    let next = patchIncident(s, id, {
      mergeState: 'confirmed', humanReview: false, reviewReason: undefined,
      status: inc.status === 'pending_review' ? (inc.routing.approved ? 'routed' : 'open') : inc.status,
    });
    next = log(next, { actor: 'officer', incidentId: id, text: `Confirmed merge of ${inc.complaintIds.length} citizen reports into ${id}. All original reports kept.` });
    return next;
  }), [mutate]);

  const rejectMerge = useCallback((id: string) => mutate((s) => {
    const inc = s.incidents.find((i) => i.id === id)!;
    const [keep, ...rest] = [...inc.complaintIds].sort((a, b) => {
      const ca = s.complaints.find((c) => c.id === a)!, cb = s.complaints.find((c) => c.id === b)!;
      return ca.createdAt - cb.createdAt;
    });
    let base = 2049 + s.incidents.filter((i) => Number(i.id.slice(4)) >= 2049).length;
    const newIncidents: Incident[] = rest.map((cid) => ({
      ...inc, id: `INC-${base++}`, complaintIds: [cid], mergeState: 'single', status: 'open', humanReview: false,
      reviewReason: undefined, notes: [], routing: { ...inc.routing, approved: false }, updatedAt: now(),
    }));
    const idFor = new Map(newIncidents.map((n) => [n.complaintIds[0], n.id]));
    let next: DemoState = {
      ...s,
      complaints: s.complaints.map((c) => (idFor.has(c.id) ? { ...c, incidentId: idFor.get(c.id)! } : c)),
      incidents: [...newIncidents, ...s.incidents],
    };
    next = patchIncident(next, id, { complaintIds: [keep], mergeState: 'rejected', humanReview: false, reviewReason: undefined, status: 'open' });
    next = log(next, { actor: 'officer', incidentId: id, text: `Rejected proposed merge. ${rest.length} reports kept as separate incidents.` });
    return next;
  }), [mutate]);

  const splitComplaint = useCallback((id: string, cid: string) => mutate((s) => {
    const inc = s.incidents.find((i) => i.id === id)!;
    if (inc.complaintIds.length < 2) return s;
    const newId = `INC-${2049 + s.incidents.filter((i) => Number(i.id.slice(4)) >= 2049).length}`;
    const split: Incident = {
      ...inc, id: newId, complaintIds: [cid], mergeState: 'single', status: 'open', humanReview: false,
      reviewReason: undefined, notes: [], routing: { ...inc.routing, approved: false }, updatedAt: now(),
    };
    let next: DemoState = {
      ...s,
      complaints: s.complaints.map((c) => (c.id === cid ? { ...c, incidentId: newId, splitFrom: id } : c)),
      incidents: [split, ...s.incidents],
    };
    next = patchIncident(next, id, { complaintIds: inc.complaintIds.filter((x) => x !== cid) });
    next = log(next, { actor: 'officer', incidentId: id, complaintId: cid, text: `Split ${cid} out of ${id} into ${newId}.` });
    return next;
  }), [mutate]);

  const approveRouting = useCallback((id: string) => mutate((s) => {
    const inc = s.incidents.find((i) => i.id === id)!;
    let next = patchIncident(s, id, {
      routing: { ...inc.routing, approved: true },
      status: inc.status === 'open' || (inc.status === 'pending_review' && inc.mergeState !== 'proposed') ? 'routed' : inc.status,
      humanReview: inc.mergeState === 'proposed' ? inc.humanReview : false,
    });
    next = log(next, { actor: 'officer', incidentId: id, text: `Approved simulated routing to ${inc.routing.department}, ${inc.routing.desk}.` });
    return next;
  }), [mutate]);

  const reroute = useCallback((id: string, department: string) => mutate((s) => {
    const inc = s.incidents.find((i) => i.id === id)!;
    const cat = (Object.keys(DEPARTMENTS) as (keyof typeof DEPARTMENTS)[]).find((k) => DEPARTMENTS[k].name === department);
    let next = patchIncident(s, id, {
      routing: { ...inc.routing, department, desk: cat ? deskFor(cat, inc.placeId) : `${department} desk`, approved: false },
    });
    next = log(next, { actor: 'officer', incidentId: id, text: `Changed recommended department to ${department}.` });
    return next;
  }), [mutate]);

  const setStatus = useCallback((id: string, status: IncidentStatus) => mutate((s) => {
    let next = patchIncident(s, id, { status, humanReview: status === 'pending_review' });
    next = log(next, { actor: 'officer', incidentId: id, text: `Status changed to ${STATUS_LABEL[status]}.` });
    return next;
  }), [mutate]);

  const addNote = useCallback((id: string, text: string) => mutate((s) => {
    const inc = s.incidents.find((i) => i.id === id)!;
    let next = patchIncident(s, id, { notes: [...inc.notes, { id: `N-${Math.random().toString(36).slice(2, 8)}`, at: now(), text }] });
    next = log(next, { actor: 'officer', incidentId: id, text: 'Added an officer note.' });
    return next;
  }), [mutate]);

  const reset = useCallback(() => dispatch({ type: 'replace', state: buildSeed() }), []);

  const api = useMemo<StoreApi>(() => ({
    state, submit, confirmMerge, rejectMerge, splitComplaint, approveRouting, reroute, setStatus, addNote, reset,
  }), [state, submit, confirmMerge, rejectMerge, splitComplaint, approveRouting, reroute, setStatus, addNote, reset]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const STATUS_LABEL: Record<IncidentStatus, string> = {
  pending_review: 'Needs review',
  open: 'Open',
  routed: 'Routed',
  in_progress: 'In progress',
  resolved: 'Resolved',
};

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside provider');
  return v;
}
