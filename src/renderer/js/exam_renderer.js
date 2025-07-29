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
let timer;
window.api.getQuizData().then((response) => {
  console.log('-----------------------------\n', JSON.stringify(response, null, 2), '\n\n');
  timer=response.duration;
  if (response && response.questions) {
    quizQuestions = response.questions;
    updateUI();
  } else {
    questionElement.innerText = 'Failed to load quiz questions.';
  }
});
// ✅ Timer functions

window.api.examTimer().then((res) => {
  if (res.success) {
    console.log("✅ Timer started:", res.timerDuration);
    updateTimerDisplay(res.timerDuration); 
  }
});



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

  // Update question text
  document.getElementById('questionText').innerText = `Q${currentQuestionIndex + 1}: ${question.question_text}`;

  const pointsContainer = document.getElementById('questionPoints');
  pointsContainer.querySelector('span:last-child').innerText = `${question.points} pts`;

  answerInput.value = answers[question.id] || "";

  previousBtn.style.display = currentQuestionIndex === 0 ? 'none' : 'inline-block';
  exit.style.display = currentQuestionIndex === 0 ? 'block' : 'none';
  nextBtn.style.display = currentQuestionIndex === quizQuestions.length - 1 ? 'none' : 'inline-block';
  submit.style.display = currentQuestionIndex === quizQuestions.length - 1 ? 'inline-block' : 'none';
}

function updateTimerDisplay(timeLeft) {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  timerElement.innerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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
  stopRecording();
  console.log("Submitted answers:", answers);
});



// Show recording status if element exists
const recordingStatus = document.getElementById('recordingStatus');
if (recordingStatus) {
  recordingStatus.style.display = 'block';
}

startRecording();

// MediaRecorder and chunks for recording
let mediaRecorder; 
let Chunks = []; 



/*start recording*/
async function startRecording() {
  try {
    const stream = await window.api.getScreenStream();
    const previewVideo = document.getElementById('screenPreview');
    if (previewVideo) {
      previewVideo.srcObject = stream;
    }
    Chunks = [];
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        Chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      try {
        const blob = new Blob(Chunks, { type: 'video/webm' });
        const buffer = Buffer.from(await blob.arrayBuffer());

        const fs = require('fs');
        const path = require('path');
        fs.writeFile(path.join(__dirname, 'exam_recording.webm'), buffer, (err) => {
          if (err) {
            console.error('Failed to save recording:', err);
          } else {
            console.log('Screen recording saved!');
          }
        });
      } catch (err) {
        console.error('Error processing recording:', err);
      }
    };

    mediaRecorder.start();
    console.log('Recording started.');
  } catch (err) {
    console.error('Failed to start screen recording:', err);
  }
}
/*start recording*/

/*stop recording*/
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    console.log('Recording stopped.');
  }
}
/*stop recording*/

