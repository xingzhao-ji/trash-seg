# Campus Trash Sorting & Bin Monitoring Prototype

Full-stack demo app for a trash sorting assistant and bin monitoring system, designed primarily for phone browsers but also usable on desktop. The layouts and flows mirror the Student View and Admin View paper prototypes.

## Tech Stack

**Frontend**

- React 18
- Vite
- Plain JavaScript
- Single global CSS file (`src/styles.css`)
- `fetch`-based API wrapper in `src/api.js`

**Backend**

- Node.js (CommonJS)
- Express
- MongoDB + Mongoose
- `dotenv` for configuration (`MONGODB_URI`, optional `PORT`)

## Project Structure

```text
.
├── package.json          # Frontend (Vite + React)
├── vite.config.js
├── index.html
├── src
│   ├── main.jsx
│   ├── App.jsx
│   ├── api.js
│   └── styles.css
└── server
    ├── package.json
    ├── .env.example
    ├── server.js
    └── models
        ├── Station.js
        ├── Bin.js
        ├── OverviewStat.js
        ├── ProblemBin.js
        ├── FullnessReport.js
        └── StudentImpact.js
```

## Backend Setup

1. Start MongoDB locally or have an Atlas cluster ready.
2. Configure and run the backend:

```bash
cd server
npm install
cp .env.example .env
# Edit .env to point MONGODB_URI at your Mongo instance
npm start
# or for auto-reload:
npm run dev
```

On startup the server:

- Connects to MongoDB using `MONGODB_URI`.
- Seeds demo data only if the corresponding collections are empty:
  - One `Station`
  - 3–4 nearby `Bin`s
  - 4 `OverviewStat` docs
  - 3–4 `ProblemBin`s
  - One `StudentImpact` record for `demoStudent`

### API Endpoints

All responses are JSON:

- `GET /api/health` → `{ status: "ok" }`
- `GET /api/station/current` → current `Station`
- `GET /api/bins/nearby` → all `Bin` docs`
- `GET /api/admin/overview` → all `OverviewStat` docs
- `GET /api/admin/problem-bins` → all `ProblemBin` docs
- `GET /api/student/impact` → `StudentImpact` for `"demoStudent"` (or zeros)
- `POST /api/segment` → static array of 5 segmented items `{ id, label, stream }`
- `POST /api/bins/report-fullness`
  - Request body: `{ stationId, level }`
  - Response: `{ ok: true, id: "<mongo-id>" }`

Errors are logged on the server and returned as `500` with `{ "message": "Server error" }`.

## Frontend Setup

From the project root:

```bash
npm install
npm start   # alias for: npm run dev (vite)
```

By default Vite runs on `http://localhost:5173` and the backend on `http://localhost:5000`.

The frontend reads:

```js
VITE_API_BASE_URL || 'http://localhost:5000'
```

from `import.meta.env` in `src/api.js`. Set `VITE_API_BASE_URL` in a `.env` file at the project root if you want to point at a different backend.
