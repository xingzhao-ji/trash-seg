# Zero Waste deployment checkpoint — unfinished

Saved at the user's request before closing the local Mac. Stop point: deployment configuration and source edits exist, but production build, container build, seed execution, and deployment smoke tests have NOT been run for this branch. No GCP resources, account settings, billing, authentication, or firewalls were changed.

## Source and known-good baseline

- Public repository: https://github.com/xingzhao-ji/trash-seg
- Branch: `deploy/zero-waste-demo`
- Baseline: `3ed7a49e7a470eecd63bc3aae3c21bc1cbc073e5` (published corrected recording and README links).
- Fullness fix preserved: `729bab0865c7d49f98db8bcb529dfa94e81b9d7f`.
- Earlier baseline verification: 10 fullness regression tests passed with real browser/Express/disposable MongoDB, plus frontend build. Those results DO NOT verify the new deployment changes.
- This checkpoint: changed backend JavaScript passes `node --check`; `git diff --check` passes. Docker/Podman are unavailable on the local host, so no image was built.

## Included work

- `deploy/zero-waste/Dockerfile`: builds Vite and packages an Express runtime with Node 22; serves the frontend and API on one port. It deliberately omits Python/model weights.
- `deploy/zero-waste/compose.yaml`: app plus MongoDB 7.0 with a named `/data/db` volume; MongoDB has no published port; app binds host loopback port 8080 for a deployment worker's reverse proxy.
- `website/.dockerignore`: excludes local environment files, dependencies, and test outputs.
- `website/server/deployment/seed-demo.js`: synthetic 10-bin/72-report fixture with one station and shared example impact. Requires database name `zero_waste_demo`. Refuses existing nonempty unmarked data; seed marker prevents resetting a previously initialized demo. No delete/reset operation is provided.
- `website/server/deployment/start-demo.js`: seeds when `SEED_DEMO=1`, then starts the existing API.
- `website/server/deployment/public-demo.js`: when enabled, blocks admin/facilities/model writes, permits only fullness and impact POSTs, and limits the process to 30 write attempts per minute.
- `website/server/server.js`: opt-in public-demo guard, 64 KiB demo request limit, health status 503 when MongoDB is disconnected, and production static serving.
- `website/src/api.js`: production frontend uses same-origin API by default; development localhost still uses port 5001.

## Resume on the cloud computer

1. Clone the public repository and check out `deploy/zero-waste-demo`; use the checkpoint commit supplied with this handoff. The ZIP contains only the changed paths, for recovery if needed. It is not a complete source checkout.
2. Inspect the changes against the baseline before starting services. Preserve existing credentials and databases; none are included in this archive.
3. Verify a clean build with `docker compose -f deploy/zero-waste/compose.yaml config`, then `docker compose -f deploy/zero-waste/compose.yaml up --build -d` on a machine with Docker Compose. These are intended commands, NOT verified outcomes.
4. Check `http://127.0.0.1:8080/api/health`, the built frontend, initial fixture counts, explicit Powell-bin fullness submission, HTTP 201, and persistence after page/container restart. Confirm reseeding preserves records, admin/model writes return 403, and the demo write budget returns 429.
5. Run the existing `website` Playwright regression suite against its own disposable MongoDB. It should not alter the persistent demo volume.
6. Only the primary deployment worker should select GCP resources, handle account permissions, configure HTTPS/ingress, or publish the URL.

## Minimal database and public-demo constraints

Use a dedicated synthetic MongoDB database and durable volume. Container-local filesystems are insufficient for database persistence. The Compose MongoDB service is private to the container network and has no credentials; do not publish its port or move this setup into an untrusted shared network without appropriate authentication/network controls. An application container on Cloud Run still needs a separately reachable persistent MongoDB; MongoDB cannot be treated as ephemeral Cloud Run storage.

Use one application/seed initializer initially. The seed is not transactionally locked against multiple concurrent initializers; partial failure can leave an unmarked nonempty database and correctly refuse the next seed attempt. Do not automatically delete that database. The write budget is per process, resets on restart, and is not distributed authentication or comprehensive abuse protection. Public readers can still generate database load; keep resource/instance limits bounded. Demo reports and histories grow with accepted writes, so persistence/retention needs an explicit operator policy.

Model inference is omitted and blocked in demo mode. The UI's example sorting flow remains sample data. Admin read views and shared demo impact are not private user accounts. Publish only with clear synthetic-demo labeling. Application authorization, transactional crash recovery, model quality, production hardening, and real campus use remain outside this checkpoint.

## Archive safety

The recovery archive contains an explicit allowlist of these deployment/source changes and this handoff. It excludes `.env`, credentials, database files, dependencies, `.git`, repository history, and historical secrets. Existing public demo media stays in the public repository. No real Atlas URI or private user data is included.
