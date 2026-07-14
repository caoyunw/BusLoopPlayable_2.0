import path from 'node:path';

export const DATA_URL_FETCH_COMPAT_SCRIPT = `;(function installDataUrlFetchCompat(){
  if (typeof globalThis.fetch !== 'function' || typeof globalThis.Response !== 'function') return;
  var originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = function dataUrlFetchCompat(input, init) {
    var url = typeof input === 'string' ? input : input && typeof input.url === 'string' ? input.url : String(input || '');
    if (url.slice(0, 5).toLowerCase() !== 'data:') return originalFetch(input, init);
    var comma = url.indexOf(',');
    if (comma < 0) return originalFetch(input, init);
    var meta = url.slice(5, comma).split(';');
    var body = url.slice(comma + 1);
    var binary = meta.some(function(part){ return part.toLowerCase() === 'base64'; }) ? atob(body) : decodeURIComponent(body);
    var bytes = new Uint8Array(binary.length);
    for (var index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index) & 255;
    return Promise.resolve(new Response(bytes, { status: 200, headers: { 'Content-Type': meta[0] || 'text/plain;charset=US-ASCII' } }));
  };
}());\n`;

const MIME_TYPES = new Map([
  ['.bin', 'application/octet-stream'],
  ['.css', 'text/css'],
  ['.fbx', 'application/octet-stream'],
  ['.html', 'text/html'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript'],
  ['.mp3', 'audio/mpeg'],
  ['.png', 'image/png'],
  ['.rgba16f', 'application/octet-stream'],
  ['.ttf', 'font/ttf'],
  ['.webp', 'image/webp']
]);

export function mimeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES.get(extension);
  if (!mime) throw new Error(`Unsupported asset extension: ${extension || '(none)'}`);
  return mime;
}

export function assetAliases(distDir, filePath) {
  const relative = path.relative(distDir, filePath).replaceAll(path.sep, '/');
  const aliases = [`/${relative}`, `./${relative}`, relative];
  if (relative.startsWith('assets/')) aliases.push(`./${relative.slice('assets/'.length)}`);
  return [...new Set(aliases)];
}

export function replaceAssetReferences(content, assetMap) {
  return [...assetMap.entries()]
    .sort(([left], [right]) => right.length - left.length)
    .reduce((result, [url, dataUrl]) => result.split(url).join(dataUrl), content);
}

export function findEntryPaths(html) {
  const jsUrl = html.match(/<script\b(?=[^>]*type=["']module["'])(?=[^>]*src=["']([^"']+\.js)["'])[^>]*><\/script>/u)?.[1];
  const cssUrl = html.match(/<link\b(?=[^>]*rel=["']stylesheet["'])(?=[^>]*href=["']([^"']+\.css)["'])[^>]*>/u)?.[1];
  if (!jsUrl) throw new Error('Unable to find the built module entry.');
  if (!cssUrl) throw new Error('Unable to find the built stylesheet entry.');
  return { jsUrl, cssUrl };
}

function escapePattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

export function inlineStylesheet(html, css, cssUrl) {
  const pattern = new RegExp(`\\s*<link\\b(?=[^>]*href=["']${escapePattern(cssUrl)}["'])[^>]*>\\s*`, 'u');
  if (!pattern.test(html)) throw new Error(`Unable to inline stylesheet ${cssUrl}.`);
  return html.replace(pattern, () => `\n<style>\n${css}\n</style>\n`);
}

export function inlineEntryModule(html, source, jsUrl) {
  const pattern = new RegExp(`\\s*<script\\b(?=[^>]*src=["']${escapePattern(jsUrl)}["'])[^>]*><\\/script>\\s*`, 'u');
  if (!pattern.test(html)) throw new Error(`Unable to inline module ${jsUrl}.`);
  const moduleSource = `${DATA_URL_FETCH_COMPAT_SCRIPT}${source}`.replaceAll('</script', '<\\/script');
  return html.replace(pattern, () => `\n<script type="module">\n${moduleSource}\n</script>\n`);
}

export function validateStandaloneHtml(html) {
  const errors = [];
  if (/<script\b[^>]*\bsrc=|<link\b(?=[^>]*rel=["']stylesheet["'])/iu.test(html)) {
    errors.push('External script or stylesheet reference remains.');
  }
  if (/\/(?:assets|src|public)\/|(?:src|href)=["'](?:\.\/|\.\.\/)/u.test(html)) {
    errors.push('Local asset path remains.');
  }
  if (html.includes('/tools/rotary-level-editor/')) {
    errors.push('Rotary level editor entry must not be packaged.');
  }
  if (!html.includes('id="game-canvas"')) errors.push('Game canvas is missing.');
  if (!html.includes('id="mechanic-library"')) errors.push('Mechanic library is missing.');
  return errors;
}
