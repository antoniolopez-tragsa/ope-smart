const STORAGE_KEY = 'opeSmartState';
const STATE_VERSION = 2;

function createEmptyState() {
  return {
    version: STATE_VERSION,
    questions: {},
    tests: [],
    sessions: [],
    migratedLegacy: false
  };
}

export function loadState(allQuestions = []) {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === STATE_VERSION) {
        return normalizeState(parsed);
      }
    } catch (error) {
      console.warn('No se pudo leer el progreso guardado:', error);
    }
  }

  const state = migrateLegacyState(allQuestions);
  saveState(state);
  return state;
}

function normalizeState(state) {
  return {
    ...createEmptyState(),
    ...state,
    questions: state.questions || {},
    tests: Array.isArray(state.tests) ? state.tests : [],
    sessions: Array.isArray(state.sessions) ? state.sessions : []
  };
}

function migrateLegacyState(allQuestions) {
  const state = createEmptyState();
  const legacyFails = readLegacyFails();

  if (!legacyFails.length) return state;

  // La versión anterior guardaba las preguntas completas en opeFails,
  // pero no tenía IDs. Las asociamos por texto/número para no perderlas.
  for (const legacyQuestion of legacyFails) {
    const match = allQuestions.find(q =>
      q.question === legacyQuestion.question &&
      Number(q.number) === Number(legacyQuestion.number)
    );

    if (!match) continue;

    state.questions[match.id] = {
      attempts: 1,
      correct: 0,
      wrong: 1,
      lastAttempt: new Date().toISOString(),
      lastResult: 'wrong',
      streak: 0
    };
  }

  state.migratedLegacy = true;
  return state;
}

function readLegacyFails() {
  try {
    const raw = localStorage.getItem('opeFails');
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
}

export function resetState() {
  const state = createEmptyState();
  saveState(state);
  return state;
}
