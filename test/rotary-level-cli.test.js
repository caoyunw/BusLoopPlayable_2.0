import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateLevelDocument } from '../tools/rotary-level-contract/validate.js';
import { applyDocument } from '../scripts/rotary-level.mjs';
import {
  convertDocumentToRuntimeLayout,
  exportLevel18Document,
  getCurrentLevel18ContextPayload
} from '../scripts/rotary-level-adapters/level18.mjs';
import { renderGeneratedLayout } from '../scripts/rotary-level-source.mjs';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const cliPath = fileURLToPath(
  new URL('../scripts/rotary-level.mjs', import.meta.url)
);

function runCli(argumentsList) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...argumentsList], {
      cwd: repositoryRoot,
      windowsHide: true
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('level18 adapter exports current vehicles, ownership, lanes, and read-only geometry', async () => {
  const document = await exportLevel18Document();
  assert.equal(document.target.levelId, 'GameSceneDualQueue2/18');
  assert.equal(document.vehicles.length, 47);
  assert.equal(document.rotaryLanes[0].slots.length, 6);
  assert.deepEqual(
    document.rotaryLanes[0].slots.map(({ id }) => id),
    ['slot-01', 'slot-02', 'slot-03', 'slot-04', 'slot-05', 'slot-06']
  );
  assert.deepEqual(
    document.vehicles
      .filter(({ placement }) => placement.kind === 'rotary-slot')
      .map(({ id }) => id),
    [56, 55, 32, 31, 28, 35]
  );
  assert.equal(
    document.vehicles.filter(({ placement }) => placement.kind === 'garage').length,
    16
  );
  assert.equal(document.context.garages.length, 2);
  assert.deepEqual(
    document.context.allowedColorIndexes,
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  );
  assert.deepEqual(validateLevelDocument(document).errors, []);
});

test('context payload excludes editable vehicles and lanes', () => {
  const payload = getCurrentLevel18ContextPayload();
  assert.equal(payload.target.levelId, 'GameSceneDualQueue2/18');
  assert.equal(Object.hasOwn(payload, 'vehicles'), false);
  assert.equal(Object.hasOwn(payload, 'rotaryLanes'), false);
  assert.equal(payload.context.parkingSpots.length, 6);
  assert.equal(payload.context.passengerQueues.length, 2);
});

test('validate command returns non-zero and stable JSON paths for invalid input', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'busloop-rotary-cli-'));
  try {
    const invalidPath = join(directory, 'invalid.json');
    const invalid = await exportLevel18Document();
    invalid.vehicles[1].id = invalid.vehicles[0].id;
    await writeFile(invalidPath, JSON.stringify(invalid), 'utf8');
    const result = await runCli(['validate', '--input', invalidPath]);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /vehicle\.duplicate-id/);
    assert.match(result.stderr, /\/vehicles\/1\/id/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('export command writes canonical current JSON and rejects unknown flags', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'busloop-rotary-export-'));
  try {
    const outputPath = join(directory, 'level.json');
    const exported = await runCli([
      'export',
      '--level',
      'GameSceneDualQueue2/18',
      '--out',
      outputPath
    ]);
    assert.equal(exported.code, 0, exported.stderr);
    const document = JSON.parse(await readFile(outputPath, 'utf8'));
    assert.equal(document.vehicles.length, 47);
    const rejected = await runCli(['validate', '--wat', outputPath]);
    assert.equal(rejected.code, 1);
    assert.match(rejected.stderr, /Unknown flag --wat/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('adapter source stays isolated from game and scene runtime modules', async () => {
  const source = await readFile(
    new URL('../scripts/rotary-level-adapters/level18.mjs', import.meta.url),
    'utf8'
  );
  assert.doesNotMatch(source, /game-model\.js|scene-view\.js|mechanics\//);
  const sceneSource = await readFile(
    new URL('../src/scene-view.js', import.meta.url),
    'utf8'
  );
  assert.match(sceneSource, /roadWidth:\s*0\.42/);
});

test('generated source is deterministic and deeply frozen', async () => {
  const document = await exportLevel18Document();
  const layout = convertDocumentToRuntimeLayout(document);
  const source = renderGeneratedLayout(layout);
  assert.match(source, /export const LEVEL18_ROTARY_LAYOUT/);
  assert.match(source, /deepFreeze/);
  assert.equal(source, renderGeneratedLayout(layout));
});

test('dry run and invalid apply leave target bytes unchanged', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'busloop-rotary-apply-'));
  try {
    const target = join(directory, 'layout.js');
    const marker = 'export const marker = 1;\n';
    await writeFile(target, marker, 'utf8');
    const document = await exportLevel18Document();
    const dryRun = await applyDocument(document, { target, dryRun: true });
    assert.equal(dryRun.changed, true);
    assert.equal(await readFile(target, 'utf8'), marker);

    const invalid = structuredClone(document);
    invalid.vehicles[1].id = invalid.vehicles[0].id;
    await assert.rejects(
      () => applyDocument(invalid, { target }),
      /validation failed/
    );
    assert.equal(await readFile(target, 'utf8'), marker);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('same document applies idempotently', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'busloop-rotary-idempotent-'));
  try {
    const target = join(directory, 'layout.js');
    await writeFile(target, '', 'utf8');
    const document = await exportLevel18Document();
    const first = await applyDocument(document, { target });
    const second = await applyDocument(document, { target });
    assert.equal(first.changed, true);
    assert.equal(second.changed, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('exported canonical level regenerates the checked-in runtime source byte-for-byte', async () => {
  const document = await exportLevel18Document();
  const expected = renderGeneratedLayout(convertDocumentToRuntimeLayout(document));
  const actual = await readFile(
    new URL('../src/levels/generated/level18-rotary-layout.js', import.meta.url),
    'utf8'
  );
  assert.equal(actual, expected);
});
