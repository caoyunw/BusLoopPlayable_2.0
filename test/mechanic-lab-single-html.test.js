import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  assetAliases,
  findEntryPaths,
  inlineEntryModule,
  inlineStylesheet,
  mimeFor,
  replaceAssetReferences,
  validateStandaloneHtml
} from '../scripts/mechanic-lab-single-html-core.mjs';
import { packageMechanicLabSingleHtml } from '../scripts/package-mechanic-lab-single-html.mjs';

test('single-html helpers resolve strict MIME types and Vite resource aliases', () => {
  assert.equal(mimeFor('vehicle.fbx'), 'application/octet-stream');
  assert.equal(mimeFor('sound.mp3'), 'audio/mpeg');
  assert.deepEqual(
    assetAliases('C:/fixture/dist', 'C:/fixture/dist/assets/chunk-a.js'),
    ['/assets/chunk-a.js', './assets/chunk-a.js', 'assets/chunk-a.js', './chunk-a.js']
  );
  assert.throws(() => mimeFor('unknown.xyz'), /Unsupported asset extension/);
});

test('single-html helpers inline entries and replace root and relative Vite URLs', () => {
  const html = '<link rel="stylesheet" href="/assets/app.css"><script type="module" src="/assets/app.js"></script><canvas id="game-canvas"></canvas><aside id="scene-editor"></aside><div id="mechanic-library"></div>';
  const entries = findEntryPaths(html);
  assert.deepEqual(entries, { jsUrl: '/assets/app.js', cssUrl: '/assets/app.css' });

  const urls = new Map([
    ['/assets/chunk.js', 'data:text/javascript;base64,YQ=='],
    ['./chunk.js', 'data:text/javascript;base64,YQ=='],
    ['/assets/image.png', 'data:image/png;base64,Yg==']
  ]);
  assert.equal(
    replaceAssetReferences('import("./chunk.js");fetch("/assets/image.png")', urls),
    'import("data:text/javascript;base64,YQ==");fetch("data:image/png;base64,Yg==")'
  );

  let output = inlineStylesheet(html, 'body{color:white}', entries.cssUrl);
  output = inlineEntryModule(output, 'console.log("ready")', entries.jsUrl);
  assert.match(output, /<style>\s*body\{color:white\}/);
  assert.match(output, /<script type="module">/);
  assert.doesNotMatch(output, /src="\/assets\/app\.js"/);
  assert.deepEqual(validateStandaloneHtml(output), []);
});

test('standalone validation rejects unresolved resources and rotary editor entry', () => {
  const invalid = '<canvas id="game-canvas"></canvas><div id="mechanic-library"></div><script src="/assets/app.js"></script><a href="/tools/rotary-level-editor/">editor</a>';
  assert.deepEqual(validateStandaloneHtml(invalid), [
    'External script or stylesheet reference remains.',
    'Local asset path remains.',
    'Rotary level editor entry must not be packaged.'
  ]);
});

test('packager emits one self-contained lab HTML and preserves the scene editor mount', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'busloop-single-html-'));
  const assets = join(rootDir, 'dist', 'assets');
  await mkdir(assets, { recursive: true });
  await writeFile(join(rootDir, 'dist', 'index.html'), '<div id="mechanic-library"></div><canvas id="game-canvas"></canvas><aside id="scene-editor"></aside><link rel="stylesheet" href="/assets/app.css"><script type="module" src="/assets/app.js"></script>');
  await writeFile(join(assets, 'app.css'), '.icon{background:url("/assets/icon.png")}');
  await writeFile(join(assets, 'app.js'), 'import("./chunk.js");fetch("/assets/audio.mp3")');
  await writeFile(join(assets, 'chunk.js'), 'export const ready=true;');
  await writeFile(join(assets, 'icon.png'), Buffer.from([1, 2, 3]));
  await writeFile(join(assets, 'audio.mp3'), Buffer.from([4, 5, 6]));

  const result = await packageMechanicLabSingleHtml({ rootDir });
  const html = await readFile(result.outputFile, 'utf8');
  assert.match(html, /id="scene-editor"/);
  assert.match(html, /data:image\/png;base64/);
  assert.match(html, /data:audio\/mpeg;base64/);
  assert.match(html, /data:text\/javascript;base64/);
  assert.doesNotMatch(html, /\/assets\//);
  assert.deepEqual(result.files, ['index.html']);
});

test('packager preserves the last good artifact when resource validation fails', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'busloop-single-html-failure-'));
  const assets = join(rootDir, 'dist', 'assets');
  const outputDir = join(rootDir, 'artifacts', 'mechanic-lab');
  await mkdir(assets, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, 'index.html'), 'last-good');
  await writeFile(join(rootDir, 'dist', 'index.html'), '<div id="mechanic-library"></div><canvas id="game-canvas"></canvas><link rel="stylesheet" href="/assets/app.css"><script type="module" src="/assets/app.js"></script>');
  await writeFile(join(assets, 'app.css'), 'body{}');
  await writeFile(join(assets, 'app.js'), 'console.log("ready")');
  await writeFile(join(assets, 'unsupported.xyz'), 'unsupported');

  await assert.rejects(
    packageMechanicLabSingleHtml({ rootDir }),
    /Unsupported asset extension/
  );
  assert.equal(await readFile(join(outputDir, 'index.html'), 'utf8'), 'last-good');
});
