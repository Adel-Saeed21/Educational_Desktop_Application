const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    login: (email, password) =>
    new Promise((resolve, reject) => {
      ipcRenderer.once('login-result', (event, result) => {
        resolve(result);
      });
      ipcRenderer.invoke('login', email, password);
    }),
    

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
    
});
