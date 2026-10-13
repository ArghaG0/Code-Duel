# Original function problems

`data/problems.json` contains 24 original plain-text problems (10 Easy, 9 Medium, 5 Hard), each with six visible test cases. It contains no reference or alternative solutions.

From the repository root:

```powershell
node server/scripts/seedProblems.js
node server/scripts/seedProblems.js --write
```

The default is a database-reading dry run. Both modes load the root `.env` and print only the database name and counts. Write mode inserts missing exact titles without updating existing documents. It requires the successful local verification report to match both the current data and controller hashes.

```powershell
node server/scripts/seedProblems.js --rollback
```

Rollback is destructive only for records in `seeded-titles.json`: it matches both the recorded ID and title and checks the database-configuration fingerprint. Keep this ledger until rollback is no longer needed. Repeated writes preserve earlier entries. A reserved ID is journaled before each insert so an interruption does not lose rollback information. Run only one seed process at a time; the product schema does not enforce unique titles. No rollback is performed automatically.

Private authoring and verification files live in ignored `test/server/problem-set/`, outside both Docker build contexts. `solutions.json` maps each title to its function name, reference solution, independent alternative, and hand-checked example. `verification.json` records exact-runtime results. These files are intentionally unavailable in a fresh clone or product image; preserve them separately for future re-verification.

The local verifier runs the unchanged submission controller with its database lookup replaced by an in-memory fixture and its Axios call replaced by a separate Node process for each case. Each process has a ten-second timeout. It makes no Piston or database requests. The controller itself constructs the harness and compares the last result marker. Verification used the exact `node:18.15.0-alpine` image, with read-only mounts, not copied answer files.

To regenerate data locally, run `node test/server/problem-set/build.cjs`. Then rerun verification (PowerShell, from the repository root):

```powershell
$repo = (Get-Location).Path
$result = docker run --rm --mount "type=bind,source=$repo\test\server\problem-set,target=/verification,readonly" --mount "type=bind,source=$repo\server\scripts\data\problems.json,target=/problems.json,readonly" --mount "type=bind,source=$repo\server\controllers\code.controller.js,target=/controller.js,readonly" node:18.15.0-alpine node /verification/verify.cjs
if ($LASTEXITCODE -ne 0) { throw 'Verification failed' }
[System.IO.File]::WriteAllText("$repo\test\server\problem-set\verification.json", ($result -join "`n"))
node --test test/server/problem-set/seed.test.cjs
```

The live app still requires a working `PISTON_URL`. Local verification does not repair or verify that service. Matchmaking samples the entire standard problem collection, including older problems. Custom-room creation without a template samples a standard problem; the dashboard's template workflow uses separately authored CustomProblem records. This seed creates no room templates.
