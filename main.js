const {app, BrowserWindow, ipcMain}=require("electron");
const path = require('path');
let mainWindow;
let currentUser = null;
let currentPassword = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        height:800,
        width:800,
        webPreferences:{
            preload:path.join(__dirname, 'preload.js'),
            contextIsolation:true,
            nodeIntegration:false,
        }
    });
    mainWindow.loadFile('src/renderer/loginScreen.html');

}

ipcMain.on('login',(event,username,password)=>{
    currentUser=username;
    currentPassword=password;
    mainWindow.loadFile('src/renderer/home.html');
});


ipcMain.handle('get-username', () => {
    return {currentUser, currentPassword}; });


app.whenReady().then(createWindow);
app.on('closed-all-windows', () => {
    if (process.platform !== 'darwin') app.quit();});
