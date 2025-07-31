const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    login: (email, password) => ipcRenderer.invoke('login', email, password),
    getUsername: () => ipcRenderer.invoke('get-username'),
    logout: () => ipcRenderer.send('logout'),

    // Exam Flow
    startEXam: (id) => ipcRenderer.invoke('start-exam', id),
    getQuizData: () => ipcRenderer.invoke('get-quiz-data'), 
    submitAnswer: (question, answer) => ipcRenderer.invoke('submit-answer', question, answer),
    getQuestions: () => ipcRenderer.invoke('get-questions'),
    getAnswers: () => ipcRenderer.invoke('get-answers'),
    getCurrentQuestionIndex: () => ipcRenderer.invoke('get-current-question-index'),
    nextQuestion: () => ipcRenderer.invoke('next-question'),
    previousQuestion: () => ipcRenderer.invoke('previous-question'),
    saveAnswer: (question, answer) => ipcRenderer.invoke('save-answer', question, answer),
    exitExam: () => ipcRenderer.invoke('exit-exam'),
    getResultSolutions:()=>ipcRenderer.invoke("get-result-solutions"),
      navigateToDetails: () => ipcRenderer.invoke("navigate-to-details"),

    // Timer
    examTimer: () => ipcRenderer.invoke('exam-timer'),
    updateTimer: (callback) => ipcRenderer.on('update-timer', callback),
    timerFinished: () => ipcRenderer.on('timer-finished', (event) => {
        alert('Time is up! Submitting your answers.');
        ipcRenderer.invoke('submit-answers');
        ipcRenderer.invoke('exit-exam');
    }),
    //LOCAL storage

      saveToken: (token) => ipcRenderer.invoke('save-token', token),
      getToken: () => ipcRenderer.invoke('get-token'),

    // Courses & Quizzes
    getCourseList: () => ipcRenderer.invoke('get-course-list'),
    getCurrentQuizes: () => ipcRenderer.invoke('get-current-quizes'),
    checkJustLoggedIn: () => ipcRenderer.invoke("checkJustLoggedIn"),

    //submit quiz
    submitQuiz: (quizId, answers) => ipcRenderer.invoke("submit-quiz", quizId, answers),
    


    //get result
    getResult:()=>ipcRenderer.invoke("get-result"),



getSources: () => ipcRenderer.invoke('get-sources'),
  startRecording: (sourceId) => ipcRenderer.invoke('start-recording', sourceId),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  saveRecording: (buffer) => ipcRenderer.invoke('save-recording', buffer),


    //get Screen Stream
  
});

