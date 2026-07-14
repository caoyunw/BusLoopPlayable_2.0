import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assetAliases,
  findEntryPaths,
  inlineEntryModule,
  inlineStylesheet,
  mimeFor,
  replaceAssetReferences,
  validateStandaloneHtml
} from '../scripts/mechanic-lab-single-html-core.mjs';

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
