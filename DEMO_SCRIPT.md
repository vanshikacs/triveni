# TRIVENI — 3-minute demo script

Target length: 2:50–3:10. One speaker narrates, one drives. Record at 1440×900 or 1920×1080, browser zoom 100%.

| Time | Screen and action | Narration (say roughly this) |
|---|---|---|
| 0:00–0:20 | **Overview.** Let the threads finish drawing. Point to the reports, then the incident card. | "When a transformer burns out in a village, many people call. Today each call can become a separate ticket. Here are seven reports from three neighbouring villages, in Hindi and English, by voice, text and photo. They are probably one fault. TRIVENI's job is to notice that, and let an officer decide." |
| 0:20–0:30 | Point to the dashed handpump report. | "This report is from the same village but about a handpump. Same place, different problem, so it stays separate." |
| 0:30–0:50 | Click **Report an issue**. The Hindi complaint is preloaded. Optionally click **नमूना वॉइस नोट** to show voice intake. | "A citizen reports in Hindi: the transformer has been broken for two days and many homes have no power. They can type, speak, or attach a photo." |
| 0:50–1:15 | Click **शिकायत भेजें**. Let the five steps fill in. | "TRIVENI understands the complaint, extracts the issue and urgency, finds the village, checks for related incidents, and prepares a routing recommendation. Each step shows what it found. In this prototype that's a transparent rule pipeline, not a trained model." |
| 1:15–1:45 | Click **Open case intelligence**. Show the highlighted Hindi words, priority P2 and its reasons, the location match, and the routing score against the threshold. | "Here's the structured case. These highlighted words drove the decision. It's P2 because an essential service has been down for two days across many households. The score is above our review threshold, so it's ready for an officer. If it were below, it would go to human review with alternatives." |
| 1:45–2:15 | Scroll to **Incident fusion**. The new report's thread is saffron. Point to the evidence panel and the "considered but not linked" row. | "Now the central idea. Eight reports may describe one shared incident. Here's why: similar descriptions, all within 1.6 km, within 26 hours, and four mention the transformer by the panchayat bhawan. Nothing is merged yet. Two other reports were considered and set aside: one is 80 km away, one is a different issue." |
| 2:15–2:45 | Click **Review in command centre**. In the drawer: **Approve merge**, then confirm. **Approve routing**, then confirm. Set the status to **In progress**. Type a short note. | "In the command centre the officer reviews the proposal, approves the merge, and approves routing to the power distribution desk. These are simulated actions; nothing reaches a real department." |
| 2:45–3:00 | Close the drawer. Show INC-2041 with 8 reports, In progress. Reopen it and scroll the preserved citizen reports. | "One consolidated incident, one owner. And every original citizen report is still here, so the officer can split any one out if it was wrongly linked. From fragmented complaints to coordinated action." |

## Recording checklist

- [ ] Use the production build (`npm run build && npm run preview`) or the deployed link, not `npm run dev`.
- [ ] Click **Reset demo** right before recording, and again before every retake.
- [ ] Close other tabs, mute notifications, hide bookmarks, and use a clean browser profile.
- [ ] Use Chrome at 100% zoom, with a 1440×900 or 1920×1080 window.
- [ ] Wait about 1.5 s on the Overview so the threads finish drawing.
- [ ] Do one dry run first. Don't type the complaint live; use the preloaded one.
- [ ] Say "simulated" at least once on camera, and keep the footer banner in the frame on one screen.
- [ ] Don't claim accuracy numbers, government integration or a trained model.
- [ ] Record the narration separately if the room is noisy, and keep the video under 3:10.
- [ ] Export at 1080p MP4, then watch it once end to end before submitting.
