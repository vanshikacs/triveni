import { buildEvidence, findConcepts, matchRelated } from './pipeline';
import type { Complaint, DemoState, EvidenceItem, Incident, RelatedMatch } from './types';

export interface FusionView {
  incident: Incident;
  anchor: Complaint;
  members: { complaint: Complaint; match: RelatedMatch | null; isAnchor: boolean }[];
  evidence: EvidenceItem[];
  nearMisses: (RelatedMatch & { complaint: Complaint })[];
  first: number;
  latest: number;
  villages: string[];
}

/** Recomputes the fusion evidence for an incident from the current demo state (deterministic). */
export function computeFusion(state: DemoState, incident: Incident, anchorId?: string): FusionView | null {
  const members = incident.complaintIds.map((id) => state.complaints.find((c) => c.id === id)).filter(Boolean) as Complaint[];
  if (!members.length) return null;
  const anchor = members.find((c) => c.id === anchorId) ?? [...members].sort((a, b) => b.createdAt - a.createdAt)[0];
  const concepts = findConcepts(`${anchor.text} ${anchor.textEn ?? ''}`).map((c) => c.id);
  const { linked, nearMisses } = matchRelated(
    { category: anchor.category, placeId: anchor.placeId, createdAt: anchor.createdAt, concepts, id: anchor.id },
    state,
  );
  const rows = members
    .map((c) => ({ complaint: c, match: c.id === anchor.id ? null : linked.find((m) => m.complaintId === c.id) ?? null, isAnchor: c.id === anchor.id }))
    .sort((a, b) => (a.isAnchor ? -1 : b.isAnchor ? 1 : b.complaint.createdAt - a.complaint.createdAt));
  const matches = rows.map((r) => r.match).filter(Boolean) as RelatedMatch[];
  const evidence = buildEvidence(concepts, matches, state, anchor.placeId);
  const memberIds = new Set(incident.complaintIds);
  const near = nearMisses
    .filter((n) => !memberIds.has(n.complaintId))
    .map((n) => ({ ...n, complaint: state.complaints.find((c) => c.id === n.complaintId)! }))
    .filter((n) => n.complaint);
  const times = members.map((c) => c.createdAt);
  return {
    incident, anchor, members: rows, evidence, nearMisses: near,
    first: Math.min(...times), latest: Math.max(...times),
    villages: [...new Set(members.map((c) => c.placeId))],
  };
}
