export function createEditorStore(initialDocument, { historyLimit = 200 } = {}) {
  let document = structuredClone(initialDocument);
  let selection = [];
  let history = [];
  let cursor = 0;
  let preview = null;
  const listeners = new Set();

  function emit() {
    for (const listener of listeners) listener(snapshot());
  }

  function snapshot() {
    return {
      document: structuredClone(document),
      selection: structuredClone(selection),
      history: structuredClone(history),
      historyLength: history.length,
      historyCursor: cursor
    };
  }

  function commit(label, transform) {
    const before = structuredClone(document);
    const after = transform(structuredClone(document));
    history = history.slice(0, cursor);
    history.push({ label, before, after: structuredClone(after) });
    if (history.length > historyLimit) history.shift();
    cursor = history.length;
    document = after;
    emit();
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function replaceDocument(next) {
    document = structuredClone(next);
    history = [];
    cursor = 0;
    preview = null;
    selection = [];
    emit();
  }

  function setSelection(next) {
    selection = structuredClone(next);
    emit();
  }

  function beginPreview(label) {
    preview = { label, before: structuredClone(document) };
  }

  function updatePreview(transform) {
    if (!preview) throw new Error('No active preview');
    document = transform(structuredClone(preview.before));
    emit();
  }

  function commitPreview() {
    if (!preview) return;
    const { label, before } = preview;
    const after = structuredClone(document);
    preview = null;
    history = history.slice(0, cursor);
    history.push({ label, before, after });
    if (history.length > historyLimit) history.shift();
    cursor = history.length;
    emit();
  }

  function cancelPreview() {
    if (preview) document = preview.before;
    preview = null;
    emit();
  }

  function undo() {
    if (cursor === 0) return;
    cursor -= 1;
    document = structuredClone(history[cursor].before);
    emit();
  }

  function redo() {
    if (cursor >= history.length) return;
    document = structuredClone(history[cursor].after);
    cursor += 1;
    emit();
  }

  function canUndo() {
    return cursor > 0;
  }

  function canRedo() {
    return cursor < history.length;
  }

  function restoreHistory(entries, nextCursor) {
    history = structuredClone(entries).slice(-historyLimit);
    cursor = Math.max(0, Math.min(Number(nextCursor) || 0, history.length));
    emit();
  }

  return {
    snapshot,
    commit,
    subscribe,
    replaceDocument,
    setSelection,
    beginPreview,
    updatePreview,
    commitPreview,
    cancelPreview,
    undo,
    redo,
    canUndo,
    canRedo,
    restoreHistory
  };
}
