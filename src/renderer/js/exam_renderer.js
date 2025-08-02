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
let isRecording = false;
let timer;
window.api.getQuizData().then((response) => {
  console.log('-----------------------------\n', JSON.stringify(response, null, 2), '\n\n');
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
    let timeLeft = res.timerDuration;

    updateTimerDisplay(timeLeft); // أول عرض للوقت

    const countdown = setInterval(() => {
      timeLeft--;

      if (timeLeft <= 0) {
        clearInterval(countdown);
        window.api.timerFinished(); // أي شيء بيتم بعد انتهاء الوقت
        submitExam(); // تسليم الامتحان تلقائيًا
        return;
      }

      updateTimerDisplay(timeLeft);
    }, 1000);
  }
});


window.api.onForceExit(async () => {
  await submitExam();
  window.close(); 
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
window.api.setPreventClose(true); 

window.api.onTryExit(() => {
  showToast(); 
});


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
  answers[question.id] = answerInput.value; 
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

exit.addEventListener('click', async () => {
  const confirmExit = confirm('Are you sure you want to exit the exam? Your answers will be submitted.');
  if (confirmExit) {
    await submitExam(); // 1. Submit answers
    window.api.exitExam(); // 2. Navigate back to Home screen
  }
});

// Submit answers and stop recording
submit.addEventListener('click', async () => {
  await submitExam();
});



async function submitExam() {
  saveAnswer();
  stopRecording();

  const answersArray = Object.entries(answers).map(([question_id, answer_text]) => ({
  question_id: Number(question_id),
  answer_text: (answer_text || "").trim()
}));


  const quizId = window.quizId || (quizQuestions.length > 0 ? quizQuestions[0].quiz : null);

  if (!quizId) {
    alert("Quiz ID not found.");
    return;
  }

  const result = await window.api.submitQuiz(quizId, answersArray);

  if (result.success) {
    alert(result.detail);
    window.api.exitExam();
  } else {
    alert(result.message || "Failed to submit quiz.");
  }
}


// Show recording status if element exists
const recordingStatus = document.getElementById('recordingStatus');
if (recordingStatus) {
  recordingStatus.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
  startRecording();
    setInterval(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      console.log('✅ Still recording...');
    } else {
      console.warn('⚠️ Not recording!');
    }
  }, 10000); 
});

// MediaRecorder and chunks for recording
let mediaRecorder; 
let Chunks = []; 



/*start recording*/
async function startRecording() {
  try {
    const sources = await window.api.getSources();
    const source = sources[0];

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id,
          minWidth: 1280,
          maxWidth: 1280,
          minHeight: 720,
          maxHeight: 720
        }
      }
    });

    mediaRecorder = new MediaRecorder(stream);
    Chunks = [];

    mediaRecorder.ondataavailable = (e) => Chunks.push(e.data);
 mediaRecorder.onstop = async () => {
  const blob = new Blob(Chunks, { type: 'video/webm' });
const arrayBuffer = await blob.arrayBuffer();
await window.api.saveRecording(arrayBuffer); 

};



    mediaRecorder.start();
    isRecording = true;
    console.log("✅ Recording started");
  } catch (err) {
    console.error("❌ Failed to start recording:", err);
  }
}


/*start recording*/

/*stop recording*/
function stopRecording() {
   if (!isRecording) return;
  isRecording = false;
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    console.log('Recording stopped.');
  }
}
/*stop recording*/


function showToast() {
  const toast = document.getElementById("toast");
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, 3000);
}
window.api.onTryExit(() => {
  showToast();
});

