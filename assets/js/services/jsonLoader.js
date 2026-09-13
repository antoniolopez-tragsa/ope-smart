async function loadFile(file) {
  const response = await fetch(file);

  if (!response.ok) {
    throw new Error(`No se pudo cargar ${file}: HTTP ${response.status}`);
  }

  const data = await response.json();
  const questions = Array.isArray(data) ? data : data.questions;

  if (!Array.isArray(questions)) {
    throw new Error(`Formato de preguntas no válido en ${file}`);
  }

  return questions;
}

export async function loadQuestions() {
  const [common, specific] = await Promise.all([
    loadFile('assets/data/comun.json'),
    loadFile('assets/data/especifica.json')
  ]);

  return { common, specific, all: [...common, ...specific] };
}
