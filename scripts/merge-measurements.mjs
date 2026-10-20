// Merge a phase's measurements.json into its results.json, without re-running
// the whole capture.
//   node scripts/merge-measurements.mjs <phase> [tag]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
const phase = process.argv[2] ?? 'orders';
const tag = process.argv[3] ?? '';
const dir = resolve(process.cwd(), 'evidence', `${phase}${tag ? '-' + tag : ''}`);
const resultsFile = `${dir}/results.json`;
const measurementsFile = `${dir}/measurements.json`;

if (!existsSync(resultsFile)) throw new Error(`no results.json in ${dir}`);
if (!existsSync(measurementsFile)) throw new Error(`no measurements.json in ${dir}`);

const results = JSON.parse(readFileSync(resultsFile, 'utf8'));
results.measurements = JSON.parse(readFileSync(measurementsFile, 'utf8'));
writeFileSync(resultsFile, JSON.stringify(results, null, 2));
console.log(`merged measurements into ${resultsFile}`);
