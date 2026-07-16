import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalStringify } from '../tools/rotary-level-contract/document.js';
import { computeContextFingerprint } from '../tools/rotary-level-contract/fingerprint.js';
import { validateLevelDocument } from '../tools/rotary-level-contract/validate.js';
import {
  LEVEL18_ID,
  LEVEL18_OUTPUT,
  convertDocumentToRuntimeLayout,
  exportLevel18Document,
  getCurrentLevel18ContextPayload
} from './rotary-level-adapters/level18.mjs';
import {
  renderGeneratedLayout,
  replaceFileSafely
} from './rotary-level-source.mjs';

const COMMAND_FLAGS = {
  export: new Set(['--level', '--out']),
  validate: new Set(['--input']),
  apply: new Set(['--input', '--dry-run'])
};

export function parseArguments(argv) {
  const [command, ...tokens] = argv;
  if (!COMMAND_FLAGS[command]) throw new Error(`Unknown command ${command ?? ''}`.trim());
  const values = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const flag = tokens[index];
    if (!flag.startsWith('--')) throw new Error(`Unexpected argument ${flag}`);
    if (!COMMAND_FLAGS[command].has(flag)) throw new Error(`Unknown flag ${flag}`);
    if (Object.hasOwn(values, flag)) throw new Error(`Duplicate flag ${flag}`);
    if (flag === '--dry-run') {
      values[flag] = true;
      continue;
    }
    const value = tokens[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    values[flag] = value;
    index += 1;
  }
  const required = command === 'export'
    ? ['--level', '--out']
    : ['--input'];
  for (const flag of required) {
    if (!values[flag]) throw new Error(`Missing required flag ${flag}`);
  }
  return { command, values };
}

function printIssues(issues, stderr) {
  for (const entry of issues) {
    stderr.write(`${entry.code} ${entry.path}: ${entry.message}\n`);
  }
}

async function readDocument(inputPath) {
  let document;
  try {
    document = JSON.parse(await readFile(inputPath, 'utf8'));
  } catch (error) {
    throw new Error(`Input parse failed: ${error.message}`);
  }
  return document;
}

export async function validateInputDocument(inputPath) {
  const document = await readDocument(inputPath);
  const validation = validateLevelDocument(document);
  if (validation.errors.length > 0) {
    return { ok: false, document, ...validation };
  }
  const fingerprint = await computeContextFingerprint(document);
  if (fingerprint !== document.target.contextFingerprint) {
    return {
      ok: false,
      document,
      errors: [{
        severity: 'error',
        code: 'target.context-fingerprint-mismatch',
        path: '/target/contextFingerprint',
        objectType: 'target',
        objectId: document.target.levelId,
        message: 'Embedded context fingerprint is stale'
      }],
      warnings: validation.warnings
    };
  }
  return { ok: true, document, ...validation };
}

export async function applyDocument(
  document,
  {
    target = fileURLToPath(LEVEL18_OUTPUT),
    dryRun = false,
    fs
  } = {}
) {
  const validation = validateLevelDocument(document);
  if (validation.errors.length > 0) {
    throw new Error(
      `validation failed: ${validation.errors[0].code} ${validation.errors[0].path}`
    );
  }
  const embeddedFingerprint = await computeContextFingerprint(document);
  if (embeddedFingerprint !== document.target.contextFingerprint) {
    throw new Error('validation failed: target.context-fingerprint-mismatch');
  }
  if (document.target.levelId !== LEVEL18_ID
    || document.target.adapter !== 'busloop-level-data.v1') {
    throw new Error('validation failed: unsupported target');
  }
  const currentPayload = getCurrentLevel18ContextPayload();
  const currentFingerprint = await computeContextFingerprint(currentPayload);
  if (currentFingerprint !== document.target.contextFingerprint) {
    throw new Error('validation failed: target context is stale');
  }

  const layout = convertDocumentToRuntimeLayout(document);
  const content = renderGeneratedLayout(layout);
  let changed;
  if (dryRun) {
    const current = await (fs ?? { readFile }).readFile(target, 'utf8')
      .catch(() => null);
    changed = current !== content;
  } else {
    await (fs?.mkdir ?? mkdir)(dirname(target), { recursive: true });
    ({ changed } = await replaceFileSafely(target, content, fs));
  }
  return {
    changed,
    dryRun,
    target,
    vehicleCount: layout.vehicles.length,
    laneCount: layout.rotaryLane.lanes.length
  };
}

export async function runCli(
  argv,
  {
    stdout = process.stdout,
    stderr = process.stderr
  } = {}
) {
  let parsed;
  try {
    parsed = parseArguments(argv);
    if (parsed.command === 'export') {
      if (parsed.values['--level'] !== LEVEL18_ID) {
        throw new Error(`Unsupported level ${parsed.values['--level']}`);
      }
      const document = await exportLevel18Document();
      const output = resolve(parsed.values['--out']);
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, canonicalStringify(document), 'utf8');
      stdout.write(`Exported ${document.documentId} to ${output}\n`);
      return 0;
    }

    const validation = await validateInputDocument(
      resolve(parsed.values['--input'])
    );
    if (!validation.ok) {
      printIssues(validation.errors, stderr);
      return 1;
    }
    if (parsed.command === 'validate') {
      stdout.write(
        `Valid ${validation.document.documentId}: ${validation.warnings.length} warnings\n`
      );
      return 0;
    }
    const applied = await applyDocument(validation.document, {
      dryRun: Boolean(parsed.values['--dry-run'])
    });
    stdout.write(
      `${applied.dryRun ? 'Dry run' : 'Apply'} ${applied.changed ? 'changed' : 'unchanged'}: `
      + `${applied.vehicleCount} vehicles, ${applied.laneCount} lanes\n`
    );
    return 0;
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 1;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = await runCli(process.argv.slice(2));
}
