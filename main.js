const { default: axios } = require("axios");
const { app, BrowserWindow, ipcMain,desktopCapturer } = require("electron");
const { glob } = require("fs");
const os = require('os');
const path = require("path");
const examTimer = require("./service/examTimerService");
const fetch = require('node-fetch');
const { dialog } = require('electron');
const fs = require('fs');

const Store = require('electron-store').default;
const store = new Store();
let refreshToken;

let mainWindow;
let currentUser = store.get("currentUser") || null;
let currentPassword = store.get("currentPassword") || null;
let studentToken = store.get("studentToken") || null;
let preventClose = false;
//in create window function i check if the user is logged in or not
// if the user is logged in i load home.html otherwise i load login_screen.html
// this is done by checking the studentToken in the userStore

function createWindow() {
  mainWindow = new BrowserWindow({
    height: 800,
    width: 1200,
          icon: path.join(__dirname, 'build/icon.png'),
    
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
  nodeIntegration: false,
  enableRemoteModule: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
if ( store.get("studentToken")) {
console.log("Store contents:", store.store);
  mainWindow.loadFile("src/renderer/home.html");
} else {
  mainWindow.loadFile("src/renderer/login_screen.html");
}
 


mainWindow.on('close', (e) => {
  if (preventClose) {
    e.preventDefault();
    mainWindow.webContents.send('try-exit');
  }
});

}


ipcMain.on('set-prevent-close', (event, value) => {
  preventClose = value;
});
//------------------------------------ Manage Screen Record 

ipcMain.handle("save-recording", async (event, arrayBuffer) => {
  const buffer = Buffer.from(arrayBuffer);
  const recordingsPath = path.join(os.homedir(), "Videos", "ExamRecordings");
  fs.mkdirSync(recordingsPath, { recursive: true });

  const filePath = path.join(recordingsPath, `recording-${Date.now()}.webm`);
  fs.writeFileSync(filePath, buffer);
  console.log("✅ Video saved to:", filePath);
});

ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen'] });
  return sources.map(source => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL()
  }));
});

//-------------------------------------Token Management ---------------------------------------

ipcMain.handle('save-token', (event, token) => {
  store.set('refreshToken', token);
});

ipcMain.handle('get-token', () => {
  return store.get('refreshToken');
});

// -------------------------------------------------------------------------------------------------------------------------------------------------

// IPC handlers for exam timer , start exam and exit exam

ipcMain.handle("exam-timer", () => {
  if (global.timerInterval) {
    clearInterval(global.timerInterval);
  }

  global.timerValue = global.remainingTime || 0;

  global.timerInterval = setInterval(() => {
    if (global.timerValue <= 0) {
      clearInterval(global.timerInterval);
      global.timerInterval = null;
      mainWindow.webContents.send("timer-finished");
    } else {
      global.timerValue--;
      mainWindow.webContents.send("update-timer", global.timerValue);
    }
  }, 1000);

  return { success: true, timerDuration: global.timerValue };
});



ipcMain.handle("start-exam", async (event, id) => {
  try {
    const response = await sendAuthorizedRequest("get", `https://quizroom-backend-production.up.railway.app/api/quiz/${id}/`);
    
    const quiz = response.data;

    const startTime = new Date(quiz.start_date).getTime(); // in ms
    const endTime = new Date(quiz.end_date).getTime();     // in ms

    const now = Date.now();
    const remaining = Math.floor((endTime - now) / 1000); // in seconds

    global.quizData = quiz;
    global.remainingTime = remaining > 0 ? remaining : 0; // avoid negative values

    await mainWindow.loadFile("src/renderer/exam_screen.html");

    return { success: true };
  } catch (error) {
    return { success: false, message: "Failed to fetch questions" };
  }
});



// get  quiz data 
ipcMain.handle("get-quiz-data", async () => {
  return global.quizData || null;
});


let isExiting = false;

ipcMain.handle("exit-exam", async () => {
  if (isExiting) return;
  isExiting = true;

  if (global.timerInterval) {
    clearInterval(global.timerInterval);
    global.timerInterval = null;
  }

  preventClose = false; 

  await mainWindow.loadFile("src/renderer/home.html");

  isExiting = false; 
});




//------------------------------------------------------------------------------------------------------------------------------------------------------------------
let justLoggedIn = false; // do it to check if user visit home screen first once or not 
// for Login  i use axios to connect with the backend and electron store to save the token
ipcMain.handle("login", async (event, email, password) => {
  if (!email || !password) {
    return { success: false, message: "Email and password are required." };
  }

  try {
    const response = await axios.post(
      "https://quizroom-backend-production.up.railway.app/api/auth/student-login/",
      { email, password }
    );

   studentToken = response.data.access;
 refreshToken = response.data.refresh;

store.set('studentToken', studentToken);
store.set('refreshToken', refreshToken);
    currentUser = response.data.user.name;
    currentPassword = password;
    justLoggedIn = true; 
   // console.log("Login successful:", response.data.access);

store.set('currentUser', response.data.user.name);
store.set('currentPassword', password);


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
ipcMain.handle("checkJustLoggedIn", () => {
  const wasJustLoggedIn = justLoggedIn;
  justLoggedIn = false;  
  return wasJustLoggedIn;
});


// -------------------- Fetch Course List --------------------

ipcMain.handle("get-course-list", async () => {
  try {
    const response = await sendAuthorizedRequest("get", "https://quizroom-backend-production.up.railway.app/api/student/courses/");
    return { success: true, courses: response.data };
  } catch (error) {
    console.error("Failed to fetch course list:", error.message);
    return {
      success: false,
      message: "Failed to fetch course list.",
    };
  }
});


//------------------------------------------------------------
ipcMain.handle("get-current-quizes", async () => {
  try {
    const response = await sendAuthorizedRequest("get", "https://quizroom-backend-production.up.railway.app/api/student/quizzes/current/");
    return { success: true, quizes: response.data };
  } catch (error) {
    console.error("Failed to fetch Current Quizes:", error.message);
    return {
      success: false,
      message: "Failed to fetch Current Quizes.",
    };
  }
});


ipcMain.handle("navigate-to-details", async () => {
  if (mainWindow) {
    await mainWindow.loadFile("src/renderer/details_screen.html");
  }
});


//----------------------Fetch results
ipcMain.handle('get-result-solutions', async (_, submissionIndex) => {
  const submissions = global.submissions || [];
  const selectedSubmission = submissions[submissionIndex];
  return selectedSubmission?.answers || null;
});

ipcMain.handle("get-result", async () => {
  try {
    const response = await sendAuthorizedRequest("get", "https://quizroom-backend-production.up.railway.app/api/student/submissions/");
    const submissions = response.data;
    global.submissions = submissions; 
    return { success: true, results: submissions };
  } catch (error) {
    console.error("Failed to fetch results:", error.message);
    return {
      success: false,
      message: "Failed to fetch all Results.",
    };
  }
});

// -------------------- Logout --------------------

ipcMain.on("logout", () => {
  currentUser = null;
  currentPassword = null;
  studentToken = null;
  refreshToken=null;
  store.delete('studentToken');
store.delete('currentUser');
store.delete('currentPassword');

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



//------------------submit-------------------------------

ipcMain.handle("submit-quiz", async (event, quizId, answers) => {
  try {
    const response = await sendAuthorizedRequest(
      "post",
      `https://quizroom-backend-production.up.railway.app/api/student/quizzes/${quizId}/submit/`,
      { answers }
    );
    return { success: true, detail: response.data.detail };
  } catch (error) {
    console.error("Quiz submission failed:", error.message);
    return {
      success: false,
      message: error.response?.data?.detail || "Quiz submission failed.",
    };
  }
});


//-------------------------------------GET ACCESS TOKEN-------------------------------
async function refreshAccessToken() {
  const refreshToken = store.get('refreshToken');
  if (!refreshToken) return null;

  try {
    const response = await axios.post("https://quizroom-backend-production.up.railway.app/api/auth/refresh/", {
      refresh: refreshToken
    });

    const newAccessToken = response.data.access;
    store.set('studentToken', newAccessToken);
    studentToken = newAccessToken;

    console.log("Token refreshed successfully");
    return newAccessToken;
  } catch (error) {
    console.error("Failed to refresh token:", error.message);
    // logout or prompt login again
    store.delete('refreshToken');
    store.delete('studentToken');
    return null;
  }
}

async function sendAuthorizedRequest(method, url, data = null) {
  try {
    const config = {
      method,
      url,
      headers: {
        Authorization: `Bearer ${studentToken}`,
      },
      data,
    };

    const response = await axios(config);
    return response;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      const newAccess = await refreshAccessToken();
      if (!newAccess) throw new Error("Unauthorized");

      const retryConfig = {
        method,
        url,
        headers: {
          Authorization: `Bearer ${newAccess}`,
        },
        data,
      };

      return await axios(retryConfig);
    }
    throw error;
  }
}
//---------------------OTP---------------------

ipcMain.handle('send-otp', async (event, email) => {
    // Always return success and a generic message immediately
    setImmediate(async () => {
        try {
            await fetch('https://quizroom-backend-production.up.railway.app/api/auth/request-password-reset/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
        } catch (err) {
        }
    });
    return { success: true, message: "Checking email..." };
});

ipcMain.handle('verify-otp', async (event, { email, otp }) => {
    try {
        const response = await fetch('https://quizroom-backend-production.up.railway.app/api/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });
        const data = await response.json();
        if (response.ok && data.detail === "OTP verified successfully.") {
            return { success: true, message: data.detail };
        } else {
            return { success: false, message: data.detail || "Invalid or expired OTP." };
        }
    } catch (err) {
        return { success: false, message: 'Network error' };
    }
});

ipcMain.handle('reset-password', async (event, { email, otp, newPassword }) => {
    try {
        const response = await fetch('https://quizroom-backend-production.up.railway.app/api/auth/reset-password/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp, new_password: newPassword })
        });
        const data = await response.json();
        if (response.ok && data.detail === "Password has been reset.") {
            return { success: true, message: data.detail };
        } else {
            return { success: false, message: data.detail || "Password reset failed." };
        }
    } catch (err) {
        return { success: false, message: 'Network error' };
    }
});
