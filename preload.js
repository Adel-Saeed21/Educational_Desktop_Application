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
    
});
