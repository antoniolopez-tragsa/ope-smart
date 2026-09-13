import { escapeHtml } from '../utils.js';

/**
 * Renderiza la explicación y la referencia de una pregunta.
 * No inventa fuentes externas: si el banco no proporciona una referencia,
 * lo indica expresamente.
 */
export function renderExplanation(question, { compact = false } = {}) {
  if (!question) return '';

  const explanation = question.explanation
    ? escapeHtml(question.explanation)
    : 'No hay una explicación disponible para esta pregunta.';

  const reference = question.reference;
  const referenceTitle = reference?.title ? escapeHtml(reference.title) : '';
  const referenceNote = reference?.note ? escapeHtml(reference.note) : '';
  const referenceUrl = reference?.url ? String(reference.url) : '';

  let referenceHtml = '';
  if (referenceTitle || referenceNote || referenceUrl) {
    referenceHtml = `
      <div class="question-reference">
        <span class="reference-label">📖 Referencia</span>
        ${referenceTitle ? `<strong>${referenceTitle}</strong>` : ''}
        ${referenceNote ? `<small>${referenceNote}</small>` : ''}
        ${referenceUrl ? `<a href="${escapeHtml(referenceUrl)}" target="_blank" rel="noopener noreferrer">Abrir fuente</a>` : ''}
      </div>
    `;
  }

  return `
    <aside class="explanation-panel ${compact ? 'explanation-compact' : ''}">
      <div class="explanation-heading"><span>💡 Explicación</span></div>
      <p>${explanation}</p>
      ${referenceHtml}
    </aside>
  `;
}
