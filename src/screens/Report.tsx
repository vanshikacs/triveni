import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, ImagePlus, Loader2, MapPin, Mic, Square, Trash2, Waves } from 'lucide-react';
import { useStore } from '../lib/store';
import { SAMPLE_COMPLAINTS, CATEGORY_LABEL, placeById } from '../lib/seed';
import { REVIEW_THRESHOLD } from '../lib/pipeline';
import { Badge, Button, PRIORITY_META, cx, useToast } from '../components/ui';
import { navigate } from '../App';
import type { Analysis, Channel, Lang } from '../lib/types';

const T = {
  hi: {
    title: 'शिकायत दर्ज करें',
    sub: 'अपनी समस्या अपने शब्दों में लिखें या बोलें। गांव या मोहल्ले का नाम ज़रूर बताएं।',
    complaint: 'आपकी शिकायत', location: 'स्थान (गांव, ब्लॉक, जिला)', photo: 'फ़ोटो जोड़ें (वैकल्पिक)',
    samples: 'उदाहरण चुनें', submit: 'शिकायत भेजें', voice: 'नमूना वॉइस नोट', dictate: 'बोलकर लिखें',
  },
  en: {
    title: 'Report an issue',
    sub: 'Describe the problem in your own words, by typing or speaking. Include your village or ward.',
    complaint: 'Your complaint', location: 'Location (village, block, district)', photo: 'Add a photo (optional)',
    samples: 'Try an example', submit: 'Submit complaint', voice: 'Sample voice note', dictate: 'Dictate',
  },
};

const STEPS = [
  'Understanding the complaint',
  'Extracting issue and urgency',
  'Identifying location',
  'Checking related incidents',
  'Preparing routing recommendation',
];

type SR = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null };

export default function Report() {
  const { submit } = useStore();
  const toast = useToast();
  const [lang, setLang] = useState<Lang>('hi');
  const [text, setText] = useState(SAMPLE_COMPLAINTS[0].text);
  const [location, setLocation] = useState('Sarai Devipur, Haidergarh, Barabanki');
  const [photo, setPhoto] = useState<string | null>(null);
  const [channel, setChannel] = useState<Channel>('text');
  const [phase, setPhase] = useState<'form' | 'processing' | 'done'>('form');
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<{ complaintId: string; analysis: Analysis } | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceSim, setVoiceSim] = useState(false);
  const recRef = useRef<SR | null>(null);
  const t = T[lang];

  const SpeechRec = (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition;

  useEffect(() => () => recRef.current?.stop(), []);

  function loadSample(i: number) {
    const s = SAMPLE_COMPLAINTS[i];
    setLang(s.lang); setText(s.text); setChannel('text');
    const p = placeById(s.placeId);
    if (p) setLocation(`${p.village}, ${p.block}, ${p.district}`);
  }

  function playSampleVoice() {
    // Simulated: types out a pre-written transcript. No audio is recorded or transcribed.
    const sample = SAMPLE_COMPLAINTS[lang === 'hi' ? 0 : 1].text;
    setVoiceSim(true); setChannel('voice'); setText('');
    const words = sample.split(' ');
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setText(words.slice(0, i).join(' '));
      if (i >= words.length) { clearInterval(iv); setVoiceSim(false); }
    }, 70);
  }

  function dictate() {
    if (!SpeechRec) return;
    if (listening) { recRef.current?.stop(); return; }
    try {
      const rec = new SpeechRec();
      rec.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
      rec.interimResults = true; rec.continuous = false;
      rec.onresult = (e) => {
        const transcript = Array.from(e.results).map((r) => r[0].transcript).join(' ');
        setText(transcript); setChannel('voice');
      };
      rec.onerror = () => { setListening(false); toast({ tone: 'error', text: 'Microphone unavailable here. Use the sample voice note or type instead.' }); };
      rec.onend = () => setListening(false);
      recRef.current = rec; rec.start(); setListening(true);
    } catch {
      toast({ tone: 'error', text: 'Browser dictation could not start. Use the sample voice note or type instead.' });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 12) { toast({ tone: 'error', text: 'Describe the problem in at least a few words.' }); return; }
    setPhase('processing'); setStep(0);
    const res = await submit({ text: text.trim(), language: lang, locationText: location, channel: photo ? 'photo' : channel, hasPhoto: !!photo });
    setResult(res);
    // Steps are revealed one by one so each result can be read; the analysis itself is already complete.
    for (let i = 1; i <= STEPS.length; i++) {
      await new Promise((r) => setTimeout(r, 520));
      setStep(i);
    }
    setPhase('done');
  }

  const a = result?.analysis;
  const stepDetail = (i: number): React.ReactNode => {
    if (!a) return null;
    switch (i) {
      case 0: return <>{a.language === 'hi' ? 'Hindi' : 'English'} detected. <span className="text-ink">{a.complaint_summary}</span></>;
      case 1: return <>{CATEGORY_LABEL[a.issue_category].en}{a.concepts.includes('transformer') ? ', transformer' : ''}. {PRIORITY_META[a.urgency].label}: {a.urgency_reasons.join(' ')}</>;
      case 2: return <>{a.location.label} <span className="text-faint">(match {a.location.matchQuality}, approximate)</span></>;
      case 3: {
        const r = a.potential_related_incidents[0];
        return r ? <>{r.matches.length} possibly related reports, linked to <span className="text-ink font-medium">{r.incidentId}</span>. {a.near_misses.length} considered and set aside.</> : <>No related reports found nearby.</>;
      }
      case 4: return <>{a.department_recommendation}, {a.routing_desk}. Score {a.routing_confidence.toFixed(2)}, {a.human_review_required ? 'sent to human review.' : `above the review threshold of ${REVIEW_THRESHOLD}.`}</>;
    }
  };

  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-8 sm:py-12 grid lg:grid-cols-12 gap-8">
      <form onSubmit={onSubmit} className="lg:col-span-7" aria-label="Complaint form">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 lang={lang} className="font-display text-[28px] font-semibold leading-tight">{t.title}</h1>
            <p lang={lang} className="mt-2 text-[15px] text-muted max-w-xl">{t.sub}</p>
          </div>
          <div role="radiogroup" aria-label="Language" className="inline-flex rounded-[6px] border border-line-strong p-0.5 bg-surface">
            {(['hi', 'en'] as Lang[]).map((l) => (
              <button key={l} type="button" role="radio" aria-checked={lang === l} onClick={() => setLang(l)}
                className={cx('px-3 h-8 rounded-[4px] text-[14px]', lang === l ? 'bg-indigo text-white' : 'text-muted hover:text-ink')}>
                {l === 'hi' ? 'हिन्दी' : 'English'}
              </button>
            ))}
          </div>
        </div>

        <fieldset disabled={phase !== 'form'} className="mt-7 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="complaint" lang={lang} className="text-[14px] font-medium">{t.complaint}</label>
              <div className="flex items-center gap-1.5">
                <Button type="button" size="sm" variant="ghost" onClick={playSampleVoice} disabled={voiceSim}>
                  <Waves className="size-3.5" aria-hidden /> <span lang={lang}>{t.voice}</span>
                </Button>
                {SpeechRec && (
                  <Button type="button" size="sm" variant={listening ? 'danger' : 'ghost'} onClick={dictate} aria-pressed={listening}>
                    {listening ? <Square className="size-3.5" aria-hidden /> : <Mic className="size-3.5" aria-hidden />}
                    <span lang={lang}>{listening ? 'Stop' : t.dictate}</span>
                  </Button>
                )}
              </div>
            </div>
            <textarea id="complaint" lang={lang} value={text} onChange={(e) => { setText(e.target.value); setChannel('text'); }} rows={6}
              className={cx('field resize-y text-[17px] leading-[1.75] min-h-[168px]', lang === 'hi' && 'hi')} />
            {(voiceSim || channel === 'voice') && (
              <p className="mt-1.5 text-[12.5px] text-saffron flex items-center gap-1.5">
                <Waves className="size-3.5" aria-hidden />
                {voiceSim ? 'Playing sample voice note. Transcript is pre-written (simulated).' : 'Text came from a voice note. Please check the transcript before submitting.'}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span lang={lang} className="text-[13px] text-muted mr-1">{t.samples}</span>
              {SAMPLE_COMPLAINTS.map((s, i) => (
                <button key={i} type="button" onClick={() => loadSample(i)}
                  className="text-[13px] h-7 px-2.5 rounded-[6px] border border-line bg-surface hover:border-ink/30 text-ink/80">
                  {s.label} <span className="text-faint">{s.lang === 'hi' ? 'हिन्दी' : 'EN'}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="loc" lang={lang} className="text-[14px] font-medium block mb-2">{t.location}</label>
              <div className="relative">
                <MapPin className="size-4 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden />
                <input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} className="field pl-8" />
              </div>
              <p className="mt-1.5 text-[12px] text-faint">Demo places are fictional villages in real districts.</p>
            </div>
            <div>
              <span lang={lang} className="text-[14px] font-medium block mb-2">{t.photo}</span>
              {photo ? (
                <div className="flex items-center gap-3 border border-line rounded-[6px] p-1.5 bg-surface">
                  <img src={photo} alt="Attached evidence" className="size-12 object-cover rounded-[4px]" />
                  <span className="text-[12.5px] text-muted flex-1">Attached as evidence. Image analysis is not active in this demo.</span>
                  <button type="button" onClick={() => setPhoto(null)} className="p-1.5 text-muted hover:text-alarm" aria-label="Remove photo"><Trash2 className="size-4" /></button>
                </div>
              ) : (
                <label className="flex items-center gap-2 h-[42px] px-3 border border-dashed border-line-strong rounded-[6px] bg-surface text-[14px] text-muted hover:border-ink/40 cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-indigo-2">
                  <ImagePlus className="size-4" aria-hidden /> Choose image
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    const r = new FileReader(); r.onload = () => setPhoto(String(r.result)); r.readAsDataURL(f);
                  }} />
                </label>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button type="submit" variant="primary" size="lg">
              {phase === 'processing' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              <span lang={lang}>{t.submit}</span>
            </Button>
            <span className="text-[13px] text-faint">Stays in this browser. Not sent to CM Helpline 1076 or any department.</span>
          </div>
        </fieldset>
      </form>

      <aside className="lg:col-span-5" aria-live="polite">
        <div className="panel p-5 sm:p-6 lg:sticky lg:top-24">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[16px] font-semibold">{phase === 'form' ? 'What happens next' : phase === 'processing' ? 'Analysing your complaint' : 'Analysis complete'}</h2>
            {a && <Badge tone={a.engine === 'llm' ? 'indigo' : 'neutral'}>{a.engine === 'llm' ? 'LLM extraction' : 'Demo rule pipeline'}</Badge>}
          </div>
          <ol className="mt-5 space-y-0">
            {STEPS.map((s, i) => {
              const state = phase === 'form' ? 'idle' : step > i ? 'done' : step === i ? 'active' : 'waiting';
              return (
                <li key={s} className="relative pl-9 pb-5 last:pb-0">
                  {i < STEPS.length - 1 && <span className={cx('absolute left-[11px] top-6 bottom-0 w-px', state === 'done' ? 'bg-indigo/40' : 'bg-line')} aria-hidden />}
                  <span className={cx('absolute left-0 top-0.5 size-[23px] rounded-full grid place-items-center text-[12px] font-semibold num border',
                    state === 'done' ? 'bg-indigo border-indigo text-white' : state === 'active' ? 'border-indigo text-indigo bg-indigo-wash' : 'border-line-strong text-faint bg-surface')}>
                    {state === 'done' ? <Check className="size-3.5" aria-hidden /> : state === 'active' ? <span className="size-1.5 rounded-full bg-indigo pulse-dot" /> : i + 1}
                  </span>
                  <div className={cx('text-[14.5px]', state === 'waiting' || state === 'idle' ? 'text-muted' : 'text-ink font-medium')}>{s}</div>
                  {state === 'done' && <div className="fade-in mt-1 text-[13.5px] text-muted leading-relaxed">{stepDetail(i)}</div>}
                </li>
              );
            })}
          </ol>
          {phase === 'form' && (
            <p className="mt-5 text-[13px] text-faint border-t hairline pt-4">
              Each step shows what was found. The demo uses a transparent rule pipeline, not a trained model, unless an LLM backend is configured.
            </p>
          )}
          {phase === 'done' && result && (
            <div className="fade-in mt-6 border-t hairline pt-5 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => navigate(`/intelligence/${result.complaintId}`)}>
                Open case intelligence <ChevronRight className="size-4" aria-hidden />
              </Button>
              <Button variant="ghost" onClick={() => { setPhase('form'); setResult(null); setStep(0); }}>Report another issue</Button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
