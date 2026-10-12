# ZeroWaste: 15-minute technical demo, verified fix edition

## Status and scope

Current verified revision: **729bab0865c7d49f98db8bcb529dfa94e81b9d7f**, checked on 2026-10-12. Fullness reporting succeeds end to end in the real React/Vite application, Express API, and local MongoDB 7.0.26. The cloud check preserved the existing synthetic database without reseeding.

The ten campus locations are repository sample records. Activity, fullness, history, and impact numbers are synthetic demonstration data, not an official UCLA feed, live sensor readings, or measured user outcomes. The new report was genuinely submitted through the UI and persisted to the demonstration database.

The [12.20-second silent success recording](ZeroWaste-fixed-success-walkthrough.mp4) is a visual walkthrough of a local application, not a live hosted deployment or a 15-minute narrated presentation. Use this 2/5/5/3 timed runbook for the full interview. Segmentation inference is not shown or claimed: no SAM/Trash-Net model environment was installed for this database/UI demonstration.

## 0:00–2:00 — User problem and scope

- Introduce the two users: a student deciding where to sort waste, and campus operations reviewing bins needing attention.
- Explain the prototype goal: make sorting guidance, bin availability, and issue visibility accessible in one interface.
- Show the real student landing screen and explain the selected bin's identity.
- State immediately that campus locations and activity are synthetic sample data.
- Scope the demonstration to bin browsing, operational triage, database-backed metrics, and a successful fullness report with persistence evidence.

## 2:00–7:00 — Product walkthrough

- Switch to Admin View. Explain dashboard metrics. The original baseline had 42 current-day report records, 3 bins over 80%, and 3 overflow reports. The successful report adds one current-day record, giving 43 for this captured dataset; subsequent submissions will increase it again. “Scans Today” is the existing UI label but counts fullness-report documents, not camera inference requests.
- Open Bins. Compare realistic fullness values across the ten campus locations. Select Full Bins Only to show the three records needing attention.
- Return to Student View and open Report bin fullness. Explicitly choose **Powell Library — Main Floor — QR-PL-001** in “Bin to report.” Select **3/4 Full**, then Submit.
- Show the green confirmation identifying Powell Library and the chosen level. The captured request returned **HTTP 201**.
- Reload the page, open Admin View → Bins → Powell Library → Investigate. Show **75% / Warning** after reload.
- Explain the captured before/after evidence: Powell changed **48% → 75%**, its history gained one entry, and the report collection grew **72 → 73**. Ackerman Union remained unchanged at **92%**, demonstrating that the selected bin, rather than the first bin or station, was updated.
- The preserved database now already contains this successful update. A repeat demonstration adds another legitimate report; do not claim the original before values are still current or silently reseed to recreate them.

## 7:00–12:00 — Technical deep dive

- Architecture: React/Vite → Express REST routes → Mongoose models → local MongoDB. Segmentation is a separate Python subprocess path and remains outside the verified demo.
- Walk through src/api.js: API origin, response errors, general 10-second timeout, and separate inference timeout.
- Walk through src/App.jsx: explicit bin selection, selected bin ID submission, disabled controls while saving, duplicate-request guard, actionable errors, and success confirmation.
- Walk through server/server.js, POST /api/bins/report-fullness: validate ObjectId, allowed fullness level, and active bin; create a FullnessReport linked to the selected bin; update fullness/status and append history; return the saved report ID and updated bin with HTTP 201.
- Explain failure compensation accurately: if the bin update fails, the new report is removed. This supports standalone MongoDB; it is not a database transaction or proof of atomicity under all crash/concurrency scenarios.
- Walk through server/models/FullnessReport.js: explicit bin reference and historical-record compatibility. Trace dashboard recalculation and per-bin statistics.
- Show the [regression tests](../../website/tests/fullness.spec.js): actual request/response, selected and unrelated records before/after, saved MongoDB report, total count, and history assertion. The recording's before/after values are summarized below; the tests create their own independent synthetic fixtures.

## 12:00–15:00 — Quality, retrospective, and next steps

- Verified independently on the cloud computer: locked npm installation, production build, real MongoDB connectivity, selected-bin reporting through the browser, HTTP 201, confirmation, persistence after reload, history append, and unchanged unrelated record.
- All **10 regression tests passed in 5.9 seconds**: explicit second-bin selection; Use This Bin; visible 404 and successful retry; duplicate clicks; empty list; invalid IDs/inactive bins/levels; all six levels; report-insert failure; bin-update failure compensation; historical statistics compatibility. Tests use their own temporary database and do not reset the preserved demo database.
- Historical defect, now fixed: revision 746ebafc submitted a Station ID to a Bin lookup and returned 404. The route also referenced an undefined report after updating a valid bin. The original failure recording is a retrospective artifact, not the current behavior. The fix establishes explicit bin selection and creates the report before returning success.
- Remaining work: per-user identity and role authorization; explicit metric naming; stronger transactional/concurrency guarantees if needed; model evaluation on held-out waste images; controlled field validation.
- Not verified: real segmentation, camera hardware, a live facilities feed, production authorization, throughput, or waste-diversion effectiveness. Attribute team work accurately; do not imply sole authorship or measured real-world impact.

## Unchanged limitations

The application uses a shared demoStudent identity and has no production authentication/authorization. Metrics are recalculated on reads and need prototype context. Keep it a synthetic development demonstration rather than a publicly exposed production system.

The recordings preserve the location-permission-denied banner. No device location was shared. External map tiles did not load in the local browser, so detail views show a marker on a gray map; geographic map rendering is not claimed as verified. The earlier capture recorded no JavaScript page-error events; that observation is not a substitute for the current regression and persistence checks.

## Reproduction and evidence

The recording used [fixed revision 729bab0](https://github.com/xingzhao-ji/trash-seg/commit/729bab0865c7d49f98db8bcb529dfa94e81b9d7f). Follow the repository's [local setup](../../website/README.md#local-setup): start a disposable MongoDB, install both Node packages, run the API on **5001**, and start Vite on **3000** with the matching API origin. Import the repository's sample bins only when preparing your own demonstration database. That import supplies sample locations, not the exact activity history captured here.

To repeat the product flow, open Student View → Report bin fullness → select Powell Library by name and QR → 3/4 Full → Submit. Show the confirmation, reload, and open Admin View → Bins → Powell Library → Investigate. If reusing an existing synthetic database, preserve it: another submission adds another report, so counts will differ from this recording.

Published evidence:

- [12.2-second silent recording](ZeroWaste-fixed-success-walkthrough.mp4)
- [Explicit bin and level selection](01-explicit-bin-selected.png)
- [Saved-report confirmation](02-report-saved-confirmation.png)
- [75% / Warning after reload](03-persisted-75-percent-after-reload.png)

The recording session's verification notes describe the initial synthetic fixture as 10 bins, 72 reports (42 current day, 30 previous day), one station, and impact totals of 42 compost / 68 recycle / 15 landfill. The real UI submission added one “3/4 Full” report for Powell Library. Total reports became 73, Powell changed from 48% to 75%, and Ackerman remained at 92%. Existing data was not reset. These are captured fixture values, not a promise about a fresh checkout's database.

For repeatable checks, follow the [fullness regression suite instructions](../../website/README.md#fullness-regression-suite). The suite uses its own temporary MongoDB and produces ignored screenshots and report/bin JSON evidence under `website/test-results/`. The recording machine's private runtime scripts and capture-only logs are not needed for this repository workflow. No production accounts or credentials are required.
