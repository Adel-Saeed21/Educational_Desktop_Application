const { default: axios } = require("axios");
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
let timer;


const Store = require('electron-store').default;
const store = new Store();


let mainWindow;
let currentUser = store.get("currentUser") || null;
let currentPassword = store.get("currentPassword") || null;
let studentToken = store.get("studentToken") || null;

let quizData;

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
if (studentToken) {
  mainWindow.loadFile("src/renderer/home.html");
} else {
  mainWindow.loadFile("src/renderer/login_screen.html");
}
 

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}




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

  global.timerValue = global.timer; 
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

  return { success: true, timerDuration: global.timer };
});


ipcMain.handle("start-exam", async (event , id) => {
  try{
      const responseOfQuizesList=await axios.get("https://quizroom-backend-production.up.railway.app/api/quiz/"+id+"/", {
        headers: {
          Authorization: `Bearer ${studentToken}`,
        },
      });

global.quizData = responseOfQuizesList.data;
global.timer = responseOfQuizesList.data.duration * 60; 

await mainWindow.loadFile("src/renderer/exam_screen.html");
return {success:true};
}catch(error){
  return {success:false,message:"failed to fetch questions"}

  }
  
  
  
});
ipcMain.handle("get-quiz-data", async () => {
  return global.quizData || null;
});

ipcMain.handle("exit-exam", async () => {
  if (global.timerInterval) {
    clearInterval(global.timerInterval);
    global.timerInterval = null;
  }
  mainWindow.loadFile("src/renderer/home.html");
});


//------------------------------------------------------------------------------------------------------------------------------------------------------------------
let justLoggedIn = false;
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
    currentUser = response.data.user.name;
    currentPassword = password;
    justLoggedIn = true; 
    console.log("Login successful:", response.data.access);

    store.set('studentToken', studentToken);
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

//------------------------------------------------------------
ipcMain.handle("get-current-quizes",async()=>{
  if(!studentToken){
    return { success: false, message: "Unauthorized. Please login first." };
  }

  try{
    const responseOfCurrentQuizes=await axios.get("https://quizroom-backend-production.up.railway.app/api/student/quizzes/current/",

      {
        headers: {
          Authorization: `Bearer ${studentToken}`,
        },
      }
    );

        return { success: true, quizes: responseOfCurrentQuizes.data };

  }catch(error){
      console.error("Failed to fetch course list:", error.message);
    return {
      success: false,
      message: "Failed to fetch Current Quizes.",
    };
  }



})


// -------------------- Logout --------------------

ipcMain.on("logout", () => {
  currentUser = null;
  currentPassword = null;
  studentToken = null;
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
  if (!studentToken) {
    return { success: false, message: "Unauthorized. Please login first." };
  }
  try {
    const response = await axios.post(
      `https://quizroom-backend-production.up.railway.app/api/student/quizzes/${quizId}/submit/`,
      { answers },
      {
        headers: {
          Authorization: `Bearer ${studentToken}`,
        },
      }
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