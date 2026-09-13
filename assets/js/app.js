import { loadQuestions } from './services/jsonLoader.js';
import { loadState } from './services/storage.js';
import {
  getProgressSummary,
  getQuestionStats,
  getReviewQuestions,
  recordAnswer
} from './services/progress.js';
import { escapeHtml, shuffleArray } from './utils.js';
import { getDetailedStats, getTopWeakQuestions } from './services/stats.js';
import { addTestHistory, getTestHistory } from './services/test.js';
import { renderExplanation } from './services/explanations.js';
import { getCategoryStats, getQuestionsByCategory } from './services/categories.js';

let QUESTIONS = [];
let TEST_QUESTIONS = [];
let COMMON = [];
let SPECIFIC = [];
let APP_STATE = null;

let CURRENT = 0;
let CURRENT_BLOCK = [];
let BLOCK_FAILS = [];
let BLOCK_CORRECT = 0;
let REVIEW_QUEUE = [];
let REVIEW_CURRENT = 0;

let SCORE = 0;
let FAILS = [];
let TEST_SESSION = null;
let TEST_TIMER = null;

const view = document.getElementById('view');

async function init() {
  try {
    const data = await loadQuestions();
    COMMON = data.common;
    SPECIFIC = data.specific;
    QUESTIONS = data.all;
    APP_STATE = loadState(QUESTIONS);

    setupNavigation();
    renderHome();
  } catch (error) {
    console.error(error);
    view.innerHTML = `
      <section class="hero">
        <span class="badge">Error</span>
        <h2>No se han podido cargar las preguntas</h2>
        <p>${escapeHtml(error.message)}</p>
      </section>
    `;
  }
}

function setupNavigation() {
  document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.menu-btn')
        .forEach(b => b.classList.remove('active'));

      btn.classList.add('active');

      switch (btn.dataset.view) {
        case 'home': renderHome(); break;
        case 'study': renderBlockSelection(); break;
        case 'test': renderTestConfig(); break;
        case 'review': startReview(); break;
        case 'stats': renderStats(); break;
      }
    });
  });
}

function renderHome() {
  const questions = [...COMMON, ...SPECIFIC];
  const global = getDetailedStats(APP_STATE, questions);
  const common = getDetailedStats(APP_STATE, COMMON);
  const specific = getDetailedStats(APP_STATE, SPECIFIC);
  const weak = getTopWeakQuestions(APP_STATE, questions, 3);
  const progressPercent = global.total
    ? Math.round((global.practiced / global.total) * 100)
    : 0;

  view.innerHTML = `
    <section class="hero home-hero">
      <span class="badge">Preparación OPE</span>
      <h2>Estudia de forma inteligente</h2>
      <p>${global.practiced} de ${global.total} preguntas practicadas · ${global.accuracy}% de acierto acumulado.</p>

      <div class="progress-track" aria-label="Progreso de preguntas practicadas">
        <div class="progress-fill" style="width:${progressPercent}%"></div>
      </div>
      <p class="progress-label">${progressPercent}% del banco de preguntas practicado</p>
    </section>

    <section class="stats-grid home-stats">
      <div class="stat-card"><h3>Precisión global</h3><p>${global.accuracy}%</p><small>${global.correct} aciertos · ${global.wrong} fallos</small></div>
      <div class="stat-card"><h3>Practicadas</h3><p>${global.practiced}</p><small>${global.pending} pendientes</small></div>
      <div class="stat-card"><h3>Dominadas</h3><p>${global.mastered}</p><small>≥ 80% y 3+ intentos</small></div>
      <div class="stat-card"><h3>A repasar</h3><p>${global.weak}</p><small>Preguntas con dificultad</small></div>
    </section>

    <section class="dashboard-grid">
      <div class="dashboard-card">
        <div class="section-heading">
          <div><span class="badge">Rendimiento</span><h3>Común y específica</h3></div>
        </div>
        ${renderMetricBar('Parte común', common.accuracy, `${common.practiced}/${common.total} practicadas`)}
        ${renderMetricBar('Parte específica', specific.accuracy, `${specific.practiced}/${specific.total} practicadas`)}
      </div>

      <div class="dashboard-card">
        <div class="section-heading">
          <div><span class="badge">Prioridad</span><h3>Tus preguntas más débiles</h3></div>
        </div>
        ${weak.length ? weak.map(item => `
          <div class="weak-question">
            <div><strong>${escapeHtml(item.question.question)}</strong><span>${item.accuracy}% · ${item.stats.wrong} fallos</span></div>
          </div>
        `).join('') : '<p class="empty-state">Todavía no hay suficiente historial. Empieza un bloque para generar estadísticas.</p>'}
      </div>
    </section>
  `;
}

function renderMetricBar(label, value, detail) {
  return `
    <div class="metric-row">
      <div class="metric-header"><strong>${label}</strong><span>${value}%</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${value}%"></div></div>
      <small>${detail}</small>
    </div>
  `;
}

function renderBlockSelection() {
  const blockSize = 20;

  const renderBlocks = (source, type, label) => {
    const count = Math.ceil(source.length / blockSize);
    let html = `
      <section class="hero" style="margin-bottom:24px;">
        <h2>${label}</h2>
        <p>${count} bloques de ${blockSize} preguntas</p>
      </section>
      <div class="blocks-grid">
    `;

    for (let i = 0; i < count; i += 1) {
      const start = i * blockSize + 1;
      const end = Math.min((i + 1) * blockSize, source.length);

      html += `
        <div class="block-card">
          <h3>${label} · Bloque ${i + 1}</h3>
          <p>Preguntas ${start} - ${end}</p>
          <button class="primary-btn block-start-btn"
            data-type="${type}" data-block="${i}">
            Estudiar bloque
          </button>
        </div>
      `;
    }

    return html + '</div>';
  };

  view.innerHTML =
    renderBlocks(COMMON, 'common', 'Parte común') +
    renderBlocks(SPECIFIC, 'specific', 'Parte específica');

  document.querySelectorAll('.block-start-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      startBlock(btn.dataset.type, Number(btn.dataset.block));
    });
  });
}

function startBlock(type, blockIndex) {
  const source = type === 'common' ? COMMON : SPECIFIC;
  const start = blockIndex * 20;

  CURRENT_BLOCK = source.slice(start, start + 20);
  CURRENT = 0;
  BLOCK_FAILS = [];
  BLOCK_CORRECT = 0;

  renderStudyQuestion(type, blockIndex);
}

function renderStudyQuestion(type, blockIndex) {
  const q = CURRENT_BLOCK[CURRENT];

  if (!q) {
    renderBlockResults(type, blockIndex);
    return;
  }

  view.innerHTML = `
    <div class="topbar">
      <span class="badge">
        ${type === 'common' ? 'Parte común' : 'Parte específica'}
      </span>
      <span>Bloque ${blockIndex + 1} · ${CURRENT + 1} / ${CURRENT_BLOCK.length}</span>
    </div>

    <section class="question-card">
      <h2>${escapeHtml(q.question)}</h2>
      <div class="answers">
        ${q.answers.map((a, i) => `
          <button class="answer-btn" data-index="${i}">
            <strong>${escapeHtml(a.letter.toUpperCase())})</strong>
            ${escapeHtml(a.text)}
          </button>
        `).join('')}
      </div>
    </section>
  `;

  bindAnswerButtons(q, (isCorrect, btn, buttons) => {
    if (isCorrect) {
      BLOCK_CORRECT += 1;
      btn.classList.add('correct');
    } else {
      BLOCK_FAILS.push(q);
      btn.classList.add('wrong');
      q.answers.forEach((answer, idx) => {
        if (answer.correct) buttons[idx].classList.add('correct');
      });
    }

    recordAnswer(APP_STATE, q, isCorrect);

    const feedback = document.createElement('div');
    feedback.innerHTML = `${renderExplanation(q)}<button class="primary-btn" id="study-continue">Continuar →</button>`;
    document.querySelector('.question-card').appendChild(feedback);
    document.querySelectorAll('.answer-btn').forEach(button => { button.disabled = true; });
    document.getElementById('study-continue').addEventListener('click', () => {
      CURRENT += 1;
      renderStudyQuestion(type, blockIndex);
    });
  });
}

function renderBlockResults(type, blockIndex) {
  const total = CURRENT_BLOCK.length;
  const accuracy = total ? Math.round((BLOCK_CORRECT / total) * 100) : 0;

  if (!BLOCK_FAILS.length) {
    view.innerHTML = `
      <section class="hero">
        <span class="badge">Bloque completado</span>
        <h2>¡Perfecto!</h2>
        <p>Has completado el bloque con ${accuracy}% de acierto.</p>
        <br>
        <button class="primary-btn" id="back-study">Volver a bloques</button>
      </section>
    `;
    document.getElementById('back-study').addEventListener('click', renderBlockSelection);
    return;
  }

  view.innerHTML = `
    <section class="hero" style="margin-bottom:24px;">
      <span class="badge">Bloque completado</span>
      <h2>${BLOCK_CORRECT} / ${total} correctas</h2>
      <p>Has fallado ${BLOCK_FAILS.length} preguntas. Se han añadido a tu repaso.</p>
    </section>

    <div class="answers">
      ${BLOCK_FAILS.map(q => `
        <section class="question-card">
          <h2>${escapeHtml(q.question)}</h2>
          <div class="answers">
            ${q.answers.map(a => `
              <div class="answer-btn ${a.correct ? 'correct' : ''}">
                <strong>${escapeHtml(a.letter.toUpperCase())})</strong>
                ${escapeHtml(a.text)}
              </div>
            `).join('')}
          </div>
          ${renderExplanation(q, { compact: true })}
        </section>
      `).join('')}
    </div>
  `;
}

function renderTestConfig() {
  const history = getTestHistory(APP_STATE);
  const lastTests = history.slice(0, 8);

  view.innerHTML = `
    <section class="hero test-config-hero">
      <span class="badge">Nuevo test</span>
      <h2>Configura tu test</h2>
      <p>Entrena con corrección inmediata o simula un examen completo.</p>
    </section>

    <section class="test-config-card">
      <div class="config-section">
        <h3>Número de preguntas</h3>
        <div class="choice-grid">
          ${[20, 50, 100].map(size => `
            <button class="choice-btn ${size === 50 ? 'selected' : ''}" data-test-size="${size}">
              <strong>${size}</strong><span>preguntas</span>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="config-section">
        <h3>Materia</h3>
        <div class="choice-grid subject-grid">
          <button class="choice-btn selected" data-test-source="all"><strong>Todo</strong><span>${QUESTIONS.length} preguntas</span></button>
          <button class="choice-btn" data-test-source="common"><strong>Común</strong><span>${COMMON.length} preguntas</span></button>
          <button class="choice-btn" data-test-source="specific"><strong>Específica</strong><span>${SPECIFIC.length} preguntas</span></button>
        </div>
      </div>

      <div class="config-section">
        <h3>Modo</h3>
        <div class="choice-grid mode-grid">
          <button class="choice-btn selected" data-test-mode="training">
            <strong>Entrenamiento</strong><span>Corrección inmediata y navegación libre.</span>
          </button>
          <button class="choice-btn" data-test-mode="exam">
            <strong>Examen</strong><span>Sin corrección hasta el final y con temporizador.</span>
          </button>
        </div>
      </div>

      <div class="exam-info" id="exam-info" hidden>
        <strong>Modo examen</strong>
        <span>Tiempo orientativo: 1 minuto por pregunta. Podrás volver atrás, marcar preguntas y revisar antes de entregar.</span>
      </div>

      <button class="primary-btn test-start-btn" id="start-configured-test">Iniciar test</button>
      <p class="config-hint" id="test-config-hint"></p>
    </section>

    <section class="dashboard-card test-history-card">
      <div class="section-heading"><div><span class="badge">Historial</span><h3>Últimos tests</h3></div></div>
      ${lastTests.length ? renderTestHistory(lastTests) : '<p class="empty-state">Todavía no has realizado ningún test.</p>'}
    </section>
  `;

  let selectedSize = 50;
  let selectedSource = 'all';
  let selectedMode = 'training';

  const updateTestHint = () => {
    const available = selectedSource === 'common' ? COMMON.length : selectedSource === 'specific' ? SPECIFIC.length : QUESTIONS.length;
    const startBtn = document.getElementById('start-configured-test');
    const hint = document.getElementById('test-config-hint');
    const valid = available >= selectedSize;
    startBtn.disabled = !valid;
    hint.textContent = valid ? `${selectedSize} preguntas seleccionadas de ${available} disponibles.` : `No hay suficientes preguntas: ${available} disponibles.`;
    document.getElementById('exam-info').hidden = selectedMode !== 'exam';
  };

  document.querySelectorAll('[data-test-size]').forEach(btn => btn.addEventListener('click', () => {
    selectedSize = Number(btn.dataset.testSize);
    document.querySelectorAll('[data-test-size]').forEach(b => b.classList.toggle('selected', b === btn));
    updateTestHint();
  }));
  document.querySelectorAll('[data-test-source]').forEach(btn => btn.addEventListener('click', () => {
    selectedSource = btn.dataset.testSource;
    document.querySelectorAll('[data-test-source]').forEach(b => b.classList.toggle('selected', b === btn));
    updateTestHint();
  }));
  document.querySelectorAll('[data-test-mode]').forEach(btn => btn.addEventListener('click', () => {
    selectedMode = btn.dataset.testMode;
    document.querySelectorAll('[data-test-mode]').forEach(b => b.classList.toggle('selected', b === btn));
    updateTestHint();
  }));
  document.getElementById('start-configured-test').addEventListener('click', () => {
    startTest({ size: selectedSize, source: selectedSource, mode: selectedMode });
  });
  updateTestHint();
}

function startTest({ size = 50, source = 'all', mode = 'training' } = {}) {
  const pool = source === 'common' ? COMMON : source === 'specific' ? SPECIFIC : QUESTIONS;
  if (pool.length < size) return;

  clearTestTimer();
  const durationSeconds = mode === 'exam' ? size * 60 : null;
  TEST_SESSION = {
    id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    size, source, mode,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    durationSeconds,
    deadline: durationSeconds ? Date.now() + durationSeconds * 1000 : null,
    questions: shuffleArray(pool).slice(0, size),
    current: 0,
    answers: {},
    marked: [],
    recorded: {},
    submittedByTimer: false
  };

  TEST_QUESTIONS = TEST_SESSION.questions;
  CURRENT = 0;
  SCORE = 0;
  FAILS = [];
  if (mode === 'exam') startTestTimer();
  renderTestQuestion();
}

function startTestTimer() {
  clearTestTimer();
  TEST_TIMER = setInterval(() => {
    if (!TEST_SESSION?.deadline) return;
    if (Date.now() >= TEST_SESSION.deadline) {
      TEST_SESSION.submittedByTimer = true;
      finishTest(false, true);
    } else {
      const timer = document.getElementById('test-timer');
      if (timer) timer.textContent = formatRemaining(TEST_SESSION.deadline - Date.now());
    }
  }, 1000);
}

function clearTestTimer() {
  if (TEST_TIMER) clearInterval(TEST_TIMER);
  TEST_TIMER = null;
}

function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60).toString().padStart(2, '0');
  const seconds = (total % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function getTestAnswer(q) {
  return TEST_SESSION?.answers?.[q.id] ?? null;
}

function renderTestQuestion() {
  if (!TEST_SESSION) { renderTestConfig(); return; }
  const q = TEST_SESSION.questions[TEST_SESSION.current];
  if (!q) { finishTest(); return; }

  const selectedIndex = getTestAnswer(q);
  const isMarked = TEST_SESSION.marked.includes(q.id);
  const hasAnswer = selectedIndex !== null;
  const selectedCorrect = hasAnswer ? Boolean(q.answers[selectedIndex]?.correct) : false;
  const answered = Object.keys(TEST_SESSION.answers).length;
  const isExam = TEST_SESSION.mode === 'exam';
  const timerText = TEST_SESSION.deadline ? formatRemaining(TEST_SESSION.deadline - Date.now()) : '';

  view.innerHTML = `
    <div class="topbar test-topbar">
      <div><span class="badge">${isExam ? 'Modo examen' : 'Modo entrenamiento'}</span><span class="test-source-label">${getSourceLabel(TEST_SESSION.source)}</span></div>
      <div class="test-status"><strong>Pregunta ${TEST_SESSION.current + 1} / ${TEST_SESSION.questions.length}</strong>${isExam ? `<span class="exam-timer" id="test-timer">${timerText}</span>` : ''}</div>
    </div>

    <div class="test-progress-wrap">
      <div class="progress-track"><div class="progress-fill" style="width:${((TEST_SESSION.current + 1) / TEST_SESSION.questions.length) * 100}%"></div></div>
      <div class="test-mini-status"><span>${answered} respondidas</span><span>${TEST_SESSION.marked.length} marcadas</span></div>
    </div>

    <section class="question-card test-question-card">
      <div class="question-meta">
        <span>Pregunta ${q.number}</span>
        <button class="mark-btn ${isMarked ? 'marked' : ''}" id="toggle-mark">${isMarked ? '★ Marcada' : '☆ Marcar'}</button>
      </div>
      <h2>${escapeHtml(q.question)}</h2>
      <div class="answers">
        ${q.answers.map((a, i) => {
          let classes = 'answer-btn';
          if (!isExam && hasAnswer && i === selectedIndex) classes += selectedCorrect ? ' correct' : ' wrong';
          if (!isExam && hasAnswer && a.correct) classes += ' correct';
          if (isExam && hasAnswer && i === selectedIndex) classes += ' selected-answer';
          return `<button class="answer-btn ${classes}" data-index="${i}" ${hasAnswer ? 'disabled' : ''}>
            <strong>${escapeHtml(a.letter.toUpperCase())})</strong> ${escapeHtml(a.text)}
          </button>`;
        }).join('')}
      </div>
      ${!isExam && hasAnswer ? `
        <div class="answer-feedback ${selectedCorrect ? 'feedback-correct' : 'feedback-wrong'}">
          <strong>${selectedCorrect ? '✓ Correcta' : '✗ Incorrecta'}</strong>
          ${!selectedCorrect ? `<span>La respuesta correcta es ${escapeHtml(q.answers.find(a => a.correct)?.letter?.toUpperCase() || '')}.</span>` : '<span>Resultado registrado en tu progreso.</span>'}
        </div>
        ${renderExplanation(q)}
        <button class="primary-btn" id="training-next">${TEST_SESSION.current === TEST_SESSION.questions.length - 1 ? 'Ver resultado' : 'Continuar →'}</button>
      ` : isExam ? '<p class="test-hint">En modo examen la respuesta no se corrige hasta entregar el examen.</p>' : '<p class="test-hint">Selecciona una respuesta. Puedes volver atrás y revisar cualquier pregunta.</p>'}
    </section>

    <div class="test-navigation">
      <button class="secondary-btn" id="test-back" ${TEST_SESSION.current === 0 ? 'disabled' : ''}>← Anterior</button>
      <button class="secondary-btn" id="test-finish">Entregar test</button>
      <button class="primary-btn" id="test-next">${TEST_SESSION.current === TEST_SESSION.questions.length - 1 ? 'Revisar resultado' : 'Siguiente →'}</button>
    </div>
  `;

  document.getElementById('toggle-mark').addEventListener('click', toggleTestMark);
  document.getElementById('test-back').addEventListener('click', () => { TEST_SESSION.current -= 1; CURRENT = TEST_SESSION.current; renderTestQuestion(); });
  document.getElementById('test-next').addEventListener('click', () => {
    if (!hasAnswer) return;
    if (TEST_SESSION.current === TEST_SESSION.questions.length - 1) finishTest(false, false);
    else { TEST_SESSION.current += 1; CURRENT = TEST_SESSION.current; renderTestQuestion(); }
  });
  document.getElementById('test-finish').addEventListener('click', () => finishTest(true, false));
  document.getElementById('training-next')?.addEventListener('click', () => {
    if (!hasAnswer) return;
    if (TEST_SESSION.current === TEST_SESSION.questions.length - 1) finishTest(false, false);
    else { TEST_SESSION.current += 1; CURRENT = TEST_SESSION.current; renderTestQuestion(); }
  });
  document.querySelectorAll('.test-question-card .answer-btn').forEach(btn => btn.addEventListener('click', () => selectTestAnswer(q, Number(btn.dataset.index))));
}

function selectTestAnswer(q, index) {
  if (Object.prototype.hasOwnProperty.call(TEST_SESSION.answers, q.id)) return;
  TEST_SESSION.answers[q.id] = index;
  if (TEST_SESSION.mode === 'training') {
    const isCorrect = Boolean(q.answers[index]?.correct);
    TEST_SESSION.recorded[q.id] = isCorrect;
    recordAnswer(APP_STATE, q, isCorrect);
  }
  renderTestQuestion();
}

function toggleTestMark() {
  const q = TEST_SESSION.questions[TEST_SESSION.current];
  const index = TEST_SESSION.marked.indexOf(q.id);
  if (index >= 0) TEST_SESSION.marked.splice(index, 1); else TEST_SESSION.marked.push(q.id);
  renderTestQuestion();
}

function finishTest(early = false, byTimer = false) {
  const session = TEST_SESSION;
  if (!session) return;
  clearTestTimer();

  if (session.mode === 'exam') {
    for (const q of session.questions) {
      if (!Object.prototype.hasOwnProperty.call(session.answers, q.id)) continue;
      if (Object.prototype.hasOwnProperty.call(session.recorded, q.id)) continue;
      const isCorrect = Boolean(q.answers[session.answers[q.id]]?.correct);
      session.recorded[q.id] = isCorrect;
      recordAnswer(APP_STATE, q, isCorrect);
    }
  }

  const answeredQuestions = session.questions.filter(q => Object.prototype.hasOwnProperty.call(session.answers, q.id));
  const correct = answeredQuestions.reduce((total, q) => total + (session.recorded[q.id] ? 1 : 0), 0);
  const unanswered = session.questions.length - answeredQuestions.length;
  const wrong = answeredQuestions.length - correct;
  const accuracy = session.questions.length ? Math.round((correct / session.questions.length) * 100) : 0;

  session.finishedAt = new Date().toISOString();
  session.correct = correct; session.wrong = wrong; session.unanswered = unanswered; session.accuracy = accuracy;
  session.completed = !early && unanswered === 0;
  session.durationSecondsActual = Math.max(0, Math.round((new Date(session.finishedAt) - new Date(session.startedAt)) / 1000));
  session.endedByTimer = byTimer;

  addTestHistory(APP_STATE, {
    id: session.id, startedAt: session.startedAt, finishedAt: session.finishedAt,
    size: session.size, source: session.source, mode: session.mode,
    correct, wrong, unanswered, accuracy, marked: session.marked.length,
    completed: session.completed, endedByTimer: byTimer,
    durationSeconds: session.durationSecondsActual
  });

  TEST_SESSION = null; TEST_QUESTIONS = [];
  renderTestResult(session);
}

function renderTestResult(session) {
  const allAnswered = session.unanswered === 0;
  const source = getSourceLabel(session.source);
  const title = session.endedByTimer ? 'Tiempo agotado' : allAnswered ? 'Test completado' : 'Test finalizado';
  const modeLabel = session.mode === 'exam' ? 'Modo examen' : 'Modo entrenamiento';
  const answerRows = session.questions.map((q, index) => {
    const answerIndex = session.answers[q.id];
    const answered = answerIndex !== undefined;
    const correct = answered && session.recorded[q.id];
    const selected = answered ? q.answers[answerIndex] : null;
    return `<div class="result-question ${correct ? 'result-correct' : answered ? 'result-wrong' : 'result-unanswered'}">
      <div class="result-question-main"><strong>${index + 1}. ${escapeHtml(q.question)}</strong><small>${answered ? `Tu respuesta: ${escapeHtml(selected.letter.toUpperCase())}) ${escapeHtml(selected.text)}` : 'Sin responder'}</small>
      <span>${correct ? '✓ Correcta' : answered ? `✗ Correcta: ${escapeHtml(q.answers.find(a => a.correct)?.letter?.toUpperCase() || '')}` : '— Sin responder'}</span></div>
      ${renderExplanation(q, { compact: true })}
    </div>`;
  }).join('');

  view.innerHTML = `
    <section class="hero test-result-hero">
      <span class="badge">${title}</span>
      <h2>${session.correct} / ${session.size} aciertos</h2>
      <p>${session.accuracy}% · ${source} · ${modeLabel} · ${formatDuration(session.durationSecondsActual)}</p>
      ${session.unanswered ? `<p class="result-warning">${session.unanswered} preguntas quedaron sin responder.</p>` : ''}
    </section>
    <section class="stats-grid test-result-stats">
      <div class="stat-card"><h3>Correctas</h3><p>${session.correct}</p></div>
      <div class="stat-card"><h3>Falladas</h3><p>${session.wrong}</p></div>
      <div class="stat-card"><h3>Sin responder</h3><p>${session.unanswered}</p></div>
      <div class="stat-card"><h3>Marcadas</h3><p>${session.marked.length}</p></div>
    </section>
    <div class="result-actions">
      <button class="primary-btn" id="new-test">Nuevo test</button>
      <button class="secondary-btn" id="result-history">Ver historial</button>
      ${session.wrong ? '<button class="secondary-btn" id="result-review">Ir a repaso</button>' : ''}
    </div>
    <section class="dashboard-card result-review-card">
      <div class="section-heading"><div><span class="badge">Corrección</span><h3>Revisión pregunta a pregunta</h3></div></div>
      <div class="result-question-list">${answerRows}</div>
    </section>
  `;
  document.getElementById('new-test').addEventListener('click', renderTestConfig);
  document.getElementById('result-history').addEventListener('click', renderTestHistoryView);
  document.getElementById('result-review')?.addEventListener('click', startReview);
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes} min ${secs.toString().padStart(2, '0')} s`;
}

function renderTestHistoryView() {
  const history = getTestHistory(APP_STATE);
  view.innerHTML = `
    <section class="hero"><span class="badge">Historial de tests</span><h2>Tus resultados</h2><p>${history.length} test${history.length === 1 ? '' : 's'} registrado${history.length === 1 ? '' : 's'}.</p></section>
    <section class="dashboard-card test-history-card">${history.length ? renderTestHistory(history) : '<p class="empty-state">Todavía no hay tests registrados.</p>'}</section>
  `;
}

function renderTestHistory(history) {
  return `<div class="test-history-list">${history.map(test => `
    <div class="test-history-item">
      <div><strong>${getSourceLabel(test.source)} · ${test.size} preguntas · ${test.mode === 'exam' ? 'Examen' : 'Entrenamiento'}</strong>
      <small>${formatDate(test.finishedAt)} · ${test.completed ? 'Completado' : 'Finalizado antes de responder todo'}${test.endedByTimer ? ' · Tiempo agotado' : ''}${test.durationSeconds != null ? ` · ${formatDuration(test.durationSeconds)}` : ''}</small></div>
      <div class="history-score"><strong>${test.accuracy}%</strong><span>${test.correct}/${test.size}</span></div>
    </div>`).join('')}</div>`;
}

function getSourceLabel(source) {
  if (source === 'common') return 'Parte común';
  if (source === 'specific') return 'Parte específica';
  return 'Todo el temario';
}

function startReview(category = null) {
  const reviewPool = getQuestionsByCategory([...COMMON, ...SPECIFIC], category);
  REVIEW_QUEUE = getReviewQuestions(APP_STATE, reviewPool, 20);
  REVIEW_CURRENT = 0;
  renderReviewQuestion();
}

function renderReviewQuestion() {
  const q = REVIEW_QUEUE[REVIEW_CURRENT];

  if (!q) {
    view.innerHTML = `
      <section class="hero">
        <span class="badge">Repaso completado</span>
        <h2>¡Buen trabajo!</h2>
        <p>No quedan preguntas prioritarias en esta sesión.</p>
      </section>
    `;
    return;
  }

  const stats = getQuestionStats(APP_STATE, q.id);

  view.innerHTML = `
    <div class="topbar">
      <div><span class="badge">Repaso inteligente</span>${q.category ? `<span class="category-badge">${escapeHtml(q.category)}</span>` : ''}</div>
      <span>${REVIEW_CURRENT + 1} / ${REVIEW_QUEUE.length}</span>
    </div>

    <section class="question-card">
      <p>Intentos: ${stats.attempts} · Fallos: ${stats.wrong}</p>
      <h2>${escapeHtml(q.question)}</h2>
      <div class="answers">
        ${q.answers.map((a, i) => `
          <button class="answer-btn" data-index="${i}">
            <strong>${escapeHtml(a.letter.toUpperCase())})</strong>
            ${escapeHtml(a.text)}
          </button>
        `).join('')}
      </div>
    </section>
  `;

  bindAnswerButtons(q, (isCorrect, btn, buttons) => {
    btn.classList.add(isCorrect ? 'correct' : 'wrong');

    if (!isCorrect) {
      q.answers.forEach((answer, idx) => {
        if (answer.correct) buttons[idx].classList.add('correct');
      });
    }

    recordAnswer(APP_STATE, q, isCorrect);

    const card = document.querySelector('.question-card');
    const feedback = document.createElement('div');
    feedback.innerHTML = `${renderExplanation(q)}<button class="primary-btn" id="review-continue">Continuar →</button>`;
    card.appendChild(feedback);
    document.getElementById('review-continue').addEventListener('click', () => {
      REVIEW_CURRENT += 1;
      renderReviewQuestion();
    });
  });
}

function bindAnswerButtons(q, callback) {
  const buttons = document.querySelectorAll('.answer-btn');
  let answered = false;

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (answered) return;
      answered = true;

      buttons.forEach(button => {
        button.disabled = true;
      });

      const index = Number(btn.dataset.index);
      callback(Boolean(q.answers[index].correct), btn, buttons);
    });
  });
}

function renderStats() {
  const questions = [...COMMON, ...SPECIFIC];
  const global = getDetailedStats(APP_STATE, questions);
  const common = getDetailedStats(APP_STATE, COMMON);
  const specific = getDetailedStats(APP_STATE, SPECIFIC);
  const weak = getTopWeakQuestions(APP_STATE, questions, 8);

  view.innerHTML = `
    <section class="hero stats-hero">
      <span class="badge">Estadísticas</span>
      <h2>Tu progreso</h2>
      <p>${global.practiced} de ${global.total} preguntas practicadas y una precisión acumulada del ${global.accuracy}%.</p>
    </section>

    <section class="stats-grid stats-summary">
      <div class="stat-card"><h3>Precisión</h3><p>${global.accuracy}%</p><small>${global.correct} aciertos de ${global.correct + global.wrong} respuestas</small></div>
      <div class="stat-card"><h3>Practicadas</h3><p>${global.practiced}</p><small>${global.pending} aún pendientes</small></div>
      <div class="stat-card"><h3>Dominadas</h3><p>${global.mastered}</p><small>Al menos 3 intentos y 80%</small></div>
      <div class="stat-card"><h3>A repasar</h3><p>${global.weak}</p><small>Prioridad de repaso</small></div>
      <div class="stat-card"><h3>Sin practicar</h3><p>${global.neverPracticed}</p><small>Preguntas nuevas</small></div>
      <div class="stat-card"><h3>Últimas 24 h</h3><p>${global.recentCorrect + global.recentWrong}</p><small>${global.recentCorrect} aciertos · ${global.recentWrong} fallos</small></div>
    </section>

    <section class="dashboard-grid">
      <div class="dashboard-card">
        <div class="section-heading"><div><span class="badge">Comparativa</span><h3>Rendimiento por parte</h3></div></div>
        ${renderMetricBar('Parte común', common.accuracy, `${common.practiced}/${common.total} practicadas · ${common.weak} a repasar`)}
        ${renderMetricBar('Parte específica', specific.accuracy, `${specific.practiced}/${specific.total} practicadas · ${specific.weak} a repasar`)}
      </div>

      <div class="dashboard-card">
        <div class="section-heading"><div><span class="badge">Última actividad</span><h3>Estado de estudio</h3></div></div>
        <div class="activity-list">
          <div><strong>Preguntas respondidas</strong><span>${global.correct + global.wrong}</span></div>
          <div><strong>Precisión en preguntas practicadas</strong><span>${global.practicedAccuracy}%</span></div>
          <div><strong>Última actividad</strong><span>${formatDate(global.lastActivity)}</span></div>
        </div>
      </div>
    </section>

    <section class="dashboard-card category-map-card">
      <div class="section-heading"><div><span class="badge">Mapa de conocimientos</span><h3>Rendimiento por tema</h3></div></div>
      <p class="section-help">Selecciona un tema para iniciar un repaso centrado en tus puntos débiles.</p>
      <div class="category-map">
        ${getCategoryStats(APP_STATE, questions, getQuestionStats).map(item => `
          <div class="category-item">
            <div class="category-header"><strong>${escapeHtml(item.category)}</strong><span>${item.attempts ? `${item.accuracy}%` : 'Sin datos'}</span></div>
            <div class="progress-track"><div class="progress-fill" style="width:${item.accuracy}%"></div></div>
            <div class="category-footer"><small>${item.practiced}/${item.total} practicadas · ${item.pending} pendientes</small><button class="secondary-btn category-review-btn" data-category="${escapeHtml(item.category)}">Repasar</button></div>
          </div>
        `).join('')}
      </div>
    </section>

    <section class="dashboard-card weak-list-card">
      <div class="section-heading"><div><span class="badge">Puntos débiles</span><h3>Preguntas que conviene repasar</h3></div></div>
      ${weak.length ? `
        <div class="weak-list">
          ${weak.map((item, index) => `
            <div class="weak-item">
              <span class="weak-rank">${index + 1}</span>
              <div class="weak-content"><strong>${escapeHtml(item.question.question)}</strong><small>${item.stats.attempts} intentos · ${item.stats.wrong} fallos · racha ${item.stats.streak}</small></div>
              <span class="accuracy-pill">${item.accuracy}%</span>
            </div>
          `).join('')}
        </div>
      ` : '<p class="empty-state">Todavía no hay datos suficientes para identificar puntos débiles.</p>'}
    </section>
  `;

  document.querySelectorAll('.category-review-btn').forEach(btn => {
    btn.addEventListener('click', () => startReview(btn.dataset.category));
  });
}

function formatDate(value) {
  if (!value) return 'Sin actividad';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}


init();
