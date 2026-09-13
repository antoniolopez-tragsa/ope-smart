import { saveState } from './storage.js';

const MAX_HISTORY = 50;

/** Persiste un resumen del resultado de un test sin duplicar estadísticas por pregunta. */
export function addTestHistory(state, test) {
  state.tests = Array.isArray(state.tests) ? state.tests : [];
  state.tests.unshift({ ...test });
  state.tests = state.tests.slice(0, MAX_HISTORY);
  saveState(state);
}

export function getTestHistory(state) {
  return Array.isArray(state?.tests) ? [...state.tests] : [];
}
