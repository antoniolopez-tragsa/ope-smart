/**
 * Categorías del banco y métricas por categoría.
 * Las categorías se almacenan en cada pregunta para que el banco sea portable.
 */
export function getCategories(questions) {
  return [...new Set(questions.map(q => q.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
}

export function getQuestionsByCategory(questions, category) {
  if (!category) return [...questions];
  return questions.filter(q => q.category === category);
}

export function getCategoryStats(state, questions, getQuestionStats) {
  const groups = new Map();

  for (const question of questions) {
    const category = question.category || 'Otros';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(question);
  }

  return [...groups.entries()]
    .map(([category, categoryQuestions]) => {
      let practiced = 0;
      let correct = 0;
      let wrong = 0;

      for (const question of categoryQuestions) {
        const stats = getQuestionStats(state, question.id);
        if (stats.attempts > 0) practiced += 1;
        correct += stats.correct;
        wrong += stats.wrong;
      }

      const attempts = correct + wrong;
      const accuracy = attempts ? Math.round((correct / attempts) * 100) : 0;
      const pending = categoryQuestions.length - practiced;

      return {
        category,
        total: categoryQuestions.length,
        practiced,
        pending,
        correct,
        wrong,
        attempts,
        accuracy
      };
    })
    .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category, 'es'));
}
