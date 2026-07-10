import { MECHANIC_DEFINITIONS } from './mechanics/index.js';

export const MECHANICS = Object.freeze(MECHANIC_DEFINITIONS.map((item) => Object.freeze({
  ...item,
  categories: Object.freeze([...item.categories])
})));

export function getMechanicById(id) {
  return MECHANICS.find((mechanic) => mechanic.id === id) ?? null;
}

export function resolveMechanicId(id) {
  return getMechanicById(id)?.id ?? 'base';
}

export function filterMechanics(query = '') {
  const value = query.trim().toLocaleLowerCase('zh-CN');
  if (!value) return [...MECHANICS];

  return MECHANICS.filter((mechanic) => (
    [mechanic.name, mechanic.summary, ...mechanic.categories]
      .some((text) => text.toLocaleLowerCase('zh-CN').includes(value))
  ));
}
