export const DRAFT_PREFIX = 'busloop:rotary-editor:level.rotary.v1:';

export const draftKey = (documentId) => `${DRAFT_PREFIX}${documentId}`;

export function createDraftEnvelope(snapshot, baselineHash, now = Date.now()) {
  return {
    format: 'rotary-editor-draft.v1',
    savedAt: now,
    baselineHash,
    document: snapshot.document,
    historyCursor: snapshot.historyCursor,
    history: snapshot.history ?? []
  };
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function validEnvelope(envelope) {
  return Boolean(envelope)
    && typeof envelope === 'object'
    && !Array.isArray(envelope)
    && envelope.format === 'rotary-editor-draft.v1'
    && Number.isFinite(envelope.savedAt)
    && typeof envelope.baselineHash === 'string'
    && Boolean(envelope.document)
    && typeof envelope.document === 'object'
    && !Array.isArray(envelope.document)
    && typeof envelope.document.documentId === 'string'
    && Number.isInteger(envelope.historyCursor)
    && envelope.historyCursor >= 0
    && Array.isArray(envelope.history);
}

export function saveDraft(storage, envelope) {
  try {
    storage.setItem(
      draftKey(envelope.document.documentId),
      JSON.stringify(envelope)
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export function loadDraft(storage, documentId) {
  let raw;
  try {
    raw = storage.getItem(draftKey(documentId));
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
  if (raw === null || raw === undefined) {
    return { ok: true, envelope: null };
  }
  try {
    const envelope = JSON.parse(raw);
    if (!validEnvelope(envelope)) {
      return { ok: false, error: 'Invalid draft envelope', raw };
    }
    return { ok: true, envelope };
  } catch (error) {
    return { ok: false, error: errorMessage(error), raw };
  }
}

export function removeDraft(storage, documentId) {
  try {
    storage.removeItem(draftKey(documentId));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export function isRecoverableDraft(envelope, baselineHash) {
  if (!validEnvelope(envelope)) return false;
  if (baselineHash === undefined || baselineHash === null) return true;
  return envelope.baselineHash !== baselineHash;
}

export function createDraftScheduler(save, delay = 250) {
  let timer = null;
  return {
    schedule(value) {
      clearTimeout(timer);
      timer = setTimeout(() => save(value), delay);
    },
    flush(value) {
      clearTimeout(timer);
      timer = null;
      return save(value);
    },
    cancel() {
      clearTimeout(timer);
      timer = null;
    }
  };
}
