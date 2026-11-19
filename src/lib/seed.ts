import type { Activity, Category, Complaint, DemoState, Incident, Place } from './types';

/**
 * SIMULATED DEMONSTRATION DATA — NOT LIVE GOVERNMENT RECORDS.
 * Districts and blocks are real place names used for context only. Every village/ward name,
 * citizen, complaint, incident, coordinate and routing desk below is fictional.
 * Coordinates are approximate and invented for distance calculations in the demo.
 */

export const PLACES: Place[] = [
  { id: 'sarai-devipur', village: 'Sarai Devipur', villageHi: 'सराय देवीपुर', block: 'Haidergarh', district: 'Barabanki', lat: 26.618, lng: 81.362 },
  { id: 'kundanpur-khurd', village: 'Kundanpur Khurd', villageHi: 'कुंदनपुर खुर्द', block: 'Haidergarh', district: 'Barabanki', lat: 26.627, lng: 81.371 },
  { id: 'bhawanipur-kalan', village: 'Bhawanipur Kalan', villageHi: 'भवानीपुर कलां', block: 'Haidergarh', district: 'Barabanki', lat: 26.609, lng: 81.35 },
  { id: 'purwa-lalganj', village: 'Purwa Lalganj', villageHi: 'पुरवा लालगंज', block: 'Dariyabad', district: 'Barabanki', lat: 26.882, lng: 81.561 },
  { id: 'rasulpur-tanda', village: 'Rasulpur Tanda', villageHi: 'रसूलपुर टांडा', block: 'Mahmudabad', district: 'Sitapur', lat: 27.301, lng: 81.118 },
  { id: 'lko-ward-14', village: 'Ward 14, Nayagaon', villageHi: 'वार्ड 14, नयागांव', block: 'Lucknow city', district: 'Lucknow', lat: 26.871, lng: 80.951 },
  { id: 'lko-ward-9', village: 'Ward 9, Rambagh', villageHi: 'वार्ड 9, रामबाग', block: 'Lucknow city', district: 'Lucknow', lat: 26.852, lng: 80.921 },
];

export const placeById = (id: string | null | undefined) => PLACES.find((p) => p.id === id);

export const DEPARTMENTS: Record<Category, { name: string; nameHi: string; desk: string }> = {
  power: { name: 'Power distribution (DISCOM)', nameHi: 'बिजली वितरण (डिस्कॉम)', desk: 'sub-division, transformers & lines' },
  water: { name: 'Water supply', nameHi: 'जल आपूर्ति', desk: 'water supply desk' },
  road: { name: 'Public Works Department', nameHi: 'लोक निर्माण विभाग', desk: 'roads maintenance desk' },
  sanitation: { name: 'Local body, sanitation', nameHi: 'स्थानीय निकाय, स्वच्छता', desk: 'sanitation desk' },
  streetlight: { name: 'Local body, street lighting', nameHi: 'स्थानीय निकाय, स्ट्रीट लाइट', desk: 'street lighting desk' },
  anganwadi: { name: 'Women & Child Development', nameHi: 'महिला एवं बाल विकास', desk: 'ICDS project office' },
  other: { name: 'District grievance cell', nameHi: 'जिला शिकायत प्रकोष्ठ', desk: 'general desk' },
};

export const CATEGORY_LABEL: Record<Category, { en: string; hi: string }> = {
  power: { en: 'Electricity', hi: 'बिजली' },
  water: { en: 'Water supply', hi: 'पानी' },
  road: { en: 'Roads', hi: 'सड़क' },
  sanitation: { en: 'Sanitation', hi: 'सफ़ाई' },
  streetlight: { en: 'Street lighting', hi: 'स्ट्रीट लाइट' },
  anganwadi: { en: 'Anganwadi building', hi: 'आंगनबाड़ी भवन' },
  other: { en: 'Other', hi: 'अन्य' },
};

export const deskFor = (category: Category, placeId: string | null) => {
  const p = placeById(placeId);
  return `${p ? p.block : 'District'} ${DEPARTMENTS[category].desk}`;
};

type SeedComplaint = Omit<Complaint, 'createdAt'> & { hoursAgo: number };

const C: SeedComplaint[] = [
  // Transformer cluster, proposed incident INC-2041
  { id: 'C-1101', citizen: 'Ramdulari Devi', channel: 'voice', language: 'hi', placeId: 'sarai-devipur', hoursAgo: 30, category: 'power', incidentId: 'INC-2041',
    text: 'पंचायत भवन के पास वाला ट्रांसफॉर्मर कल शाम से धुआं दे रहा है, फिर बिजली चली गई।',
    textEn: 'The transformer near the panchayat bhawan has been smoking since yesterday evening, then the power went out.' },
  { id: 'C-1102', citizen: 'Arjun Verma', channel: 'text', language: 'en', placeId: 'sarai-devipur', hoursAgo: 28, category: 'power', incidentId: 'INC-2041',
    text: 'No electricity in our lane since last night. Neighbours say the transformer near the panchayat building is damaged.' },
  { id: 'C-1103', citizen: 'Shabana Bano', channel: 'voice', language: 'hi', placeId: 'kundanpur-khurd', hoursAgo: 26, category: 'power', incidentId: 'INC-2041',
    text: 'बिजली के खंभे के पास जलने की बदबू आ रही है, रात को चिंगारी भी दिखी।',
    textEn: 'Burning smell near the electricity pole; sparks were also seen at night.' },
  { id: 'C-1104', citizen: 'Mahesh Yadav', channel: 'text', language: 'hi', placeId: 'sarai-devipur', hoursAgo: 20, category: 'power', incidentId: 'INC-2041',
    text: 'गांव में बिजली पूरी तरह बंद है, मोबाइल भी चार्ज नहीं हो पा रहे।',
    textEn: 'Electricity is completely off in the village; we cannot even charge phones.' },
  { id: 'C-1105', citizen: 'Pooja Rawat', channel: 'photo', language: 'en', placeId: 'bhawanipur-kalan', hoursAgo: 14, category: 'power', incidentId: 'INC-2041', hasPhoto: true,
    text: 'Damaged electrical equipment on the transformer platform by the panchayat road. Oil is leaking from the side.' },
  { id: 'C-1106', citizen: 'Ram Kishore', channel: 'voice', language: 'hi', placeId: 'kundanpur-khurd', hoursAgo: 9, category: 'power', incidentId: 'INC-2041',
    text: 'दो दिन से लाइट नहीं है, आटा चक्की और पानी की मोटर सब बंद है।',
    textEn: 'No power for two days; the flour mill and water pumps have all stopped.' },
  { id: 'C-1107', citizen: 'Neha Singh', channel: 'text', language: 'en', placeId: 'sarai-devipur', hoursAgo: 4, category: 'power', incidentId: 'INC-2041',
    text: 'Local power interruption continues. The transformer at the panchayat bhawan looks burnt. Elderly residents are struggling.' },

  // Considered by fusion but not linked
  { id: 'C-1108', citizen: 'Sunil Gupta', channel: 'text', language: 'hi', placeId: 'rasulpur-tanda', hoursAgo: 10, category: 'power', incidentId: 'INC-2048',
    text: 'ट्रांसफॉर्मर से तेल रिस रहा है, बिजली कभी आती है कभी जाती है।',
    textEn: 'Oil is leaking from the transformer; power keeps coming and going.' },
  { id: 'C-1109', citizen: 'Geeta Devi', channel: 'text', language: 'hi', placeId: 'sarai-devipur', hoursAgo: 16, category: 'water', incidentId: 'INC-2047',
    text: 'स्कूल के पास वाला हैंडपंप खराब है, पीने का पानी नहीं मिल रहा।',
    textEn: 'The handpump near the school is broken; there is no drinking water.' },

  // Water supply, Lucknow
  { id: 'C-1110', citizen: 'Farhan Siddiqui', channel: 'text', language: 'en', placeId: 'lko-ward-14', hoursAgo: 50, category: 'water', incidentId: 'INC-2038',
    text: 'No piped water supply in Nayagaon for two days. Tanker has not come either.' },
  { id: 'C-1111', citizen: 'Kavita Mishra', channel: 'voice', language: 'hi', placeId: 'lko-ward-14', hoursAgo: 46, category: 'water', incidentId: 'INC-2038',
    text: 'नल में पानी नहीं आ रहा, पाइपलाइन मुख्य सड़क पर फटी हुई है।', textEn: 'No water in the taps; the pipeline has burst on the main road.' },
  { id: 'C-1112', citizen: 'Deepak Chauhan', channel: 'photo', language: 'en', placeId: 'lko-ward-14', hoursAgo: 40, category: 'water', incidentId: 'INC-2038', hasPhoto: true,
    text: 'Water gushing from a broken pipeline near the Nayagaon crossing, road flooded.' },

  // Road cave-in, Lucknow
  { id: 'C-1113', citizen: 'Anita Pal', channel: 'text', language: 'hi', placeId: 'lko-ward-9', hoursAgo: 70, category: 'road', incidentId: 'INC-2035',
    text: 'स्कूल के सामने सड़क धंस गई है, बड़ा गड्ढा बन गया है, बच्चों के लिए खतरा है।', textEn: 'The road in front of the school has caved in; a large pit has formed and is dangerous for children.' },
  { id: 'C-1114', citizen: 'Vikas Tiwari', channel: 'photo', language: 'en', placeId: 'lko-ward-9', hoursAgo: 66, category: 'road', incidentId: 'INC-2035', hasPhoto: true,
    text: 'Deep cave-in on Rambagh school road. A scooter fell in this morning.' },

  // Garbage, resolved
  { id: 'C-1115', citizen: 'Rukhsana Begum', channel: 'text', language: 'hi', placeId: 'lko-ward-9', hoursAgo: 200, category: 'sanitation', incidentId: 'INC-2030',
    text: 'कूड़ाघर एक हफ्ते से नहीं उठा, पूरी गली में बदबू है।', textEn: 'The garbage point has not been cleared for a week; the whole lane smells.' },
  { id: 'C-1116', citizen: 'Manoj Srivastava', channel: 'text', language: 'en', placeId: 'lko-ward-9', hoursAgo: 190, category: 'sanitation', incidentId: 'INC-2030',
    text: 'Overflowing garbage bin near Rambagh market, stray animals spreading waste.' },

  // Ambiguous: needs human review
  { id: 'C-1117', citizen: 'Sarita Kumari', channel: 'photo', language: 'hi', placeId: 'purwa-lalganj', hoursAgo: 22, category: 'anganwadi', incidentId: 'INC-2044', hasPhoto: true,
    text: 'आंगनबाड़ी भवन दो साल से अधूरा पड़ा है, बच्चे पेड़ के नीचे बैठते हैं।', textEn: 'The anganwadi building has been lying incomplete for two years; children sit under a tree.' },

  // Street lighting
  { id: 'C-1118', citizen: 'Priya Saxena', channel: 'text', language: 'en', placeId: 'lko-ward-14', hoursAgo: 12, category: 'streetlight', incidentId: 'INC-2046',
    text: 'Six streetlights on the main road have been off for a week. Women avoid walking here after dark.' },
];

type SeedIncident = Omit<Incident, 'updatedAt'> & { updatedHoursAgo: number };

const I: SeedIncident[] = [
  {
    id: 'INC-2041', title: 'Transformer failure, village-wide outage', titleHi: 'ट्रांसफॉर्मर खराब, गांव में बिजली गुल',
    category: 'power', placeId: 'sarai-devipur', priority: 'P1', status: 'pending_review', mergeState: 'proposed',
    complaintIds: ['C-1101', 'C-1102', 'C-1103', 'C-1104', 'C-1105', 'C-1106', 'C-1107'],
    routing: { department: 'Power distribution (DISCOM)', desk: 'Haidergarh sub-division, transformers & lines', confidence: 0.88, approved: false },
    humanReview: true, reviewReason: 'Proposed merge of related reports needs officer confirmation.',
    aiSummary: 'Several reports from three neighbouring villages describe smoke, sparks and a burnt transformer near the Sarai Devipur panchayat bhawan, followed by a continuing outage.',
    notes: [], updatedHoursAgo: 4,
  },
  {
    id: 'INC-2038', title: 'Burst pipeline, no piped water', titleHi: 'पाइपलाइन फटी, नल में पानी नहीं',
    category: 'water', placeId: 'lko-ward-14', priority: 'P2', status: 'in_progress', mergeState: 'confirmed',
    complaintIds: ['C-1110', 'C-1111', 'C-1112'],
    routing: { department: 'Water supply', desk: 'Lucknow city water supply desk', confidence: 0.91, approved: true },
    humanReview: false, aiSummary: 'A burst main near the Nayagaon crossing has cut piped supply to the ward for two days.',
    notes: [{ id: 'N-1', at: 0, text: 'Repair crew assigned. Tanker requested for the interim. (simulated note)' }], updatedHoursAgo: 18,
  },
  {
    id: 'INC-2035', title: 'Road cave-in outside school', titleHi: 'स्कूल के सामने सड़क धंसी',
    category: 'road', placeId: 'lko-ward-9', priority: 'P1', status: 'routed', mergeState: 'confirmed',
    complaintIds: ['C-1113', 'C-1114'],
    routing: { department: 'Public Works Department', desk: 'Lucknow city roads maintenance desk', confidence: 0.86, approved: true },
    humanReview: false, aiSummary: 'A cave-in on the Rambagh school road poses a safety risk to children and two-wheelers.',
    notes: [], updatedHoursAgo: 60,
  },
  {
    id: 'INC-2030', title: 'Garbage point not cleared', titleHi: 'कूड़ाघर नहीं उठा',
    category: 'sanitation', placeId: 'lko-ward-9', priority: 'P3', status: 'resolved', mergeState: 'confirmed',
    complaintIds: ['C-1115', 'C-1116'],
    routing: { department: 'Local body, sanitation', desk: 'Lucknow city sanitation desk', confidence: 0.9, approved: true },
    humanReview: false, aiSummary: 'Uncleared garbage point near Rambagh market for about a week.',
    notes: [{ id: 'N-2', at: 0, text: 'Cleared and bin replaced. Citizens informed. (simulated note)' }], updatedHoursAgo: 150,
  },
  {
    id: 'INC-2044', title: 'Anganwadi building left incomplete', titleHi: 'आंगनबाड़ी भवन अधूरा',
    category: 'anganwadi', placeId: 'purwa-lalganj', priority: 'P3', status: 'pending_review', mergeState: 'single',
    complaintIds: ['C-1117'],
    routing: { department: 'Women & Child Development', desk: 'Dariyabad ICDS project office', confidence: 0.52, approved: false },
    humanReview: true, reviewReason: 'Low routing confidence: construction issues may sit with Rural Engineering or the block office.',
    aiSummary: 'Photo and caption describe an anganwadi building incomplete for about two years; children are taught outdoors.',
    notes: [], updatedHoursAgo: 22,
  },
  {
    id: 'INC-2046', title: 'Streetlights off on main road', titleHi: 'मुख्य सड़क की स्ट्रीट लाइट बंद',
    category: 'streetlight', placeId: 'lko-ward-14', priority: 'P3', status: 'open', mergeState: 'single',
    complaintIds: ['C-1118'],
    routing: { department: 'Local body, street lighting', desk: 'Lucknow city street lighting desk', confidence: 0.83, approved: false },
    humanReview: false, aiSummary: 'Six streetlights out for a week on the Nayagaon main road; a safety concern after dark.',
    notes: [], updatedHoursAgo: 12,
  },
  {
    id: 'INC-2047', title: 'Handpump broken near school', titleHi: 'स्कूल के पास हैंडपंप खराब',
    category: 'water', placeId: 'sarai-devipur', priority: 'P3', status: 'routed', mergeState: 'single',
    complaintIds: ['C-1109'],
    routing: { department: 'Water supply', desk: 'Haidergarh water supply desk', confidence: 0.84, approved: true },
    humanReview: false, aiSummary: 'Drinking-water handpump near the Sarai Devipur school is not working.',
    notes: [], updatedHoursAgo: 15,
  },
  {
    id: 'INC-2048', title: 'Leaking transformer, unstable supply', titleHi: 'ट्रांसफॉर्मर से तेल रिसाव',
    category: 'power', placeId: 'rasulpur-tanda', priority: 'P2', status: 'open', mergeState: 'single',
    complaintIds: ['C-1108'],
    routing: { department: 'Power distribution (DISCOM)', desk: 'Mahmudabad sub-division, transformers & lines', confidence: 0.86, approved: false },
    humanReview: false, aiSummary: 'Oil leak from a transformer in Rasulpur Tanda with intermittent supply.',
    notes: [], updatedHoursAgo: 10,
  },
];

const A: (Omit<Activity, 'at'> & { hoursAgo: number })[] = [
  { id: 'A-1', hoursAgo: 150, actor: 'officer', incidentId: 'INC-2030', text: 'Marked resolved after confirmation from the sanitation desk.' },
  { id: 'A-2', hoursAgo: 60, actor: 'officer', incidentId: 'INC-2035', text: 'Approved routing to Public Works Department.' },
  { id: 'A-3', hoursAgo: 22, actor: 'pipeline', incidentId: 'INC-2044', text: 'Routing confidence 0.52 is below the review threshold. Sent to human review with three candidate departments.' },
  { id: 'A-4', hoursAgo: 18, actor: 'officer', incidentId: 'INC-2038', text: 'Status changed to In progress.' },
  { id: 'A-5', hoursAgo: 4, actor: 'pipeline', incidentId: 'INC-2041', text: 'Proposed linking 7 reports from 3 neighbouring villages into one incident. Awaiting officer confirmation.' },
];

export function buildSeed(now = Date.now()): DemoState {
  const h = 3600_000;
  return {
    version: 1,
    seededAt: now,
    complaints: C.map(({ hoursAgo, ...c }) => ({ ...c, createdAt: now - hoursAgo * h })),
    incidents: I.map(({ updatedHoursAgo, ...i }) => ({
      ...i,
      notes: i.notes.map((n) => ({ ...n, at: now - updatedHoursAgo * h })),
      updatedAt: now - updatedHoursAgo * h,
    })),
    activity: A.map(({ hoursAgo, ...a }) => ({ ...a, at: now - hoursAgo * h })),
    cases: [],
    counter: 1200,
  };
}

export const SAMPLE_COMPLAINTS: { label: string; lang: 'hi' | 'en'; text: string; placeId: string }[] = [
  { label: 'Transformer failure', lang: 'hi', placeId: 'sarai-devipur',
    text: 'हमारे गांव में पिछले दो दिनों से बिजली का ट्रांसफॉर्मर खराब है। कई घरों में बिजली नहीं आ रही है। कृपया जल्द से जल्द ठीक करवाएं।' },
  { label: 'Transformer failure', lang: 'en', placeId: 'sarai-devipur',
    text: 'The electricity transformer in our village has been damaged for the last two days. Several households have no electricity. Please arrange a repair urgently.' },
  { label: 'Burst water pipeline', lang: 'en', placeId: 'lko-ward-14',
    text: 'The water pipeline on our street has burst and there has been no tap water since yesterday.' },
  { label: 'Incomplete anganwadi', lang: 'hi', placeId: 'purwa-lalganj',
    text: 'गांव का आंगनबाड़ी भवन बहुत समय से अधूरा है, बच्चों के बैठने की जगह नहीं है।' },
];
