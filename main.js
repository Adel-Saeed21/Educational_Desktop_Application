const { default: axios } = require("axios");
const {app, BrowserWindow, ipcMain}=require("electron");
const path = require('path');
let mainWindow;
let currentUser = null;
let currentPassword = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        height:800,
        width:1200,
        webPreferences:{
            preload:path.join(__dirname, 'preload.js'),
            contextIsolation:true,
            nodeIntegration:false,
        }
    });
    mainWindow.loadFile('src/renderer/home.html');

}
ipcMain.handle('start-exam', async () => {
    mainWindow.loadFile('src/renderer/exam_screen.html');
    return { success: true };
});

ipcMain.handle('exit-exam', async () => {
    mainWindow.loadFile('src/renderer/home.html'); });
    

ipcMain.handle('login',async(event,email,password)=>{
    // currentUser=username;
    // currentPassword=password;
    // mainWindow.loadFile('src/renderer/home.html');
    const response=await axios.post('http://localhost:8000/api/auth/login/',{
            email:email,
            password:password,
    }).then((response) => {
        currentUser = response.data.user.name;
        currentPassword = response.data.user.password;
        mainWindow.loadFile('src/renderer/home.html');
        return {success: true, user: response.data.user};
    }).catch((error) => {
        console.error('Login failed:', error);
        return {success: false, message: 'Login failed. Please check your credentials.'};
    });
    return response;
});

ipcMain.on('logout', (event) => {
    currentUser = null;
    currentPassword = null;
    mainWindow.loadFile('src/renderer/login_screen.html');    
})


ipcMain.handle('get-username', () => {
    return {currentUser, currentPassword}; });


app.whenReady().then(createWindow);
app.on('closed-all-windows', () => {
    if (process.platform !== 'darwin') app.quit();});
