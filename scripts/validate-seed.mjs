import { readFileSync } from 'node:fs';
const text = readFileSync(new URL('../src/data/seedMatches.ts', import.meta.url), 'utf8');
const matches = [...text.matchAll(/"matchNo"\s*:\s*(\d+)[\s\S]*?"round"\s*:\s*"([^"]+)"/g)].map((m) => ({ matchNo: Number(m[1]), round: m[2].trim() }));
const expected = new Map([
  ['第1轮', 24], ['第2轮', 24], ['第3轮', 24], ['1/16决赛', 16], ['1/8决赛', 8], ['1/4决赛', 4], ['半决赛', 2], ['Third Place Playoff', 1], ['决赛', 1],
]);
const fail = (msg) => { console.error(`❌ ${msg}`); process.exit(1); };
if (matches.length !== 104) fail(`seedMatches rows should be 104, got ${matches.length}`);
for (let i = 1; i <= 104; i += 1) if (matches[i - 1]?.matchNo !== i) fail(`matchNo must be continuous 1-104; row ${i} is ${matches[i - 1]?.matchNo}`);
const counts = new Map();
for (const m of matches) counts.set(m.round, (counts.get(m.round) ?? 0) + 1);
for (const [round, count] of expected) if (counts.get(round) !== count) fail(`${round} should have ${count}, got ${counts.get(round) ?? 0}`);
console.log('✅ seedMatches validation passed: 104 rows, matchNo 1-104 continuous, round counts correct.');
