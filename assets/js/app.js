
import { loadQuestions } from './services/jsonLoader.js';

let QUESTIONS = [];
let COMMON = [];
let SPECIFIC = [];

let CURRENT = 0;
let CURRENT_BLOCK = [];
let BLOCK_FAILS = [];

let SCORE = 0;
let FAILS = [];

const view = document.getElementById('view');

async function init(){

  QUESTIONS = await loadQuestions();

  splitQuestions();

  setupNavigation();
  renderHome();
}

function splitQuestions(){

  COMMON = QUESTIONS.slice(0, 200);
  SPECIFIC = QUESTIONS.slice(200, 400);
}

function shuffleArray(array){

  return [...array].sort(() => Math.random() - 0.5);
}

function setupNavigation(){

  document.querySelectorAll('.menu-btn').forEach(btn => {

    btn.addEventListener('click', () => {

      document.querySelectorAll('.menu-btn')
        .forEach(b => b.classList.remove('active'));

      btn.classList.add('active');

      const page = btn.dataset.view;

      switch(page){

        case 'home':
          renderHome();
          break;

        case 'study':
          renderBlockSelection();
          break;

        case 'test':
          startTest();
          break;

        case 'review':
          renderReview();
          break;

        case 'stats':
          renderStats();
          break;
      }
    });
  });
}

function renderHome(){

  view.innerHTML = `

    <div class="topbar">
      <span class="badge">Preparación OPE</span>
    </div>

    <section class="hero">

      <h2>Estudia de forma inteligente</h2>

      <p>
        Plataforma moderna con estudio por bloques, repaso inteligente,
        estadísticas y progreso persistente.
      </p>

    </section>
  `;
}

function renderBlockSelection(){

  const blockSize = 20;

  let html = `
    <div class="topbar">
      <span class="badge">Estudio por bloques</span>
    </div>

    <section class="hero" style="margin-bottom:24px;">
      <h2>Parte común</h2>
      <p>10 bloques de 20 preguntas</p>
    </section>

    <div class="blocks-grid">
  `;

  for(let i=0;i<10;i++){

    const start = i * blockSize + 1;
    const end = start + 19;

    html += `
      <div class="block-card">
        <h3>Común · Bloque ${i+1}</h3>

        <p>Preguntas ${start} - ${end}</p>

        <button class="primary-btn"
          onclick="window.startBlock('common', ${i})">
          Estudiar bloque
        </button>
      </div>
    `;
  }

  html += `
    </div>

    <section class="hero" style="margin:40px 0 24px;">
      <h2>Parte específica</h2>
      <p>10 bloques de 20 preguntas</p>
    </section>

    <div class="blocks-grid">
  `;

  for(let i=0;i<10;i++){

    const start = i * blockSize + 1;
    const end = start + 19;

    html += `
      <div class="block-card">
        <h3>Específica · Bloque ${i+1}</h3>

        <p>Preguntas ${start} - ${end}</p>

        <button class="primary-btn"
          onclick="window.startBlock('specific', ${i})">
          Estudiar bloque
        </button>
      </div>
    `;
  }

  html += '</div>';

  view.innerHTML = html;
}

window.startBlock = function(type, blockIndex){

  const blockSize = 20;

  const source = type === 'common'
    ? COMMON
    : SPECIFIC;

  const start = blockIndex * blockSize;
  const end = start + blockSize;

  CURRENT_BLOCK = source.slice(start, end);

  CURRENT = 0;
  BLOCK_FAILS = [];

  renderStudyQuestion(type, blockIndex);
}

function renderStudyQuestion(type, blockIndex){

  const q = CURRENT_BLOCK[CURRENT];

  if(!q){

    renderBlockResults(type, blockIndex);
    return;
  }

  view.innerHTML = `
    <div class="topbar">
      <span class="badge">
        ${type === 'common' ? 'Parte común' : 'Parte específica'}
      </span>

      <span>
        Bloque ${blockIndex + 1} ·
        ${CURRENT + 1} / ${CURRENT_BLOCK.length}
      </span>
    </div>

    <section class="question-card">

      <h2>${q.question}</h2>

      <div class="answers">

        ${q.answers.map((a, i) => `
          <button class="answer-btn" data-index="${i}">
            <strong>${a.letter.toUpperCase()})</strong>
            ${a.text}
          </button>
        `).join('')}

      </div>

    </section>
  `;

  document.querySelectorAll('.answer-btn').forEach(btn => {

    btn.addEventListener('click', () => {

      const index = Number(btn.dataset.index);

      const buttons = document.querySelectorAll('.answer-btn');

      if(q.answers[index].correct){

        btn.classList.add('correct');

      }else{

        btn.classList.add('wrong');

        BLOCK_FAILS.push(q);

        q.answers.forEach((answer, idx) => {

          if(answer.correct){
            buttons[idx].classList.add('correct');
          }

        });
      }

      setTimeout(() => {

        CURRENT++;

        renderStudyQuestion(type, blockIndex);

      }, 1400);
    });
  });
}


function renderBlockResults(type, blockIndex){

  if(BLOCK_FAILS.length === 0){

    view.innerHTML = `
      <section class="hero">

        <span class="badge">Bloque completado</span>

        <h2>¡Perfecto!</h2>

        <p>
          Has completado el bloque sin errores.
        </p>

        <br>

        <button class="primary-btn"
          onclick="window.location.reload()">
          Volver al inicio
        </button>

      </section>
    `;

    return;
  }

  view.innerHTML = `

    <section class="hero" style="margin-bottom:24px;">

      <span class="badge">Bloque completado</span>

      <h2>Preguntas falladas</h2>

      <p>
        Has fallado ${BLOCK_FAILS.length} preguntas en este bloque.
      </p>

    </section>

    <div class="answers">

      ${BLOCK_FAILS.map(q => `

        <section class="question-card">

          <h2>${q.question}</h2>

          <div class="answers">

            ${q.answers.map(a => `

              <div class="answer-btn ${a.correct ? 'correct' : ''}">

                <strong>${a.letter.toUpperCase()})</strong>
                ${a.text}

              </div>

            `).join('')}

          </div>

        </section>

      `).join('')}

    </div>
  `;
}



function startTest(){

  CURRENT = 0;
  SCORE = 0;
  FAILS = [];

  QUESTIONS = shuffleArray([
    ...COMMON,
    ...SPECIFIC
  ]).slice(0, 50);

  renderTestQuestion();
}

function renderTestQuestion(){

  const q = QUESTIONS[CURRENT];

  if(!q){

    localStorage.setItem('opeFails', JSON.stringify(FAILS));
    localStorage.setItem('opeScore', SCORE);

    view.innerHTML = `
      <section class="hero">
        <span class="badge">Resultado</span>

        <h2>${SCORE} aciertos</h2>

        <p>
          Has completado el test completo.
        </p>
      </section>
    `;

    return;
  }

  view.innerHTML = `
    <div class="topbar">
      <span class="badge">Modo test</span>

      <span>${CURRENT + 1} / ${QUESTIONS.length}</span>
    </div>

    <section class="question-card">

      <h2>${q.question}</h2>

      <div class="answers">

        ${q.answers.map((a, i) => `
          <button class="answer-btn" data-index="${i}">
            <strong>${a.letter.toUpperCase()})</strong>
            ${a.text}
          </button>
        `).join('')}

      </div>

    </section>
  `;

  document.querySelectorAll('.answer-btn').forEach(btn => {

    btn.addEventListener('click', () => {

      const index = Number(btn.dataset.index);

      if(q.answers[index].correct){

        SCORE++;

        btn.classList.add('correct');

      }else{

        FAILS.push(q);

        btn.classList.add('wrong');
      }

      setTimeout(() => {

        CURRENT++;

        renderTestQuestion();

      }, 800);
    });
  });
}

function renderReview(){

  const fails = JSON.parse(localStorage.getItem('opeFails') || '[]');

  if(!fails.length){

    view.innerHTML = `
      <section class="hero">

        <h2>No hay preguntas falladas</h2>

        <p>
          Completa primero un test para generar repaso inteligente.
        </p>

      </section>
    `;

    return;
  }

  const q = fails[Math.floor(Math.random() * fails.length)];

  view.innerHTML = `
    <section class="question-card">

      <h2>${q.question}</h2>

      <div class="answers">

        ${q.answers.map(a => `
          <button class="answer-btn">
            <strong>${a.letter.toUpperCase()})</strong>
            ${a.text}
          </button>
        `).join('')}

      </div>

    </section>
  `;
}

function renderStats(){

  const score = Number(localStorage.getItem('opeScore') || 0);

  const fails = JSON.parse(localStorage.getItem('opeFails') || '[]');

  view.innerHTML = `
    <div class="stats-grid">

      <div class="stat-card">
        <h3>Aciertos</h3>
        <p>${score}</p>
      </div>

      <div class="stat-card">
        <h3>Preguntas falladas</h3>
        <p>${fails.length}</p>
      </div>

      <div class="stat-card">
        <h3>Total preguntas</h3>
        <p>${QUESTIONS.length}</p>
      </div>

      <div class="stat-card">
        <h3>Parte común</h3>
        <p>${COMMON.length}</p>
      </div>

      <div class="stat-card">
        <h3>Parte específica</h3>
        <p>${SPECIFIC.length}</p>
      </div>

    </div>
  `;
}

init();
