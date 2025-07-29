// this code to deal with the questions and answers and i hide it in home.html to put it in new file
const submit = document.getElementById('Submit');
const exit = document.getElementById('Exit');
const nextBtn = document.getElementById('NextQuestion');
const previousBtn = document.getElementById('Previous');
const questionElement = document.getElementById('Question');
const answerInput = document.getElementById('answer');

const questions = {
  "What's Your name?": "",
  "What's Your favorite color?": "",
  "What's your hobby?": "",
  "What's your favorite food?": "",
  "What's your dream job?": ""
};

const timerElement = document.getElementById('timer');

window.api.examTimer();

window.api.updateTimer((event, timeLeft) => {
  const timerElement = document.getElementById('timer');
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

const questionKeys = Object.keys(questions);
let currentQuestionIndex = 0;

function updateUI() {
  const currentQuestion = questionKeys[currentQuestionIndex];
  questionElement.innerText = currentQuestion;
  answerInput.value = questions[currentQuestion] || "";
  previousBtn.style.display = currentQuestionIndex === 0 ? 'none' : 'inline-block';
  exit.style.display = currentQuestionIndex === 0 ? 'block' : 'none';
  nextBtn.style.display = currentQuestionIndex === questionKeys.length - 1 ? 'none' : 'inline-block';
  submit.style.display = currentQuestionIndex === questionKeys.length - 1 ? 'inline-block' : 'none';
}

function goToNextQuestion() {
  saveAnswer();
  if (currentQuestionIndex < questionKeys.length - 1) {
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


function saveAnswer() {
  const currentQuestion = questionKeys[currentQuestionIndex];
  questions[currentQuestion] = answerInput.value.trim();
}


nextBtn.addEventListener('click', goToNextQuestion);
previousBtn.addEventListener('click', goToPreviousQuestion);

exit.addEventListener('click', () => {
  const confirmExit = confirm('Are you sure you want to exit the exam? Your answers will not be saved.');
  if (confirmExit) {
    window.api.exitExam();
  }
});


updateUI();

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

exit.addEventListener('click', () => {
  const confirmExit = confirm('Are you sure you want to exit the exam? Your answers will not be saved.');
  if (confirmExit) {
    stopRecording();
    window.api.exitExam();
  }
});
