import { readFileSync } from 'node:fs';
const text = readFileSync(new URL('../src/data/seedMatches.ts', import.meta.url), 'utf8');
const matches = [...text.matchAll(/"matchNo"\s*:\s*(\d+)[\s\S]*?"round"\s*:\s*"([^"]+)"/g)].map((m) => ({ matchNo: Number(m[1]), round: m[2].trim() }));
const fail = (msg) => { console.error(`❌ ${msg}`); process.exit(1); };
if (matches.length !== 72) fail(`seedMatches rows should be 72 group-stage rows from the uploaded Excel reference, got ${matches.length}`);
for (let i = 1; i <= 72; i += 1) if (matches[i - 1]?.matchNo !== i) fail(`matchNo must be continuous 1-72; row ${i} is ${matches[i - 1]?.matchNo}`);
const bad = text.match(/TBD|待定|football-data|Sportsbet.*抓|setInterval|api\/results|api\/sportsbet/);
if (bad) fail(`seed/app source should not contain forbidden placeholder or automation token: ${bad[0]}`);
console.log('✅ seedMatches validation passed: 72 uploaded Excel group-stage rows, matchNo 1-72 continuous, no forbidden placeholders.');
