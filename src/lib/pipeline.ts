/**
 * TRIVENI demo intelligence pipeline (deterministic).
 *
 * This is NOT a trained model. It is a transparent, rule-based demonstration pipeline:
 * keyword concepts (Hindi + English), simple urgency rules, a small fictional gazetteer,
 * and a weighted similarity score for related reports. It exists so the prototype works
 * offline and repeatably. If the optional LLM backend is configured, its extraction replaces
 * the rule-based extraction, but related-report matching always stays deterministic, so the
 * model can never invent links between complaints.
 */
import { CATEGORY_LABEL, DEPARTMENTS, PLACES, deskFor, placeById } from './seed';
import type {
  Analysis, Category, Complaint, DemoState, EvidenceItem, Lang, Priority, RelatedMatch,
} from './types';

export const REVIEW_THRESHOLD = 0.75; // demo setting, not a validated operating point

interface Concept {
  id: string;
  label: string;
  terms: string[];
  category?: Category;
  weight?: number;
  signature?: boolean; // used for description similarity
}

const CONCEPTS: Concept[] = [
  { id: 'transformer', label: 'transformer', terms: ['ट्रांसफॉर्मर', 'ट्रांसफार्मर', 'transformer'], category: 'power', weight: 2, signature: true },
  { id: 'outage', label: 'power outage', terms: ['बिजली नहीं', 'बिजली चली', 'बिजली बंद', 'बिजली पूरी तरह बंद', 'बिजली गुल', 'लाइट नहीं', 'no electricity', 'no power', 'power cut', 'outage', 'power interruption', 'power went', 'without power', 'कभी आती है कभी जाती'], category: 'power', weight: 2, signature: true },
  { id: 'electricity', label: 'electricity', terms: ['बिजली', 'electricity', 'electrical', 'power'], category: 'power', weight: 1 },
  { id: 'smoke', label: 'smoke', terms: ['धुआं', 'धुंआ', 'smoke', 'smoking'], category: 'power', weight: 0.5, signature: true },
  { id: 'burning', label: 'burning / burnt', terms: ['जलने', 'जल गया', 'जला', 'burning', 'burnt', 'burned'], category: 'power', weight: 0.5, signature: true },
  { id: 'sparks', label: 'sparks', terms: ['चिंगारी', 'spark'], category: 'power', weight: 0.5, signature: true },
  { id: 'pole', label: 'electricity pole', terms: ['खंभा', 'खंभे', 'pole'], category: 'power', weight: 0.5, signature: true },
  { id: 'oil', label: 'oil leak', terms: ['तेल', 'oil'], category: 'power', weight: 0.5, signature: true },
  { id: 'equipment', label: 'damaged equipment', terms: ['खराब', 'damaged', 'damage', 'equipment'], signature: true },
  { id: 'water', label: 'water supply', terms: ['पानी', 'नल', 'water', 'tap', 'पाइपलाइन', 'pipeline', 'हैंडपंप', 'handpump', 'tanker'], category: 'water', weight: 2, signature: true },
  { id: 'road', label: 'road damage', terms: ['सड़क', 'गड्ढा', 'धंस', 'road', 'pothole', 'cave-in', 'caved'], category: 'road', weight: 2, signature: true },
  { id: 'garbage', label: 'garbage', terms: ['कूड़ा', 'कूड़ाघर', 'कचरा', 'garbage', 'waste', 'नाली', 'drain', 'sewage'], category: 'sanitation', weight: 2, signature: true },
  { id: 'streetlight', label: 'streetlight', terms: ['स्ट्रीट लाइट', 'streetlight', 'street light'], category: 'streetlight', weight: 3, signature: true },
  { id: 'anganwadi', label: 'anganwadi', terms: ['आंगनबाड़ी', 'anganwadi'], category: 'anganwadi', weight: 2, signature: true },
  { id: 'construction', label: 'incomplete construction', terms: ['अधूरा', 'incomplete', 'निर्माण', 'construction', 'भवन', 'building'], signature: true },
  { id: 'panchayat', label: 'panchayat bhawan', terms: ['पंचायत', 'panchayat'] },
  { id: 'school', label: 'school', terms: ['स्कूल', 'school'] },
  { id: 'multi', label: 'many households', terms: ['कई घरों', 'कई घर', 'पूरा गांव', 'गांव में', 'several households', 'whole village', 'many houses', 'lane', 'गली', 'ward'] },
  { id: 'hazard', label: 'fire / electrical hazard', terms: ['धुआं', 'धुंआ', 'smoke', 'चिंगारी', 'spark', 'आग', 'fire', 'करंट', 'shock', 'जलने', 'burning'] },
  { id: 'vulnerable', label: 'vulnerable people', terms: ['बच्चे', 'बच्चों', 'children', 'बुजुर्ग', 'elderly', 'women', 'महिलाएं'] },
];

const lower = (s: string) => s.toLowerCase();

export function detectLanguage(text: string): Lang {
  const dev = (text.match(/[ऀ-ॿ]/g) || []).length;
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  return dev >= latin ? 'hi' : 'en';
}

export function findConcepts(text: string): { id: string; label: string; hits: string[] }[] {
  const t = lower(text);
  const out: { id: string; label: string; hits: string[] }[] = [];
  for (const c of CONCEPTS) {
    const hits = c.terms.filter((term) => t.includes(lower(term)));
    if (hits.length) out.push({ id: c.id, label: c.label, hits });
  }
  return out;
}

const complaintText = (c: Complaint) => `${c.text} ${c.textEn ?? ''}`;

function scoreCategories(conceptIds: string[]): Record<Category, number> {
  const s: Record<Category, number> = { power: 0, water: 0, road: 0, sanitation: 0, streetlight: 0, anganwadi: 0, other: 0 };
  for (const c of CONCEPTS) {
    if (c.category && conceptIds.includes(c.id)) s[c.category] += c.weight ?? 1;
  }
  // A streetlight complaint also mentions "light"/electricity; let the specific signal win.
  if (s.streetlight > 0) s.power = Math.max(0, s.power - 1);
  return s;
}

function extractDuration(text: string): number | undefined {
  const t = lower(text);
  const words: Record<string, number> = { 'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, one: 1, two: 2, three: 3, four: 4, five: 5 };
  const hi = t.match(/(\d+|एक|दो|तीन|चार|पांच)\s*दिन/);
  if (hi) return Number(hi[1]) || words[hi[1]];
  const en = t.match(/(\d+|one|two|three|four|five)\s*days?/);
  if (en) return Number(en[1]) || words[en[1]];
  if (/हफ्ते|week/.test(t)) return 7;
  if (/कल से|since yesterday|since last night|कल शाम/.test(t)) return 1;
  return undefined;
}

function similarity(a: string, b: string): number {
  // normalised Levenshtein ratio
  const m = a.length, n = b.length;
  if (!m || !n) return 0;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n);
}

export function resolveLocation(locationText: string, text: string) {
  const hay = lower(`${locationText} ${text}`);
  let best: { placeId: string; quality: number } | null = null;
  for (const p of PLACES) {
    const names = [p.village, p.villageHi].map(lower);
    let q = 0;
    if (names.some((n) => hay.includes(n))) q = 0.92;
    else {
      // fuzzy match against each token window of the location field
      const tokens = lower(locationText).split(/[,\s]+/).filter(Boolean);
      for (let i = 0; i < tokens.length; i++) {
        const window = tokens.slice(i, i + 2).join(' ');
        q = Math.max(q, ...names.map((n) => similarity(window, n) * 0.85));
      }
    }
    if (q > 0.68 && (!best || q > best.quality)) best = { placeId: p.id, quality: q };
  }
  if (best) {
    const p = placeById(best.placeId)!;
    return { placeId: p.id, label: `${p.village}, ${p.block}, ${p.district}`, matchQuality: Number(best.quality.toFixed(2)), approximate: true as const };
  }
  const district = PLACES.find((p) => hay.includes(lower(p.district)));
  return {
    placeId: null,
    label: district ? `${district.district} district (village not matched)` : locationText || 'Not stated',
    matchQuality: district ? 0.4 : 0,
    approximate: true as const,
  };
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const SIGNATURE = new Set(CONCEPTS.filter((c) => c.signature).map((c) => c.id));
const sig = (ids: string[]) => ids.filter((i) => SIGNATURE.has(i));

export function matchRelated(
  target: { category: Category; placeId: string | null; createdAt: number; concepts: string[]; id?: string },
  state: Pick<DemoState, 'complaints'>,
): { linked: RelatedMatch[]; nearMisses: RelatedMatch[] } {
  const place = placeById(target.placeId);
  const linked: RelatedMatch[] = [];
  const near: RelatedMatch[] = [];
  const tSig = sig(target.concepts);
  for (const c of state.complaints) {
    if (c.id === target.id) continue;
    const p = placeById(c.placeId);
    if (!p || !place) continue;
    const d = haversineKm(place.lat, place.lng, p.lat, p.lng);
    const hrs = Math.abs(target.createdAt - c.createdAt) / 3600_000;
    const cSig = sig(findConcepts(complaintText(c)).map((x) => x.id));
    const shared = tSig.filter((x) => cSig.includes(x));
    const union = new Set([...tSig, ...cSig]).size || 1;
    const jac = shared.length / union;
    const cat = c.category === target.category ? 1 : 0;
    const geo = Math.max(0, 1 - d / 5);
    const time = Math.max(0, 1 - hrs / 72);
    const score = 0.4 * cat + 0.25 * jac + 0.2 * geo + 0.15 * time;
    const labels = shared.map((id) => CONCEPTS.find((k) => k.id === id)!.label);
    const m: RelatedMatch = {
      complaintId: c.id, score: Number(score.toFixed(2)), distanceKm: Number(d.toFixed(1)),
      hoursApart: Math.round(hrs), sharedConcepts: labels, linked: false,
    };
    if (cat && d <= 3 && hrs <= 72 && score >= 0.55) linked.push({ ...m, linked: true });
    else if (cat && d > 3) near.push({ ...m, excludedReason: `Same issue type, but about ${Math.round(d)} km away` });
    else if (cat && hrs > 72) near.push({ ...m, excludedReason: `Same issue type, but ${Math.round(hrs / 24)} days apart` });
    else if (!cat && d <= 1.5) near.push({ ...m, excludedReason: `Same locality, different issue (${CATEGORY_LABEL[c.category].en.toLowerCase()})` });
  }
  linked.sort((a, b) => b.score - a.score);
  near.sort((a, b) => a.distanceKm - b.distanceKm);
  return { linked, nearMisses: near.slice(0, 3) };
}

export function buildEvidence(targetConcepts: string[], matches: RelatedMatch[], state: Pick<DemoState, 'complaints'>, anchorPlaceId: string | null): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  const members = matches.map((m) => state.complaints.find((c) => c.id === m.complaintId)!).filter(Boolean);
  if (!members.length) return items;
  const conceptCount = new Map<string, number>();
  members.forEach((c) => sig(findConcepts(complaintText(c)).map((x) => x.id)).forEach((id) => conceptCount.set(id, (conceptCount.get(id) || 0) + 1)));
  const top = [...conceptCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([id, n]) => `${CONCEPTS.find((k) => k.id === id)!.label} (${n} of ${members.length})`);
  const sharedWithNew = sig(targetConcepts).filter((id) => conceptCount.has(id)).map((id) => CONCEPTS.find((k) => k.id === id)!.label);
  items.push({
    kind: 'description', label: 'Similar descriptions',
    detail: `Most common: ${top.join(', ')}.${sharedWithNew.length ? ` The new report shares: ${sharedWithNew.join(', ')}.` : ''}`,
    strength: sharedWithNew.length >= 2 ? 'strong' : 'moderate',
  });
  const maxD = Math.max(...matches.map((m) => m.distanceKm));
  const villages = [...new Set(members.map((c) => placeById(c.placeId)?.village))];
  const anchor = placeById(anchorPlaceId);
  items.push({
    kind: 'proximity', label: 'Geographic proximity',
    detail: maxD < 0.5
      ? `All in the same locality (${villages.join(', ')}). Coordinates are approximate.`
      : `All within ${maxD.toFixed(1)} km of ${anchor?.village ?? 'the reported location'}, across ${villages.length} ${villages.length === 1 ? 'village' : 'villages'}: ${villages.join(', ')}. Coordinates are approximate.`,
    strength: maxD <= 2 ? 'strong' : 'moderate',
  });
  const times = members.map((c) => c.createdAt);
  const spanH = Math.round((Math.max(...times) - Math.min(...times)) / 3600_000);
  items.push({
    kind: 'time', label: 'Compatible time window',
    detail: members.length === 1
      ? 'One earlier report, recent enough to describe the same ongoing problem.'
      : `Reports arrive over ${spanH} hours, consistent with one continuing fault.`,
    strength: spanH <= 48 ? 'strong' : 'moderate',
  });
  const infra = members.filter((c) => /पंचायत|panchayat/i.test(complaintText(c))).length;
  const infraT = members.filter((c) => /ट्रांसफॉर्मर|ट्रांसफार्मर|transformer/i.test(complaintText(c))).length;
  if (infra || infraT) {
    items.push({
      kind: 'infrastructure', label: 'Shared infrastructure reference',
      detail: `${infraT} reports name a transformer; ${infra} place it near the panchayat bhawan.`,
      strength: infra >= 3 ? 'strong' : 'moderate',
    });
  }
  return items;
}

const ISSUE_PHRASE: Record<Category, { en: string; hi: string }> = {
  power: { en: 'Electricity outage', hi: 'बिजली आपूर्ति बाधित' },
  water: { en: 'Water supply disruption', hi: 'पानी की आपूर्ति बाधित' },
  road: { en: 'Road damage', hi: 'सड़क क्षतिग्रस्त' },
  sanitation: { en: 'Uncleared garbage', hi: 'कूड़ा नहीं उठा' },
  streetlight: { en: 'Streetlights not working', hi: 'स्ट्रीट लाइट बंद' },
  anganwadi: { en: 'Anganwadi building issue', hi: 'आंगनबाड़ी भवन की समस्या' },
  other: { en: 'Civic issue', hi: 'नागरिक समस्या' },
};

export function analyzeComplaint(
  input: { text: string; locationText: string; createdAt: number; id: string },
  state: DemoState,
): Analysis {
  const language = detectLanguage(input.text);
  const found = findConcepts(input.text);
  const ids = found.map((f) => f.id);
  const scores = scoreCategories(ids);
  const ranked = (Object.entries(scores) as [Category, number][]).sort((a, b) => b[1] - a[1]);
  const [topCat, topScore] = ranked[0];
  const category: Category = topScore > 0 ? topCat : 'other';
  const second = ranked[1][1];
  let confidence = topScore > 0 ? 0.5 + (0.45 * (topScore - second)) / (topScore + 1) : 0.3;
  let reviewReason: string | undefined;

  const ambiguousConstruction = category === 'anganwadi' && ids.includes('construction');
  if (ambiguousConstruction) {
    confidence = Math.min(confidence, 0.55);
    reviewReason = 'Construction of an anganwadi building may sit with Women & Child Development, Rural Engineering or the block office.';
  }
  confidence = Math.max(0.25, Math.min(0.94, confidence));

  const duration = extractDuration(input.text);
  const urgencyReasons: string[] = [];
  let urgency: Priority = 'P3';
  if (ids.includes('hazard')) { urgency = 'P1'; urgencyReasons.push('Fire or electrical hazard mentioned (smoke, sparks or burning).'); }
  else if (category === 'road' && ids.includes('vulnerable')) { urgency = 'P1'; urgencyReasons.push('Road hazard near children or other vulnerable people.'); }
  else if ((category === 'power' || category === 'water') && ((duration ?? 0) >= 2 || ids.includes('multi'))) {
    urgency = 'P2';
    if ((duration ?? 0) >= 2) urgencyReasons.push(`Essential service down for about ${duration} days.`);
    if (ids.includes('multi')) urgencyReasons.push('Several households or a whole area affected.');
  } else {
    urgencyReasons.push('No safety risk or widespread outage detected.');
  }

  const location = resolveLocation(input.locationText, input.text);
  const dept = DEPARTMENTS[category];
  const place = placeById(location.placeId);

  const { linked, nearMisses } = matchRelated(
    { category, placeId: location.placeId, createdAt: input.createdAt, concepts: ids, id: input.id }, state,
  );
  const byIncident = new Map<string, RelatedMatch[]>();
  linked.forEach((m) => {
    const inc = state.complaints.find((c) => c.id === m.complaintId)?.incidentId;
    if (!inc) return;
    byIncident.set(inc, [...(byIncident.get(inc) || []), m]);
  });
  const related = [...byIncident.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([incidentId, matches]) => ({ incidentId, matches, evidence: buildEvidence(ids, matches, state, location.placeId) }));

  const humanReview = confidence < REVIEW_THRESHOLD || ambiguousConstruction || !location.placeId;
  if (!reviewReason && confidence < REVIEW_THRESHOLD) reviewReason = `Routing score ${confidence.toFixed(2)} is below the demo review threshold of ${REVIEW_THRESHOLD}.`;
  if (!reviewReason && !location.placeId) reviewReason = 'Location could not be matched to a known village; an officer should confirm it.';

  const issue = ISSUE_PHRASE[category];
  const transformer = ids.includes('transformer');
  const enIssue = transformer ? 'Damaged electricity transformer and power outage' : issue.en;
  const hiIssue = transformer ? 'बिजली का ट्रांसफॉर्मर खराब, बिजली आपूर्ति बाधित' : issue.hi;
  const scaleEn = ids.includes('multi') ? ', affecting several households' : '';
  const scaleHi = ids.includes('multi') ? ', कई घर प्रभावित' : '';
  const durEn = duration ? ` for about ${duration} day${duration > 1 ? 's' : ''}` : '';
  const durHi = duration ? `, लगभग ${duration} दिन से` : '';
  const where = place ? place.village : location.label;
  const whereHi = place ? place.villageHi : location.label;

  const reasoning: string[] = [];
  const quoted = found.filter((f) => CONCEPTS.find((c) => c.id === f.id)?.category === category).flatMap((f) => f.hits).slice(0, 3);
  if (quoted.length) reasoning.push(`The complaint mentions ${quoted.map((q) => `“${q}”`).join(', ')}, which points to ${CATEGORY_LABEL[category].en.toLowerCase()}.`);
  else reasoning.push('No clear issue keywords were found; the complaint needs a human reader.');
  if (place) reasoning.push(`Location matched to ${place.village}, ${place.block} block (match ${location.matchQuality}, approximate).`);
  else reasoning.push('Location could not be matched to the demo gazetteer.');
  urgencyReasons.forEach((r) => reasoning.push(`Priority ${urgency}: ${r}`));
  if (related.length) {
    const r = related[0];
    const maxKm = Math.max(...r.matches.map((m) => m.distanceKm));
    const n = r.matches.length;
    reasoning.push(`${n} recent ${n === 1 ? 'report' : 'reports'} ${maxKm < 0.5 ? 'from the same locality' : `within ${maxKm.toFixed(1)} km`} ${n === 1 ? 'describes' : 'describe'} a similar issue, linked to incident ${r.incidentId}. Linking is a proposal until an officer confirms it.`);
  }

  const alternatives = ranked
    .filter(([c, s]) => s > 0 && c !== category)
    .slice(0, 2)
    .map(([c, s]) => ({ category: c, department: DEPARTMENTS[c].name, score: Number((s / (topScore + s + 1)).toFixed(2)) }));
  if (ambiguousConstruction) {
    alternatives.splice(0, alternatives.length,
      { category: 'other', department: 'Rural Engineering (construction)', score: 0.31 },
      { category: 'other', department: 'Block development office', score: 0.17 });
  }

  return {
    engine: 'demo-rules',
    complaint_summary: `${enIssue}${durEn}${scaleEn} in ${where}.`,
    complaint_summary_hi: `${whereHi} में ${hiIssue}${durHi}${scaleHi}।`,
    language,
    issue_category: category,
    urgency,
    urgency_reasons: urgencyReasons,
    location,
    department_recommendation: dept.name,
    routing_desk: deskFor(category, location.placeId),
    reasoning,
    routing_confidence: Number(confidence.toFixed(2)),
    alternatives,
    potential_related_incidents: related,
    near_misses: nearMisses,
    human_review_required: humanReview,
    review_reason: reviewReason,
    duration_days: duration,
    concepts: ids,
  };
}

/** Validate an LLM extraction coming from the optional backend; returns null if unusable. */
export function validateLlmExtraction(x: unknown): Partial<Analysis> | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const cats: Category[] = ['power', 'water', 'road', 'sanitation', 'streetlight', 'anganwadi', 'other'];
  const pr: Priority[] = ['P1', 'P2', 'P3', 'P4'];
  if (typeof o.complaint_summary !== 'string' || !cats.includes(o.issue_category as Category) || !pr.includes(o.urgency as Priority)) return null;
  const conf = Number(o.routing_confidence);
  if (!(conf >= 0 && conf <= 1)) return null;
  return {
    complaint_summary: o.complaint_summary,
    complaint_summary_hi: typeof o.complaint_summary_hi === 'string' ? o.complaint_summary_hi : undefined,
    issue_category: o.issue_category as Category,
    urgency: o.urgency as Priority,
    reasoning: Array.isArray(o.reasoning) ? (o.reasoning as unknown[]).filter((r): r is string => typeof r === 'string').slice(0, 6) : undefined,
    routing_confidence: conf,
  };
}
