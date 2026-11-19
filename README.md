# TRIVENI prototype

**Every voice matters. Every incident finds its way.**

Idea-stage prototype for the AI Kaushal Hackathon 2026 (use case: *Universal Intake, Triage & Routing Engine*, CM Office / IT & Electronics Department, Government of Uttar Pradesh). Team: Vanshika Saxena (lead), Samridhhi Tripathi, Sumaiya Khan.

It demonstrates one idea: **many fragmented citizen complaints → one proposed incident that an officer confirms.**

> **SIMULATED DEMONSTRATION DATA — NOT LIVE GOVERNMENT RECORDS.**
> Every citizen, village, complaint, incident, coordinate and routing desk is fictional (districts and blocks are real names, used for context only). Nothing is sent to IGRS, CM Helpline 1076 or any department. Officer actions change this browser's demo state only.

## Run it

Requires Node 20+.

```bash
npm install
npm run dev          # http://localhost:5173
```

Production build (static files in `dist/`, relative paths, works from any static host or sub-folder):

```bash
npm run build
npm run preview      # http://localhost:4173
```

### Optional LLM backend

The app is complete without a backend. To let a model do the extraction:

```bash
pip install -r server/requirements.txt
cp .env.example .env          # set OPENAI_API_KEY in your shell or .env loader
OPENAI_API_KEY=sk-... uvicorn server.main:app --port 8000
VITE_TRIVENI_API=/api npm run dev
```

- Without a key, `/api/analyze` returns 503 and the browser uses the demo pipeline.
- Model output is schema-validated twice (server Pydantic + client check). Invalid output falls back to the demo pipeline.
- The model only refines summary, category, urgency, reasoning and routing score. **Related-report matching stays deterministic**, so a model can never invent a link between complaints, and it can never take an action.
- The key lives only on the server. Never put it in a `VITE_` variable.

## Screenshots

`docs/screenshots/`: overview, report analysis, incident fusion, officer approval, command centre (taken from the tested production build).

## The four screens

| Route | Screen | What it proves |
|---|---|---|
| `#home` | Product entry | The idea in one visual: 7 reports from 3 villages converge into one proposed incident; a nearby unrelated report stays apart |
| `#report` | Citizen reporting | Hindi/English UI, preloaded Hindi transformer complaint, sample complaints, location, optional photo, sample voice note and (in Chrome) live dictation; a five-step analysis that shows what each step found |
| `#intelligence-<caseId>` | Case intelligence + **Incident Fusion** | Structured case, highlighted evidence words, routing score against a review threshold, reasons, alternatives; reports threaded into one proposed incident with an evidence panel and "considered but not linked" reports |
| `#command`, `#command-<incidentId>` | Officer command centre | KPIs, searchable/filterable incident table (Hindi search works), location panel, review queue, activity log, incident drawer: inspect, approve/reject merge, split, change department, approve routing, set status, add notes |

## Working features (tested end to end)

- Complaint submission and analysis in Hindi and English, with the five processing steps showing real results
- Preloaded Hindi transformer complaint and four sample complaints
- Location matching to the fictional gazetteer, including typos (for example "Sarai Devipr")
- Urgency rules: hazard words → P1; essential service down 2+ days or many households → P2
- Routing score with a review threshold of 0.75; low scores and ambiguous cases go to human review
- Incident Fusion: weighted similarity (issue type, shared terms, distance, time) proposes links; evidence panel; near misses shown with the reason they were excluded
- Officer actions: confirm merge, reject merge (reports become separate incidents), split one report out, change department, approve simulated routing, change status, add notes. Every action has a confirmation dialog, a toast and an activity-log entry
- Search across ID, village (Hindi or English), issue and complaint text; filters for status, priority and department; clickable KPIs
- State saved in `localStorage` and survives refresh; **Reset demo** restores the seed
- Responsive from 390 px phones to wide desktops; keyboard navigation (table rows, dialogs, Escape to close); visible focus; reduced-motion respected

## Simulated or not built

| Item | Status |
|---|---|
| "AI" in the default build | A deterministic, transparent rule pipeline (keywords, rules, small gazetteer, weighted similarity). Labelled "Demo rule pipeline" in the UI. **Not a trained model.** |
| LLM extraction | Optional backend, tested with a mock server; not tested against a live OpenAI key in this environment |
| Routing score | A heuristic, not a calibrated probability. The conformal calibration in the proposal is future work |
| Sample voice note | Types out a pre-written transcript. No audio is recorded or transcribed |
| Live dictation | Uses the browser's Web Speech API where available (Chrome); quality depends on the browser |
| Photo | Attached and shown as evidence; image understanding is not active |
| Location panel | Schematic placement from invented, approximate coordinates; no tile map or geocoding |
| Resolution-time estimates, spike detection, weekly brief | In the proposal; not in this prototype |
| Government integration, authentication, notifications | Not built, by design |

## Tested demo workflow

`tests/e2e_demo.py` (Playwright; `pip install playwright && playwright install chromium`, then `python tests/e2e_demo.py http://localhost:4173/`) runs the exact demo against the production build: reset → submit the Hindi complaint → check the five steps → open intelligence → inspect a report → command centre → approve merge → approve routing → add note → set *In progress* → reload and confirm persistence → Hindi search → priority filter → review queue → change department and approve on the anganwadi case → activity log → split a report → reset. It passed with no console errors. Fallback and mock-LLM modes were also tested.

## Deploying

It is a static site. Any of these work:

- **Netlify / Vercel / Cloudflare Pages:** build command `npm run build`, output directory `dist`.
- **GitHub Pages:** `npm run build`, then publish `dist/` (paths are relative, so a sub-path works).
- Backend (optional): any Python host, for example Render or Railway, running `uvicorn server.main:app --host 0.0.0.0 --port $PORT` with `OPENAI_API_KEY` and `ALLOWED_ORIGINS` set. Rebuild the frontend with `VITE_TRIVENI_API=https://<backend>/api`.

## Project structure

```
src/
  lib/types.ts        data model
  lib/seed.ts         simulated dataset (19 complaints, 8 incidents) and gazetteer
  lib/pipeline.ts     deterministic demo pipeline: language, concepts, urgency, location, routing, related reports, evidence
  lib/fusion.ts       recomputes fusion evidence for an incident
  lib/store.tsx       state, persistence, officer actions, optional LLM call
  components/         UI kit, FusionBoard, LocalityPanel
  screens/            Entry, Report, Intelligence, Command
server/main.py        optional FastAPI extraction service
```

Design: Martel (display) and Mukta (text), both with full Devanagari support; warm ivory surfaces, ink text, midnight indigo, restrained saffron. The mark is three streams meeting at one point: the confluence that gives TRIVENI its name.
