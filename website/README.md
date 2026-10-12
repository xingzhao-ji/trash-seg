# Zero Waste web app

The web app provides student bin browsing, map and detail views, a fullness-reporting flow, image-based sorting, and an admin overview. It is a prototype backed by Express and MongoDB. The facilities import and reporting code supports experimentation with bin data; it does not establish a live UCLA Facilities integration.

For the project evaluation and team credits, see the [repository README](../README.md).

## Code layout

| Path | Purpose |
| --- | --- |
| [src/App.jsx](src/App.jsx) | Student and admin screens and their state |
| [src/api.js](src/api.js) | API-origin configuration, response errors, and request timeouts |
| [src/CameraCapture.jsx](src/CameraCapture.jsx) | Browser camera capture |
| [src/MapView.jsx](src/MapView.jsx) | Leaflet bin map |
| [server/server.js](server/server.js) | Express routes and Python subprocess integration |
| [server/models](server/models) | Station, bin, report, impact, and dashboard schemas |
| [server/services/facilitiesIntegration.js](server/services/facilitiesIntegration.js) | Bin imports, distance calculations, and reports |
| [server/ucla_bins_sample.json](server/ucla_bins_sample.json) | Ten sample bin locations |

## Local setup

### Requirements

- Node.js 20 or newer and npm for the locked app dependencies and Playwright tests.
- A development MongoDB instance, local or under your control.
- A browser with location and camera permissions for those features. Mobile camera access normally needs HTTPS; localhost is suitable for desktop development.
- Python and the [ML dependencies](../ML-seg/README.md) only for real segmentation.

Use a disposable database and your own configuration. The commands below pass an explicit local MongoDB URI. Alternatively, copy `server/.env.example` to an ignored `server/.env` and configure it locally; the example contains only a local URI without credentials. Preserve an existing local `.env` rather than overwriting it. Never reuse credentials from older commits.

### 1. Start the API

From the repository root, with MongoDB already running:

```bash
cd website/server
npm ci
MONGODB_URI=mongodb://127.0.0.1:27017/zero_waste_dev PORT=5001 npm start
```

For automatic server reloads, use the same environment variables with `npm run dev`.

The server connects before listening. On startup it creates a default station if needed and updates overview statistics, then repeats the statistics update every five minutes. A fresh database has no bin locations until you import or create them.

Check the API from another terminal:

```bash
curl --fail http://localhost:5001/api/health
```

A running server reports `status: "ok"` and `mongodb: "connected"`.

### 2. Import sample bins

This writes ten sample locations to the development database and creates an import-report JSON file in the current directory. From `website/server`:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/zero_waste_dev \
  node importFacilityData.js ucla_bins_sample.json
```

The importer accepts JSON shaped as `{ "bins": [...] }`. See the [sample file](server/ucla_bins_sample.json) for fields such as `facilityId`, `name`, latitude/longitude, and supported streams. These are sample records, not evidence of an official facilities data feed.

### 3. Start the frontend

From the repository root in a separate terminal:

```bash
cd website
npm ci
VITE_API_BASE_URL=http://localhost:5001 npm run dev
```

Vite requests port **3000** and opens the browser. Check its terminal output in case that port is occupied.

Set `VITE_API_BASE_URL` to the API **origin**, without an `/api` suffix: the helper adds endpoint paths itself. Restart Vite after changing its environment.

The API, localhost helper, and Vite `/api` proxy all default to **5001**. If you choose a different backend port, update the frontend origin too; if relying on the relative `/api` proxy, update its target in `vite.config.js`. On a phone, use the development computer's reachable address for both services; `localhost` on the phone points to the phone.

### 4. Enable real segmentation, if needed

Set up the Python environment from [ML-seg/README.md](../ML-seg/README.md). The server looks for `.venv/bin/python3` at the repository root, then falls back to `python3` on PATH. Set `SAM_TRASHNET_PYTHON` to another interpreter's absolute path when needed; this also supports a Windows virtual environment.

`POST /api/segment` accepts `imageBase64` and optional normalized `points`, runs `ML-seg/run_sam_maskrcnn_fusion.py`, and returns an overlay and mask metadata. Images and outputs are written to a temporary directory and removed after the request.

The UI's **Use example results** action supplies fixed sample items. It lets you inspect the sorting flow without inference and is labeled as example data. The separate YOLO preview script is not called by this API route.

## Configuration

| Variable | Where it is read | Meaning |
| --- | --- | --- |
| `MONGODB_URI` | API and import tools | Required database URI |
| `PORT` | API | Defaults to `5001` |
| `SAM_TRASHNET_PYTHON` | API | Optional Python interpreter override |
| `VITE_API_BASE_URL` | Frontend | API origin, embedded at dev-server start/build time |

The shared helper normally times out after **10 seconds**, uses **5 seconds** for its connection check, and allows **120 seconds** for segmentation. The server's Python subprocess has no corresponding timeout, so a timed-out browser request does not establish that inference has stopped.

## Main API routes

| Method and path | Use |
| --- | --- |
| `GET /api/health` | Server and database status |
| `GET /api/station/current` | Current station |
| `GET /api/bins/nearby` | Active bins; optional latitude, longitude, and radius in meters |
| `GET /api/bins/:id/stats` | Per-bin statistics |
| `POST /api/bin` | Create a bin |
| `POST /api/bins/report-fullness` | Save a fullness report for an explicitly selected active bin |
| `GET /api/admin/overview`, `GET /api/admin/problem-bins` | Dashboard data |
| `GET /api/student/impact`, `POST /api/student/impact` | Shared demo impact counters |
| `POST /api/segment` | SAM + Trash-Net inference |
| `POST /api/facilities/update-bins` | Bulk bin import |
| `POST /api/facilities/sync-contamination` | Import contamination values |
| `GET /api/facilities/report` | Report over a date range |

These routes are implemented in [server/server.js](server/server.js). The `admin` and `facilities` route names do not provide authentication or authorization.

### Fullness reporting

From **Student View → Report bin fullness**, choose a bin and a fullness level, then submit. **Use This Bin** in the nearby list preselects that bin; you can change it in the report form. A fresh visit does not select the first bin automatically. The current station and a bin are separate records, so neither a station ID nor a QR code is substituted for a bin ID.

The request body is `{ "binId": "<selected Bin._id>", "level": "3/4 Full" }`. Accepted levels are `Empty`, `1/4 Full`, `Half Full`, `3/4 Full`, `Full`, and `Overflowing`, mapped to 0, 25, 50, 75, 90, and 100 percent. A successful request returns **201** with the report `id` and updated `bin`, saves a `FullnessReport.bin` reference, and updates the bin's fullness, status, history, and last-report time. Invalid input returns **400**; a missing or inactive bin returns **404**. Failed requests leave the form open with a visible error and preserve the selection for retry.

Statistics read new `bin` references and retain compatibility with historical reports that stored a bin ID in `station`. No automatic station-to-bin mapping or database migration is performed.

## Validation

From `website`, build the frontend:

```bash
npm run build
```

This creates `dist/`. For a build configured to use the local API, set `VITE_API_BASE_URL=http://localhost:5001` on the build command. To inspect that build, run `npm run preview`; the API must still run separately. Vite's preview server is a local inspection tool, not the backend.

Without starting MongoDB or Python, parse the server files:

```bash
# From the repository root
find website/server -path '*/node_modules' -prune -o -name '*.js' -exec node --check {} \;
```

With the API configured against a disposable database, these requests exercise a read and an invalid-input path:

```bash
curl --fail http://localhost:5001/api/bins/nearby
curl -i 'http://localhost:5001/api/bins/nearby?latitude=100&longitude=0'
```

The second request should return HTTP **400** for an invalid latitude. Review bin browsing, filters, detail views, camera permission handling, example-result labeling, and the admin overview in the browser. A successful frontend build alone does not validate these interactions.

### Fullness regression suite

Install MongoDB Community Server so `mongod` is on PATH, or set `MONGOD_BINARY` to its executable. With both Node packages installed, run from `website`:

```bash
npx playwright install chromium
npm test
```

Alternatively, use an existing Chrome executable instead of downloading Playwright's browser. This is the command used on the review machine:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm test
```

The suite starts its own MongoDB in a temporary directory, launches the real Express API and Vite on available local ports, and seeds a station plus two distinct bins. It does not use your `MONGODB_URI`, load the server's `.env`, invoke inference, or contact a hosted database. The processes and temporary database are removed afterward. Screenshots and persistence evidence are written to ignored `test-results/` directories.

The ten tests cover explicit selection of the second bin, **Use This Bin**, confirmation and persistence after reload, a real 404 with visible error and retry, duplicate-click protection, an empty bin list, invalid requests, all six levels, failed database writes, and compatibility with historical report statistics. `server/checkSetup.js` and `server/generateTestData.js` remain separate utilities that connect to or mutate whichever database you configure; they are not part of this isolated suite.

Verified on **2026-10-12** with Node.js 26.7.0, MongoDB 7.0.20, Playwright 1.64.0, and local Chrome: all **10 regression tests passed**, `npm run build` passed with Vite 5.4.21, and the changed server files passed `node --check`. The browser submitted a selected bin ID, the API returned 201, MongoDB contained the report and 75% bin state, and the detail screen still showed 75% after reload. Model inference, camera hardware, real facilities imports, and a campus deployment were **not tested** by this suite.

## Known limitations

- **Write recovery:** fullness reports and bin updates are separate writes so local standalone MongoDB is supported. A rejected bin update removes the newly inserted report; an abrupt process or database failure between writes is not covered by a transaction. The UI prevents duplicate clicks during a pending request, but retries after a lost response are not idempotent.
- **Demo identity and permissions:** impact is stored under one `demoStudent` record, and the API has no authentication middleware for admin or facilities writes. Use only a development environment with synthetic data.
- **Metrics need context:** “Scans Today” counts fullness-report records, not camera inference requests. Some fallback problem-bin metrics are placeholders. Sorting results update impact only when the user completes the sorting flow.
- **Model scope:** the current classifier mapping covers recycling and landfill labels, with no compost class mapping. The UI's compost example is sample data.
- **Evaluation scope:** controlled usability testing was conducted; a real campus pilot, systematic accuracy measurement, and contamination-reduction study were future work.
- **Reproducibility:** Python dependencies use lower bounds rather than a lockfile, and first-run model downloads and inference time depend on the machine.

See [the project write-up](../Blog-Post.md) for the team's original evaluation and proposed improvements.
