export type Lang = 'hi' | 'en';
export type Category =
  | 'power'
  | 'water'
  | 'road'
  | 'sanitation'
  | 'streetlight'
  | 'anganwadi'
  | 'other';
export type Priority = 'P1' | 'P2' | 'P3' | 'P4';
export type IncidentStatus = 'pending_review' | 'open' | 'routed' | 'in_progress' | 'resolved';
export type MergeState = 'proposed' | 'confirmed' | 'rejected' | 'single';
export type Channel = 'voice' | 'text' | 'photo';

export interface Place {
  id: string;
  village: string;
  villageHi: string;
  block: string;
  district: string;
  lat: number;
  lng: number;
}

export interface Complaint {
  id: string;
  citizen: string; // fictional
  channel: Channel;
  language: Lang;
  text: string;
  textEn?: string;
  placeId: string;
  createdAt: number; // epoch ms
  category: Category;
  incidentId: string | null;
  /** set when a complaint was split out of an incident by an officer */
  splitFrom?: string;
  hasPhoto?: boolean;
  submittedInDemo?: boolean;
}

export interface Routing {
  department: string;
  desk: string;
  confidence: number; // demo heuristic score, 0–1
  approved: boolean;
}

export interface OfficerNote {
  id: string;
  at: number;
  text: string;
}

export interface Incident {
  id: string;
  title: string;
  titleHi: string;
  category: Category;
  placeId: string;
  priority: Priority;
  status: IncidentStatus;
  mergeState: MergeState;
  complaintIds: string[];
  routing: Routing;
  humanReview: boolean;
  reviewReason?: string;
  aiSummary: string;
  notes: OfficerNote[];
  updatedAt: number;
}

export interface Activity {
  id: string;
  at: number;
  actor: 'pipeline' | 'officer';
  incidentId?: string;
  complaintId?: string;
  text: string;
}

export interface EvidenceItem {
  kind: 'description' | 'proximity' | 'time' | 'infrastructure';
  label: string;
  detail: string;
  strength: 'strong' | 'moderate' | 'weak';
}

export interface RelatedMatch {
  complaintId: string;
  score: number; // 0–1 demo similarity
  distanceKm: number;
  hoursApart: number;
  sharedConcepts: string[];
  linked: boolean;
  excludedReason?: string;
}

export interface Analysis {
  engine: 'demo-rules' | 'llm';
  complaint_summary: string;
  complaint_summary_hi: string;
  language: Lang;
  issue_category: Category;
  urgency: Priority;
  urgency_reasons: string[];
  location: {
    placeId: string | null;
    label: string;
    matchQuality: number;
    approximate: true;
  };
  department_recommendation: string;
  routing_desk: string;
  reasoning: string[];
  routing_confidence: number;
  alternatives: { category: Category; department: string; score: number }[];
  potential_related_incidents: { incidentId: string; matches: RelatedMatch[]; evidence: EvidenceItem[] }[];
  near_misses: RelatedMatch[];
  human_review_required: boolean;
  review_reason?: string;
  duration_days?: number;
  concepts: string[];
}

export interface CaseRecord {
  complaintId: string;
  analysis: Analysis;
  createdAt: number;
}

export interface DemoState {
  version: number;
  seededAt: number;
  complaints: Complaint[];
  incidents: Incident[];
  activity: Activity[];
  cases: CaseRecord[];
  counter: number;
}
