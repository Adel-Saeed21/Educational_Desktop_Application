window.api.getUsername().then(({ currentUser }) => {
  document.getElementById('username').innerText = `Welcome, ${currentUser}`;
});

function logout() {
  location.href = 'login_screen.html';
}




// this code to deal with the questions and answers and i hide it in home.html to put it in new file
const submit = document.getElementById('Submit');
const exit = document.getElementById('Exit');
const nextBtn = document.getElementById('NextQuestion');
const previousBtn = document.getElementById('Previous');
const questionElement = document.getElementById('Question');
const answerInput = document.getElementById('answer');

const questions = [
  "What's Your name?",
  "What's Your favorite color?",
  "What's your hobby?",
  "What's your favorite food?",
  "What's your dream job?"
];

let currentQuestionIndex = 0;

function updateUI() {
  
  questionElement.innerText = questions[currentQuestionIndex];
  answerInput.value = '';

 if (currentQuestionIndex === 0) {
    previousBtn.style.display = 'none';
    exit.style.display = 'block';
  } else {nextBtn.addEventListener('click', goToNextQuestion);

    previousBtn.style.display = 'inline-block';
    exit.style.display = 'none';
  }

  if (currentQuestionIndex === questions.length - 1) {
    nextBtn.style.display = 'none';
    submit.style.display = 'inline-block';
  } else {
    nextBtn.style.display = 'inline-block';
    submit.style.display = 'none';
  }
}

function goToNextQuestion() {
  if (currentQuestionIndex < questions.length - 1) {
    currentQuestionIndex++;
    updateUI();
  }
}

function goToPreviousQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    updateUI();
  }
}

nextBtn.addEventListener('click', goToNextQuestion);
previousBtn.addEventListener('click', goToPreviousQuestion);

updateUI();
  