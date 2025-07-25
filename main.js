const { default: axios } = require("axios");
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

// const Store = require('electron-store');
// const userStore = new Store({
//   name: 'user-preferences',
//   defaults: {
//     studentToken: null,
//     currentUser: '',
//     currentPassword: '',
//   },
//   encryptionKey: 'secret-key-123'  // اختيارية للتشفير
// });

let mainWindow;
// let currentUser = userStore.get("currentUser") || null;
// let currentPassword = userStore.get("currentPassword") || null;
// let studentToken = userStore.get("studentToken") || null;
let currentUser=null;
let currentPassword=null;
let studentToken=null;

//in create window function i check if the user is logged in or not
// if the user is logged in i load home.html otherwise i load login_screen.html
// this is done by checking the studentToken in the userStore

function createWindow() {
  mainWindow = new BrowserWindow({
    height: 800,
    width: 1200,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
mainWindow.loadFile("src/renderer/home.html");
  // if (studentToken) {
  //   mainWindow.loadFile("src/renderer/home.html");
  // } else {
    
  // }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// -------------------------------------------------------------------------------------------------------------------------------------------------

// IPC handlers for exam timer , start exam and exit exam

ipcMain.handle("exam-timer", async () => {
  const timerDuration = 20;
  let timeLeft = timerDuration;
  const timerInterval = setInterval(() => {
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      mainWindow.webContents.send("timer-finished");
    } else {
      timeLeft--;
      mainWindow.webContents.send("update-timer", timeLeft);
    }
  }, 1000);
  return { success: true, timerDuration };
});

ipcMain.handle("start-exam", async () => {
  mainWindow.loadFile("src/renderer/exam_screen.html");
  return { success: true };
});

ipcMain.handle("exit-exam", async () => {
  mainWindow.loadFile("src/renderer/home.html");
});

//------------------------------------------------------------------------------------------------------------------------------------------------------------------

// for Login  i use axios to connect with the backend and electron store to save the token
ipcMain.handle("login", async (event, email, password) => {
  if (!email || !password) {
    return { success: false, message: "Email and password are required." };
  }

  try {
    const response = await axios.post(
      "https://quizroom-backend-production.up.railway.app/api/auth/login/",
      { email, password }
    );

    studentToken = response.data.access;
    currentUser = response.data.user.name;
    currentPassword = password;
    console.log("Login successful:", response.data.access);

    // userStore.set("studentToken", studentToken);
    // userStore.set("currentUser", currentUser);
    // userStore.set("currentPassword", currentPassword);

    mainWindow.loadFile("src/renderer/home.html");

    return { success: true, user: response.data.user };
  } catch (error) {
    console.error("Login failed:", error.message);
    return {
      success: false,
      message: "Login failed. Please check your credentials.",
    };
  }
});

// -------------------- Fetch Course List --------------------

ipcMain.handle("get-course-list", async () => {
  if (!studentToken) {
    return { success: false, message: "Unauthorized. Please login first." };
  }

  try {
    const response = await axios.get(
      "https://quizroom-backend-production.up.railway.app/api/student/courses/",
      {
        headers: {
          Authorization: `Bearer ${studentToken}`,
        },
      }
    );

    return { success: true, courses: response.data };
  } catch (error) {
    console.error("Failed to fetch course list:", error.message);
    return {
      success: false,
      message: "Failed to fetch course list.",
    };
  }
});

// -------------------- Logout --------------------

ipcMain.on("logout", () => {
  currentUser = null;
  currentPassword = null;
  studentToken = null;

  // userStore.delete("studentToken");
  // userStore.delete("currentUser");
  // userStore.delete("currentPassword");

  mainWindow.loadFile("src/renderer/login_screen.html");
});

// -------------------- Get Username --------------------

ipcMain.handle("get-username", () => {
  return { currentUser, currentPassword };
});

// -------------------- App Events --------------------

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
