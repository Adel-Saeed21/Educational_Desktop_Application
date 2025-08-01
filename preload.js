const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Auth
  login: (email, password) => ipcRenderer.invoke('login', email, password),
  logout: () => ipcRenderer.send('logout'),
  getUsername: () => ipcRenderer.invoke('get-username'),
  checkJustLoggedIn: () => ipcRenderer.invoke("checkJustLoggedIn"),

  // Token
  saveToken: (token) => ipcRenderer.invoke('save-token', token),
  getToken: () => ipcRenderer.invoke('get-token'),

  // Courses & Quizzes
  getCourseList: () => ipcRenderer.invoke('get-course-list'),
  getCurrentQuizes: () => ipcRenderer.invoke('get-current-quizes'),
  submitQuiz: (quizId, answers) => ipcRenderer.invoke("submit-quiz", quizId, answers),
  getResult: () => ipcRenderer.invoke("get-result"),
  getResultSolutions: (index) => ipcRenderer.invoke("get-result-solutions", index),
  navigateToDetails: () => ipcRenderer.invoke("navigate-to-details"),

  // Exam Flow
  startEXam: (id) => ipcRenderer.invoke('start-exam', id),
  getQuizData: () => ipcRenderer.invoke('get-quiz-data'),
  getQuestions: () => ipcRenderer.invoke('get-questions'),
  getAnswers: () => ipcRenderer.invoke('get-answers'),
  getCurrentQuestionIndex: () => ipcRenderer.invoke('get-current-question-index'),
  nextQuestion: () => ipcRenderer.invoke('next-question'),
  previousQuestion: () => ipcRenderer.invoke('previous-question'),
  saveAnswer: (question, answer) => ipcRenderer.invoke('save-answer', question, answer),
  submitAnswer: (question, answer) => ipcRenderer.invoke('submit-answer', question, answer),
  submitAndExit: () => ipcRenderer.invoke('proceed-exit'),
  exitExam: () => ipcRenderer.invoke('exit-exam'),
  confirmExit: () => ipcRenderer.invoke('confirm-exit'),
  onConfirmExit: (callback) => ipcRenderer.on('confirm-exit', callback),

  // Timer
  examTimer: () => ipcRenderer.invoke('exam-timer'),
  updateTimer: (callback) => ipcRenderer.on('update-timer', callback),
  timerFinished: () => ipcRenderer.on('timer-finished', () => {
    alert('Time is up! Submitting your answers.');
    ipcRenderer.invoke('submit-answers');
    ipcRenderer.invoke('exit-exam');
  }),

  // Recording
  getSources: () => ipcRenderer.invoke('get-sources'),
  startRecording: (sourceId) => ipcRenderer.invoke('start-recording', sourceId),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  saveRecording: (buffer) => ipcRenderer.invoke('save-recording', buffer)
});
