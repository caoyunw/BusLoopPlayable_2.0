import { canonicalStringify } from '../rotary-level-contract/document.js';
import { computeContextFingerprint } from '../rotary-level-contract/fingerprint.js';
import { validateLevelDocument } from '../rotary-level-contract/validate.js';

function importError(code, message, path = '') {
  return {
    severity: 'error',
    code,
    path,
    objectType: 'document',
    objectId: null,
    message
  };
}

function safeFilenamePart(value) {
  const safe = String(value || 'untitled')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-')
    .replace(/[. ]+$/g, '');
  return safe || 'untitled';
}

function createJsonBlob(document) {
  return new Blob([canonicalStringify(document)], {
    type: 'application/json;charset=utf-8'
  });
}

export async function importDocument(
  file,
  current,
  { subtle = globalThis.crypto?.subtle } = {}
) {
  let imported;
  try {
    imported = JSON.parse(await file.text());
  } catch (error) {
    return {
      ok: false,
      document: current,
      errors: [importError(
        'import.invalid-json',
        error instanceof Error ? error.message : String(error)
      )]
    };
  }

  const validation = validateLevelDocument(imported);
  if (validation.errors.length > 0) {
    return { ok: false, document: current, errors: validation.errors };
  }

  try {
    const fingerprint = await computeContextFingerprint(imported, subtle);
    if (fingerprint !== imported.target.contextFingerprint) {
      return {
        ok: false,
        document: current,
        errors: [importError(
          'target.context-fingerprint-mismatch',
          'Embedded context does not match target.contextFingerprint',
          '/target/contextFingerprint'
        )]
      };
    }
  } catch (error) {
    return {
      ok: false,
      document: current,
      errors: [importError(
        'import.fingerprint-failed',
        error instanceof Error ? error.message : String(error),
        '/target/contextFingerprint'
      )]
    };
  }

  return {
    ok: true,
    document: imported,
    errors: [],
    warnings: validation.warnings
  };
}

export function createCanonicalDownload(document) {
  const validation = validateLevelDocument(document);
  if (validation.errors.length > 0) {
    throw new Error(
      `Cannot create canonical download: ${validation.errors.length} blocking validation errors`
    );
  }
  return {
    blob: createJsonBlob(document),
    filename: `${safeFilenamePart(document.documentId)}.level.rotary.v1.json`
  };
}

export function createRecoveryDownload(document) {
  return {
    blob: createJsonBlob(document),
    filename: `${safeFilenamePart(document?.documentId)}-invalid-backup.json`
  };
}

export function triggerDownload(
  descriptor,
  {
    documentRef = globalThis.document,
    urlApi = globalThis.URL
  } = {}
) {
  if (!documentRef || !urlApi) {
    throw new Error('Download APIs are unavailable');
  }
  const url = urlApi.createObjectURL(descriptor.blob);
  try {
    const anchor = documentRef.createElement('a');
    anchor.href = url;
    anchor.download = descriptor.filename;
    anchor.click();
  } finally {
    urlApi.revokeObjectURL(url);
  }
}
