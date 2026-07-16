import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { MECHANIC_DEFINITIONS } from '../src/mechanics/index.js';
import { validateStandaloneHtml } from './mechanic-lab-single-html-core.mjs';

const execFileAsync = promisify(execFile);

export function inspectMechanicLabHtml(html, mechanicIds) {
  const errors = validateStandaloneHtml(html);
  for (const id of mechanicIds) {
    if (!html.includes(id)) errors.push(`Mechanic definition is missing from artifact: ${id}`);
  }
  if (!/<aside\b(?=[^>]*id=["']scene-editor["'])/u.test(html)) {
    errors.push('Scene editor mount is missing.');
  }
  return errors;
}

function extractModule(html) {
  const source = html.match(/<script\b(?=[^>]*type=["']module["'])[^>]*>([\s\S]*?)<\/script>/u)?.[1];
  if (!source) throw new Error('Inline entry module is missing.');
  return source;
}

export async function checkMechanicLabSingleHtml({ rootDir = process.cwd() } = {}) {
  const outputDir = path.join(rootDir, 'artifacts', 'mechanic-lab');
  const files = await readdir(outputDir);
  if (files.length !== 1 || files[0] !== 'index.html') {
    throw new Error(`Expected only index.html, found: ${files.join(', ')}`);
  }
  const file = path.join(outputDir, 'index.html');
  const html = await readFile(file, 'utf8');
  const errors = inspectMechanicLabHtml(
    html,
    MECHANIC_DEFINITIONS.map(({ id }) => id)
  );
  if (errors.length > 0) throw new Error(errors.join('\n'));

  const tempDir = await mkdtemp(path.join(tmpdir(), 'busloop-inline-module-'));
  const moduleFile = path.join(tempDir, 'entry.mjs');
  try {
    await writeFile(moduleFile, extractModule(html), 'utf8');
    await execFileAsync(process.execPath, ['--check', moduleFile]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
  return { file, size: Buffer.byteLength(html) };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  checkMechanicLabSingleHtml().then(({ file, size }) => {
    console.log(`Verified ${path.relative(process.cwd(), file)} (${size} bytes).`);
  }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
