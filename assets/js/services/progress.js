import { saveState } from './storage.js';

function ensureQuestionState(state, questionId) {
  if (!state.questions[questionId]) {
    state.questions[questionId] = {
      attempts: 0,
      correct: 0,
      wrong: 0,
      lastAttempt: null,
      lastResult: null,
      streak: 0
    };
  }

  return state.questions[questionId];
}

export function recordAnswer(state, question, isCorrect) {
  const stats = ensureQuestionState(state, question.id);

  stats.attempts += 1;
  stats.lastAttempt = new Date().toISOString();
  stats.lastResult = isCorrect ? 'correct' : 'wrong';

  if (isCorrect) {
    stats.correct += 1;
    stats.streak += 1;
  } else {
    stats.wrong += 1;
    stats.streak = 0;
  }

  saveState(state);
  return stats;
}

export function getQuestionStats(state, questionId) {
  return state.questions[questionId] || {
    attempts: 0,
    correct: 0,
    wrong: 0,
    lastAttempt: null,
    lastResult: null,
    streak: 0
  };
}

export function getReviewQuestions(state, questions, limit = 20) {
  const now = Date.now();

  return questions
    .map(question => {
      const stats = getQuestionStats(state, question.id);
      const ageHours = stats.lastAttempt
        ? Math.max(0, (now - new Date(stats.lastAttempt).getTime()) / 36e5)
        : 9999;

      let priority = 0;

      // Los fallos pesan más que los aciertos.
      priority += stats.wrong * 10;
      priority += stats.attempts === 0 ? 6 : 0;
      priority += Math.min(ageHours / 24, 7);
      priority += stats.lastResult === 'wrong' ? 12 : 0;
      priority -= Math.min(stats.streak, 5) * 2;

      return { question, stats, priority };
    })
    .filter(item => item.stats.attempts === 0 || item.stats.wrong > 0)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit)
    .map(item => item.question);
}

export function getProgressSummary(state, questions) {
  let practiced = 0;
  let correct = 0;
  let wrong = 0;

  for (const question of questions) {
    const stats = getQuestionStats(state, question.id);
    if (stats.attempts > 0) practiced += 1;
    correct += stats.correct;
    wrong += stats.wrong;
  }

  const attempts = correct + wrong;

  return {
    total: questions.length,
    practiced,
    pending: Math.max(0, questions.length - practiced),
    correct,
    wrong,
    accuracy: attempts ? Math.round((correct / attempts) * 100) : 0
  };
}
