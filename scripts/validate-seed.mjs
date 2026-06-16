import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const tmpRoot = mkdtempSync(path.join(tmpdir(), 'seed-validation-'));
const fail = (msg) => { console.error(`❌ ${msg}`); process.exit(1); };

try {
  for (const relativePath of ['src/utils/score.ts', 'src/types.ts', 'src/data/seedMatches.ts']) {
    const sourcePath = path.join(repoRoot, relativePath);
    const outputPath = path.join(tmpRoot, relativePath.replace(/\.ts$/, '.js'));
    mkdirSync(path.dirname(outputPath), { recursive: true });
    const source = readFileSync(sourcePath, 'utf8');
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
        resolveJsonModule: true,
      },
      fileName: sourcePath,
    }).outputText;
    writeFileSync(outputPath, transpiled);
  }

  const referenceSourcePath = path.join(repoRoot, 'reference/seedMatches.from_excel.json');
  const referenceOutputPath = path.join(tmpRoot, 'reference/seedMatches.from_excel.json');
  mkdirSync(path.dirname(referenceOutputPath), { recursive: true });
  writeFileSync(referenceOutputPath, readFileSync(referenceSourcePath, 'utf8'));

  const requireFromTemp = createRequire(path.join(tmpRoot, 'scripts/validate-seed.mjs'));
  const { seedMatches } = requireFromTemp(path.join(tmpRoot, 'src/data/seedMatches.js'));

  if (seedMatches.length !== 104) fail(`seedMatches rows should keep the full 104-match tournament structure, got ${seedMatches.length}`);
  for (let i = 1; i <= 104; i += 1) {
    if (seedMatches[i - 1]?.matchNo !== i) fail(`matchNo must be continuous 1-104; row ${i} is ${seedMatches[i - 1]?.matchNo}`);
  }

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
  const actualRoundCounts = seedMatches.reduce((counts, match) => counts.set(match.round, (counts.get(match.round) ?? 0) + 1), new Map());
  for (const [round, expectedCount] of expectedRoundCounts) {
    const actualCount = actualRoundCounts.get(round) ?? 0;
    if (actualCount !== expectedCount) fail(`${round} should have ${expectedCount} row(s), got ${actualCount}`);
  }
  for (const round of actualRoundCounts.keys()) {
    if (!expectedRoundCounts.has(round)) fail(`unexpected round found in seedMatches: ${round}`);
  }

  const appSource = ['src/data/seedMatches.ts']
    .map((relativePath) => readFileSync(path.join(repoRoot, relativePath), 'utf8'))
    .join('\n');
  const bad = appSource.match(/football-data|Sportsbet.*抓|setInterval|api\/results|api\/sportsbet/);
  if (bad) fail(`seed/app source should not contain forbidden automation token: ${bad[0]}`);

  console.log('✅ seedMatches validation passed: 104 rows, matchNo 1-104 continuous, expected round counts, no forbidden automation tokens.');
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}
