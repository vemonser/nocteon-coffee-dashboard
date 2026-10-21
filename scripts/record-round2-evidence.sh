#!/usr/bin/env bash
# Record the Round-2 evidence in the manifest.
#
#   scripts/record-round2-evidence.sh
#
# Every criterion is recorded with the REAL command that checks it (the
# verifier, the unit tests, the e2e suite) and the artifact that carries
# the proof. The evidence gate reads the recorded exit codes.
set -euo pipefail

cd "$(dirname "$0")/.."

GATE="${SOFTWARE_FACTORY_GATE:-/home/abdelrhman/.config/opencode/skills/software-factory/bin/evidence-gate.cjs}"
M=".quality/runs/dashboard-r2/evidence-manifest.json"
RUN=".quality/runs/dashboard-r2"

MEASUREMENTS="evidence/dashboard-r2/measurements.json"
COLOURS="evidence/dashboard-r2/color-math.json"
RESULTS="evidence/dashboard-r2/results.json"
EN="evidence/dashboard-r2/en-light/dashboard-1440.png"
AR="evidence/dashboard-r2/ar-dark/dashboard-1440.png"
SUMMARY="evidence/dashboard-r2/e2e/summary-line-ar-dark.png"

record() {
  local id="$1" type="$2" artifact="$3"
  node "$GATE" record "$M" "$id" --type "$type" --artifact "$artifact" \
    -- node scripts/verify-round2.mjs "$id" | tail -1
}

# ── the behaviour criteria: the measurement, the colour maths, the matrix ──
record AC-01 integration-test "$MEASUREMENTS"
record AC-02 integration-test "$MEASUREMENTS"
record AC-04 integration-test "$MEASUREMENTS"
record AC-06 integration-test "$MEASUREMENTS"
record AC-07 integration-test "$MEASUREMENTS"
record AC-24 integration-test "$RESULTS"
record AC-24 screenshot "$EN"

# ── the visual criteria: a screenshot AND the measurement behind it ────────
record AC-03 screenshot "$EN"
record AC-03 e2e "$RESULTS"
record AC-05 screenshot "$EN"
record AC-05 integration-test "$MEASUREMENTS"
record AC-08 screenshot "$AR"
record AC-08 e2e "$RESULTS"
record AC-09 screenshot "$SUMMARY"
record AC-09 integration-test "$SUMMARY"
record AC-10 screenshot "$EN"
record AC-10 integration-test "$MEASUREMENTS"
record AC-11 screenshot "$EN"
record AC-11 integration-test "$MEASUREMENTS"
record AC-12 screenshot "$EN"
record AC-12 integration-test "$MEASUREMENTS"
record AC-13 screenshot "$EN"
record AC-13 integration-test "$MEASUREMENTS"
record AC-14 screenshot "$AR"
record AC-14 static-analysis "$COLOURS"
record AC-15 screenshot "$AR"
record AC-15 static-analysis "$COLOURS"
record AC-16 screenshot "$EN"
record AC-16 integration-test "$MEASUREMENTS"
record AC-17 screenshot "$EN"
record AC-17 integration-test "$MEASUREMENTS"
record AC-18 screenshot "$EN"
record AC-18 integration-test "$MEASUREMENTS"
record AC-19 screenshot "$EN"
record AC-19 integration-test "$MEASUREMENTS"
record AC-20 screenshot "$EN"
record AC-20 integration-test "$MEASUREMENTS"
record AC-21 screenshot "$EN"
record AC-21 integration-test "$MEASUREMENTS"
record AC-22 screenshot "$EN"
record AC-22 integration-test "$MEASUREMENTS"
record AC-23 screenshot "$AR"
record AC-23 integration-test "$MEASUREMENTS"
record AC-25 screenshot "$EN"
record AC-25 integration-test "$RESULTS"

# ── the real test runs, with their own exit codes ─────────────────────────
node "$GATE" record "$M" AC-19 --type unit-test --artifact "$RUN/unit-tests.log" --log -- npm run test:unit | tail -1
node "$GATE" record "$M" AC-25 --type unit-test --artifact "$RUN/unit-tests.log" --log -- npm run test:unit | tail -1
node "$GATE" record "$M" AC-25 --type e2e --artifact "$RUN/e2e-round2.log" --log -- npx playwright test e2e/dashboard-round2.spec.ts --reporter=line | tail -1

# ── the gate ───────────────────────────────────────────────────────────────
node "$GATE" validate "$M"
