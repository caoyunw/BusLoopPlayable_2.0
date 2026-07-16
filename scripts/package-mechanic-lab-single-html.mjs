import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assetAliases,
  findEntryPaths,
  inlineEntryModule,
  inlineStylesheet,
  mimeFor,
  replaceAssetReferences,
  validateStandaloneHtml
} from './mechanic-lab-single-html-core.mjs';

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  }));
  return groups.flat();
}

function toDataUrl(filePath, bytes) {
  return `data:${mimeFor(filePath)};base64,${bytes.toString('base64')}`;
}

function addAssetAliases(assetMap, distDir, filePath, dataUrl) {
  for (const alias of assetAliases(distDir, filePath)) assetMap.set(alias, dataUrl);
}

function referencesPendingAsset(content, distDir, currentFile, pendingFiles) {
  return pendingFiles.some((filePath) => (
    filePath !== currentFile
    && assetAliases(distDir, filePath).some((alias) => content.includes(alias))
  ));
}

async function createAssetMap(distDir, excludedFiles) {
  const assetMap = new Map();
  const files = (await listFiles(distDir)).filter((filePath) => (
    path.basename(filePath) !== 'index.html'
    && !excludedFiles.has(path.resolve(filePath))
  ));
  const textExtensions = new Set(['.js', '.css']);
  const binaryFiles = files.filter((filePath) => !textExtensions.has(path.extname(filePath).toLowerCase()));
  const textFiles = files.filter((filePath) => textExtensions.has(path.extname(filePath).toLowerCase()));

  for (const filePath of binaryFiles) {
    addAssetAliases(assetMap, distDir, filePath, toDataUrl(filePath, await readFile(filePath)));
  }

  const pending = new Map(await Promise.all(textFiles.map(async (filePath) => (
    [filePath, await readFile(filePath, 'utf8')]
  ))));
  while (pending.size > 0) {
    let resolved = 0;
    const pendingFiles = [...pending.keys()];
    for (const [filePath, source] of pending) {
      if (referencesPendingAsset(source, distDir, filePath, pendingFiles)) continue;
      const rewritten = replaceAssetReferences(source, assetMap);
      addAssetAliases(assetMap, distDir, filePath, toDataUrl(filePath, Buffer.from(rewritten)));
      pending.delete(filePath);
      resolved += 1;
    }
    if (resolved === 0) {
      throw new Error(`Unable to inline cyclic generated assets: ${[...pending.keys()].map((filePath) => path.relative(distDir, filePath)).join(', ')}`);
    }
  }

  return assetMap;
}

async function replaceOutputWithBackup({ outputFile, tempFile, backupFile }) {
  let hadPrior = false;
  try {
    await copyFile(outputFile, backupFile);
    hadPrior = true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  try {
    await rm(outputFile, { force: true });
    await rename(tempFile, outputFile);
    await rm(backupFile, { force: true });
  } catch (error) {
    if (hadPrior) await copyFile(backupFile, outputFile);
    throw error;
  }
}

export async function packageMechanicLabSingleHtml({ rootDir = process.cwd() } = {}) {
  const distDir = path.join(rootDir, 'dist');
  const outputDir = path.join(rootDir, 'artifacts', 'mechanic-lab');
  const outputFile = path.join(outputDir, 'index.html');
  const tempFile = path.join(outputDir, 'index.html.tmp');
  const backupFile = path.join(outputDir, 'index.html.bak');
  const sourceHtml = await readFile(path.join(distDir, 'index.html'), 'utf8');
  const { jsUrl, cssUrl } = findEntryPaths(sourceHtml);
  const resolveEntry = (url) => path.join(distDir, url.replace(/^\/?/u, ''));
  const jsFile = resolveEntry(jsUrl);
  const cssFile = resolveEntry(cssUrl);
  const assetMap = await createAssetMap(
    distDir,
    new Set([path.resolve(jsFile), path.resolve(cssFile)])
  );
  const css = replaceAssetReferences(await readFile(cssFile, 'utf8'), assetMap);
  const js = replaceAssetReferences(await readFile(jsFile, 'utf8'), assetMap);
  let output = inlineStylesheet(sourceHtml, css, cssUrl);
  output = inlineEntryModule(output, js, jsUrl);
  output = replaceAssetReferences(output, assetMap);
  const errors = validateStandaloneHtml(output);
  if (errors.length > 0) throw new Error(errors.join('\n'));

  await mkdir(outputDir, { recursive: true });
  await writeFile(tempFile, output, 'utf8');
  await replaceOutputWithBackup({ outputFile, tempFile, backupFile });
  for (const name of await readdir(outputDir)) {
    if (name !== 'index.html') {
      await rm(path.join(outputDir, name), { recursive: true, force: true });
    }
  }
  const { size } = await stat(outputFile);
  return { outputFile, size, files: await readdir(outputDir) };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  packageMechanicLabSingleHtml().then(({ outputFile, size }) => {
    console.log(`Wrote ${path.relative(process.cwd(), outputFile)} (${size} bytes, ${(size / 1048576).toFixed(3)} MiB).`);
  }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
