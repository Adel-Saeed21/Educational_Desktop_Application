const submit = document.getElementById('Submit');
const exit = document.getElementById('Exit');
const nextBtn = document.getElementById('NextQuestion');
const previousBtn = document.getElementById('Previous');
const questionElement = document.getElementById('Question');
const answerInput = document.getElementById('answer');
const timerElement = document.getElementById('timer');

let quizQuestions = [];
let answers = {};
let currentQuestionIndex = 0;

// ✅ Timer functions
window.api.examTimer();

window.api.updateTimer((event, timeLeft) => {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  timerElement.innerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  if (timeLeft <= 10) {
    timerElement.style.color = 'red';
    timerElement.style.fontWeight = 'bold';
    timerElement.style.animation = 'blinker 1s linear infinite'; 
  } else {
    timerElement.style.color = '#00ffcc'; 
    timerElement.style.animation = 'none';
  }
});

window.api.timerFinished();

function updateUI() {
  const question = quizQuestions[currentQuestionIndex];
  if (!question) return;

  questionElement.innerText = `Q${currentQuestionIndex + 1}: ${question.question_text} (${question.points} pts)`;
  answerInput.value = answers[question.id] || "";

  previousBtn.style.display = currentQuestionIndex === 0 ? 'none' : 'inline-block';
  exit.style.display = currentQuestionIndex === 0 ? 'block' : 'none';
  nextBtn.style.display = currentQuestionIndex === quizQuestions.length - 1 ? 'none' : 'inline-block';
  submit.style.display = currentQuestionIndex === quizQuestions.length - 1 ? 'inline-block' : 'none';
}

function saveAnswer() {
  const question = quizQuestions[currentQuestionIndex];
  answers[question.id] = answerInput.value.trim();
}

function goToNextQuestion() {
  saveAnswer();
  if (currentQuestionIndex < quizQuestions.length - 1) {
    currentQuestionIndex++;
    updateUI();
  }
}

function goToPreviousQuestion() {
  saveAnswer();
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    updateUI();
  }
}

nextBtn.addEventListener('click', goToNextQuestion);
previousBtn.addEventListener('click', goToPreviousQuestion);

exit.addEventListener('click', () => {
  const confirmExit = confirm('Are you sure you want to exit the exam?');
  if (confirmExit) {
    window.api.exitExam();
  }
});

submit.addEventListener('click', () => {
  saveAnswer();
  console.log("Submitted answers:", answers);
});

window.api.getQuizData().then((response) => {
  console.log('-----------------------------\n', JSON.stringify(response, null, 2), '\n\n');
  
  if (response && response.questions) {
    quizQuestions = response.questions;
    updateUI();
  } else {
    questionElement.innerText = 'Failed to load quiz questions.';
  }
});
