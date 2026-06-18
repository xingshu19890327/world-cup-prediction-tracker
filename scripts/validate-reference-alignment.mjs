import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const referencePath = path.join(repoRoot, 'reference/seedMatches.from_excel.json');
const fieldsToCompare = [
  'matchNo',
  'group',
  'round',
  'australiaTime',
  'homeTeam',
  'awayTeam',
  'city',
  'actualScore',
  'actualResult',
  'completionStatus',
  'claudePredictedScore1',
  'claudePredictedScore2',
  'claudePredictedScore3',
  'claudeWdlPrediction',
  'claudeCorrespondingSbWdlOdds',
  'sbHomeOdds',
  'sbDrawOdds',
  'sbAwayOdds',
  'chatgptWdlPrediction',
  'chatgptPredictedScore1',
  'chatgptPredictedScore2',
  'chatgptPredictedScore3',
  'notes',
  'oddsSource',
  'preMatchNotes',
  'postMatchReview',
  'focusLevel',
];

const normalize = (value) => value === undefined ? '' : value;
const formatValue = (value) => JSON.stringify(normalize(value));

const referenceRows = JSON.parse(readFileSync(referencePath, 'utf8'));
const tmpRoot = mkdtempSync(path.join(tmpdir(), 'seed-reference-validation-'));

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

  const referenceOutputPath = path.join(tmpRoot, 'reference/seedMatches.from_excel.json');
  mkdirSync(path.dirname(referenceOutputPath), { recursive: true });
  writeFileSync(referenceOutputPath, readFileSync(referencePath, 'utf8'));

  const requireFromTemp = createRequire(path.join(tmpRoot, 'scripts/validate-reference-alignment.mjs'));
  const { seedMatches } = requireFromTemp(path.join(tmpRoot, 'src/data/seedMatches.js'));

  const referenceByMatchNo = new Map(referenceRows.map((row) => [row.matchNo, row]));
  const mismatches = [];

  if (seedMatches.length !== referenceRows.length) {
    mismatches.push({ matchNo: '<all>', field: '<row-count>', reference: referenceRows.length, seed: seedMatches.length });
  }

  for (const seedRow of seedMatches) {
    const referenceRow = referenceByMatchNo.get(seedRow.matchNo);
    if (!referenceRow) {
      mismatches.push({ matchNo: seedRow.matchNo, field: '<row>', reference: '<missing>', seed: '<present>' });
      continue;
    }

    for (const field of fieldsToCompare) {
      const referenceValue = normalize(referenceRow[field]);
      const seedValue = normalize(seedRow[field]);
      if (referenceValue !== seedValue) {
        mismatches.push({ matchNo: seedRow.matchNo, field, reference: referenceValue, seed: seedValue });
      }
    }
  }

  if (mismatches.length > 0) {
    console.error(`❌ reference alignment validation failed: ${mismatches.length} mismatch(es).`);
    for (const mismatch of mismatches) {
      console.error(`matchNo: ${mismatch.matchNo}`);
      console.error(`field: ${mismatch.field}`);
      console.error(`reference: ${formatValue(mismatch.reference)}`);
      console.error(`seedMatches: ${formatValue(mismatch.seed)}`);
    }
    process.exit(1);
  }

  console.log(`✅ reference alignment validation passed: all 104 seedMatches rows match reference values by matchNo, including model prediction fields.`);
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}
