
export async function loadQuestions(){

  const files = [
    'assets/data/comun.json',
    'assets/data/especifica.json'
  ];

  const questions = [];

  for(const file of files){

    const response = await fetch(file);
    const data = await response.json();

    const list = Array.isArray(data)
      ? data
      : data.questions;

    list.forEach(q => questions.push(q));
  }

  return questions;
}
