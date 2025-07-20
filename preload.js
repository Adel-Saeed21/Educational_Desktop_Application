const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    login: (username,password) => ipcRenderer.send('login', username,password),
    getUsername: () => ipcRenderer.invoke('get-username')
});
