import { getQuestionStats, getProgressSummary } from './progress.js';

/**
 * Métricas derivadas del progreso por pregunta.
 * No modifica el estado: sólo calcula información para la interfaz.
 */
export function getDetailedStats(state, questions) {
  const global = getProgressSummary(state, questions);

  let mastered = 0;
  let neverPracticed = 0;
  let weak = 0;
  let recentCorrect = 0;
  let recentWrong = 0;
  let lastActivity = null;

  const questionStats = questions.map(question => {
    const stats = getQuestionStats(state, question.id);
    const accuracy = stats.attempts
      ? Math.round((stats.correct / stats.attempts) * 100)
      : 0;

    if (stats.attempts === 0) neverPracticed += 1;

    // "Dominada": al menos 3 intentos, 80% o más y último resultado correcto.
    if (stats.attempts >= 3 && accuracy >= 80 && stats.lastResult === 'correct') {
      mastered += 1;
    }

    // "Débil": se ha practicado y está por debajo del 60%, o el último intento fue fallo.
    if (stats.attempts > 0 && (accuracy < 60 || stats.lastResult === 'wrong')) {
      weak += 1;
    }

    if (stats.lastAttempt) {
      if (!lastActivity || new Date(stats.lastAttempt) > new Date(lastActivity)) {
        lastActivity = stats.lastAttempt;
      }

      const ageDays = (Date.now() - new Date(stats.lastAttempt).getTime()) / 86400000;
      if (ageDays <= 1) {
        if (stats.lastResult === 'correct') recentCorrect += 1;
        if (stats.lastResult === 'wrong') recentWrong += 1;
      }
    }

    return {
      question,
      stats,
      accuracy
    };
  });

  const practicedAccuracy = global.correct + global.wrong
    ? Math.round((global.correct / (global.correct + global.wrong)) * 100)
    : 0;

  return {
    ...global,
    mastered,
    weak,
    neverPracticed,
    practicedAccuracy,
    recentCorrect,
    recentWrong,
    lastActivity,
    questionStats
  };
}

export function getTopWeakQuestions(state, questions, limit = 5) {
  return getDetailedStats(state, questions).questionStats
    .filter(item => item.stats.attempts > 0)
    .sort((a, b) => {
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      return b.stats.wrong - a.stats.wrong;
    })
    .slice(0, limit);
}

export function getTopStrongQuestions(state, questions, limit = 5) {
  return getDetailedStats(state, questions).questionStats
    .filter(item => item.stats.attempts > 0)
    .sort((a, b) => {
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return b.stats.streak - a.stats.streak;
    })
    .slice(0, limit);
}
