const { contextBridge, ipcRenderer , desktopCapturer} = require('electron');

contextBridge.exposeInMainWorld('api', {
    login: (email, password) => ipcRenderer.invoke('login', email, password),

    getUsername: () => ipcRenderer.invoke('get-username'),
    logout: () => ipcRenderer.send('logout'),
    startEXam: () => ipcRenderer.invoke('start-exam'),
    submitAnswer: (question, answer) => ipcRenderer.invoke('submit-answer', question, answer),
    getQuestions: () => ipcRenderer.invoke('get-questions'),
    getAnswers: () => ipcRenderer.invoke('get-answers'),
    getCurrentQuestionIndex: () => ipcRenderer.invoke('get-current-question-index'),
    nextQuestion: () => ipcRenderer.invoke('next-question'),
    previousQuestion: () => ipcRenderer.invoke('previous-question'),
    saveAnswer: (question, answer) => ipcRenderer.invoke('save-answer', question, answer),
    exitExam: () => ipcRenderer.invoke('exit-exam'),
    examTimer: () => ipcRenderer.invoke('exam-timer'),
    updateTimer: (callback) => ipcRenderer.on('update-timer', callback),
    timerFinished: () => ipcRenderer.on('timer-finished', (event) => {
        alert('Time is up! Submitting your answers.');
        ipcRenderer.invoke('submit-answers');
        ipcRenderer.invoke('exit-exam');
    }),
    getScreenStream: async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    const source = sources[0];
    return await navigator.mediaDevices.getUserMedia({
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
  }
});
