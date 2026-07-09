import { resolveMechanicId } from './mechanic-registry.js';

export function getMechanicIdFromSearch(search = '') {
  return resolveMechanicId(new URLSearchParams(search).get('mechanic'));
}

export function replaceMechanicQuery(pathAndSearch, mechanicId) {
  const url = new URL(pathAndSearch, 'https://busloop.local');
  url.searchParams.set('mechanic', resolveMechanicId(mechanicId));
  return `${url.pathname}${url.search}${url.hash}`;
}

export function syncMechanicQuery(
  mechanicId,
  location = window.location,
  history = window.history
) {
  history.replaceState(
    null,
    '',
    replaceMechanicQuery(
      `${location.pathname}${location.search}${location.hash}`,
      mechanicId
    )
  );
}
