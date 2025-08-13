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

  saveAnswer: (question, answer) => ipcRenderer.invoke('save-answer', question, answer),
  submitAnswer: (question, answer) => ipcRenderer.invoke('submit-answer', question, answer),
  submitAndExit: () => ipcRenderer.invoke('proceed-exit'),
  exitExam: () => ipcRenderer.invoke('exit-exam'),
  confirmExit: () => ipcRenderer.invoke('confirm-exit'),


  // Timer
  examTimer: () => ipcRenderer.invoke('exam-timer'),
  updateTimer: (callback) => ipcRenderer.on('update-timer', callback),
  timerFinished: () => ipcRenderer.on('timer-finished', () => {
    alert('Time is up! Submitting your answers.');
    ipcRenderer.invoke('submit-answers');
    ipcRenderer.invoke('exit-exam');
  }),
  getExamData: () => ipcRenderer.invoke("get-exam-data"),
  // Recording
  getSources: () => ipcRenderer.invoke('get-sources'),
  startRecording: (sourceId) => ipcRenderer.invoke('start-recording', sourceId),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  saveRecording: (buffer) => ipcRenderer.invoke('save-recording', buffer),
  onForceExit: (callback) => ipcRenderer.on('force-exit', callback),
  onTryExit: (callback) => ipcRenderer.on('try-exit', callback),
  setPreventClose: (value) => ipcRenderer.send('set-prevent-close', value),
  startTimer: (duration) => ipcRenderer.send('start-timer', duration),
  stopTimer: () => ipcRenderer.send('stop-timer'),

  //forget password
  sendOtp: (email) => ipcRenderer.invoke('send-otp', email),
  verifyOtp: (email, otp) => ipcRenderer.invoke('verify-otp', { email, otp }),
  resetPassword: (email, otp, newPassword) => ipcRenderer.invoke('reset-password', { email, otp, newPassword }),

  //stream data
    startQuizzesStream: () => ipcRenderer.invoke("start-quizzes-stream"),

  onCurrentQuizzesUpdate: (callback) => {
    ipcRenderer.on("current-quizzes-updated", (_event, data) => {
      callback(data);
    });
  },
  startResultsStream: () => ipcRenderer.invoke('start-results-stream'),
  onCurrentQuizzesUpdate: (callback) => {
    ipcRenderer.on('results-updated', (_event, results) => {
      callback(results);
    });
  },
});
