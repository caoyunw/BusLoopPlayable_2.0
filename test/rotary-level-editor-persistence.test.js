import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import { computeContextFingerprint } from '../tools/rotary-level-contract/fingerprint.js';

import {
  createDraftEnvelope,
  draftKey,
  loadDraft,
  saveDraft
} from '../tools/rotary-level-editor/persistence.js';
import {
  createCanonicalDownload,
  createRecoveryDownload,
  importDocument
} from '../tools/rotary-level-editor/file-io.js';

function validDocument() {
  return {
    format: 'level.rotary.v1',
    documentId: 'persistence',
    target: {
      levelId: 'GameSceneDualQueue2/18',
      adapter: 'busloop-level-data.v1',
      contextFingerprint: `sha256:${'1'.repeat(64)}`
    },
    coordinates: {
      plane: 'xz',
      unit: 'level-unit',
      yaw: 'degrees',
      geometryProfile: 'busloop-level18-rotary.v1'
    },
    vehicles: [],
    rotaryLanes: [],
    context: {
      garages: [],
      parkingSpots: [],
      conveyors: [],
      passengerQueues: [],
      protectedGeometry: [],
      vehicleFootprints: {
        4: { width: 0.27, length: 0.4814318817567568 },
        6: { width: 0.27, length: 0.5639630614864864 },
        10: { width: 0.27, length: 0.6785897 }
      },
      rotaryRoadWidth: 0.42,
      allowedColorIndexes: [0, 1, 2]
    }
  };
}

function invalidDocument() {
  return { ...validDocument(), format: 'level.rotary.v0' };
}

function envelope() {
  return createDraftEnvelope({
    document: validDocument(),
    historyCursor: 0,
    history: []
  }, 'sha256:baseline', 1234);
}

test('draft key isolates version and document ID', () => {
  assert.equal(
    draftKey('abc'),
    'busloop:rotary-editor:level.rotary.v1:abc'
  );
});

test('storage write failure is returned instead of thrown', () => {
  const storage = {
    setItem() {
      throw new Error('quota');
    }
  };
  assert.deepEqual(saveDraft(storage, envelope()), {
    ok: false,
    error: 'quota'
  });
});

test('corrupted draft JSON is isolated instead of thrown', () => {
  const storage = { getItem: () => '{bad' };
  const result = loadDraft(storage, 'persistence');
  assert.equal(result.ok, false);
  assert.equal(result.raw, '{bad');
});

test('invalid import does not replace current document', async () => {
  const current = validDocument();
  const result = await importDocument({ text: async () => '{bad' }, current);
  assert.equal(result.ok, false);
  assert.equal(result.document, current);
});

test('valid import recomputes and enforces the embedded context fingerprint', async () => {
  const current = validDocument();
  const imported = validDocument();
  imported.documentId = 'imported';
  imported.target.contextFingerprint = await computeContextFingerprint(
    imported,
    webcrypto.subtle
  );
  const accepted = await importDocument(
    { text: async () => JSON.stringify(imported) },
    current,
    { subtle: webcrypto.subtle }
  );
  assert.equal(accepted.ok, true);
  assert.equal(accepted.document.documentId, 'imported');

  imported.context.rotaryRoadWidth = 0.5;
  const rejected = await importDocument(
    { text: async () => JSON.stringify(imported) },
    current,
    { subtle: webcrypto.subtle }
  );
  assert.equal(rejected.ok, false);
  assert.equal(rejected.document, current);
  assert.equal(
    rejected.errors[0].code,
    'target.context-fingerprint-mismatch'
  );
});

test('canonical download rejects blocking errors but recovery copy does not', () => {
  const invalid = invalidDocument();
  assert.throws(
    () => createCanonicalDownload(invalid),
    /blocking validation errors/
  );
  assert.match(
    createRecoveryDownload(invalid).filename,
    /invalid-backup\.json$/
  );
});
