import { resolveMechanicId } from './mechanic-registry.js';

export function getMechanicIdFromSearch(search = '') {
  return resolveMechanicId(new URLSearchParams(search).get('mechanic'));
}

export function replaceMechanicQuery(pathAndSearch, mechanicId) {
  const base = 'https://busloop.local';
  const url = new URL(pathAndSearch.startsWith('//') ? `${base}${pathAndSearch}` : pathAndSearch, base);
  url.searchParams.set('mechanic', resolveMechanicId(mechanicId));
  return `${url.pathname}${url.search}${url.hash}`;
}

export function safeRemoveStorageItem(storage, key, onError = () => {}) {
  try {
    storage.removeItem(key);
    return true;
  } catch (error) {
    onError(error);
    return false;
  }
}

export function syncMechanicQuery(
  mechanicId,
  location = window.location,
  history = window.history
) {
  history.replaceState(
    null,
    '',
    `${location.origin}${replaceMechanicQuery(
      `${location.pathname}${location.search}${location.hash}`,
      mechanicId
    )}`
  );
}
