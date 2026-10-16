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

The local verifier runs the real submission controller and isolated-vm sandbox, replacing only database lookups with fixtures. It compares every reference solution with six expected cases and an independent alternative. The verification report binds the data, controller and sandbox hashes and requires Node 22.x; it replaces the earlier Node 18.15.0 report.

From the repository root:

```powershell
node --no-node-snapshot test/server/problem-set/verify.cjs
node --no-node-snapshot --test test/server/problem-set/seed.test.cjs
```

The verifier writes test/server/problem-set/verification.json. No database writes occur during verification. To regenerate authored data first, use node test/server/problem-set/build.cjs, then rerun verification.

The fixture-backed HTTP check is node --no-node-snapshot test/helpers/sandbox-http.cjs. It starts the actual server, uses real JWT middleware, routes, controller and sandbox, and checks all 144 cases without loading .env or accessing MongoDB. The private sandbox.test.cjs suite covers resource limits and isolation.

Matchmaking samples the whole standard problem collection. This seed creates no room templates.
