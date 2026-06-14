import { readFileSync } from 'node:fs';

const text = readFileSync(new URL('../src/data/seedMatches.ts', import.meta.url), 'utf8');
const matches = [...text.matchAll(/"matchNo"\s*:\s*(\d+)[\s\S]*?"round"\s*:\s*"([^"]+)"/g)].map((m) => ({ matchNo: Number(m[1]), round: m[2].trim() }));
const fail = (msg) => { console.error(`❌ ${msg}`); process.exit(1); };

if (matches.length !== 104) fail(`seedMatches rows should keep the full 104-match tournament structure, got ${matches.length}`);
for (let i = 1; i <= 104; i += 1) if (matches[i - 1]?.matchNo !== i) fail(`matchNo must be continuous 1-104; row ${i} is ${matches[i - 1]?.matchNo}`);

const expectedRoundCounts = new Map([
  ['第1轮', 24],
  ['第2轮', 24],
  ['第3轮', 24],
  ['1/16决赛', 16],
  ['1/8决赛', 8],
  ['1/4决赛', 4],
  ['半决赛', 2],
  ['Third Place Playoff', 1],
  ['决赛', 1],
]);
const actualRoundCounts = matches.reduce((counts, match) => counts.set(match.round, (counts.get(match.round) ?? 0) + 1), new Map());
for (const [round, expectedCount] of expectedRoundCounts) {
  const actualCount = actualRoundCounts.get(round) ?? 0;
  if (actualCount !== expectedCount) fail(`${round} should have ${expectedCount} row(s), got ${actualCount}`);
}
for (const round of actualRoundCounts.keys()) {
  if (!expectedRoundCounts.has(round)) fail(`unexpected round found in seedMatches: ${round}`);
}

const bad = text.match(/TBD|待定|football-data|Sportsbet.*抓|setInterval|api\/results|api\/sportsbet/);
if (bad) fail(`seed/app source should not contain forbidden placeholder or automation token: ${bad[0]}`);
console.log('✅ seedMatches validation passed: 104 rows, matchNo 1-104 continuous, expected round counts, no forbidden placeholders.');
