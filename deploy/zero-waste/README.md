# Run the original ZeroWaste demonstration

This deployment uses the real React/Vite interface, original Express/Mongoose API and MongoDB. It is not a static simulation. Campus records and activity are synthetic. Image segmentation is disabled; example sorting guidance is sample data.

## Local Docker setup

From the repository root, with Docker Compose installed:

    docker compose -f deploy/zero-waste/compose.yaml up --build

Open http://127.0.0.1:8080. The application and database containers share a private network. Only the app is bound to host loopback; MongoDB has no published port. A named volume preserves demonstration records. Never reuse a production database.

The initializer requires database name `zero_waste_demo`, seeds ten bins and 72 synthetic reports once, and refuses to reset a nonempty unmarked database. Re-running preserves submitted records. Public-demo mode permits only fullness and shared example-impact writes, limits writes to 30 attempts/minute/process and JSON to 64 KiB, and blocks administrative/model actions. This is not production authentication or comprehensive abuse protection.

## Browser walkthrough

1. Open Report bin fullness.
2. Explicitly select Powell Library — Main Floor.
3. Choose 3/4 Full and Submit.
4. Verify the saved confirmation, then reload and inspect the bin at 75%.
5. Existing README links provide a short recorded walkthrough and the full technical runbook.

## Verification on 2026-10-12

The production frontend build passed. Fourteen isolated real-MongoDB/Node HTTP checks passed: seed/counts, repeat seed preservation, wrong database refusal, health, frontend delivery, successful selected-bin report, blocked administrative/model/delete actions, write limiting, persistence and non-destructive reseeding. Separately, a real browser submitted a report (HTTP 201), displayed confirmation, reloaded, and the saved 75% value survived an application/MongoDB restart.

Container images and Docker Compose were not built or run in the verification environment; their definition remains unverified. No public backend URL is claimed. A temporary tunnel attempt was blocked by the test host's network. A public deployment additionally needs authorized hosting, HTTPS, request limits and a persistent database volume. This setup does not require GCP.
