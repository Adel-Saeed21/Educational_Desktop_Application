const { default: axios } = require("axios")
const { app, BrowserWindow, ipcMain, desktopCapturer } = require("electron")
const os = require("os")
const path = require("path")
const fetch = require("node-fetch")
const fs = require("fs")

const FormData = require("form-data")

let sequenceCounter = 0
const activeUploads = new Set()
let uploadErrors = []

const uploadSizeStats = {
  totalUploaded: 0,
  largestChunk: 0,
  smallestChunk: Number.POSITIVE_INFINITY,
  avgChunkSize: 0,
  totalChunks: 0,
}

const Store = require("electron-store").default
const store = new Store()
let refreshToken
let studentId = store.get("studentId") || null
global.student_id = studentId
let mainWindow
let currentUser = store.get("currentUser") || null
let currentPassword = store.get("currentPassword") || null
let studentToken = store.get("studentToken") || null

let preventClose = false

function createWindow() {
  mainWindow = new BrowserWindow({
    height: 800,
    width: 1200,
    frame: false,
    titleBarStyle: "hidden",
    icon: path.join(__dirname, "build/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
    },
  })

  mainWindow.setMenuBarVisibility(false)
  mainWindow.loadFile("src/renderer/UI/loading.html")

  setTimeout(async () => {
    const storedRefreshToken = store.get("refreshToken")
    const storedStudentToken = store.get("studentToken")

    if (storedRefreshToken && storedStudentToken) {
      // Validate the stored tokens by trying to refresh
      try {
        refreshToken = storedRefreshToken
        studentToken = storedStudentToken
        studentId = store.get("studentId") || null
        global.student_id = studentId
        currentUser = store.get("currentUser") || null
        currentPassword = store.get("currentPassword") || null

        // Try to refresh the token to validate it's still valid
        const newToken = await refreshAccessToken()
        if (newToken) {
          // Token is valid, load home screen
          mainWindow.loadFile("src/renderer/UI/home.html")
        } else {
          // Token is invalid, clear session and show login
          clearSession()
          mainWindow.loadFile("src/renderer/UI/login_screen.html")
        }
      } catch (error) {
        console.error("Token validation failed:", error)
        clearSession()
        mainWindow.loadFile("src/renderer/UI/login_screen.html")
      }
    } else {
      // No tokens found, show login screen
      mainWindow.loadFile("src/renderer/UI/login_screen.html")
    }
  }, 1500)

  mainWindow.on("close", (e) => {
    if (preventClose) {
      e.preventDefault()
      mainWindow.webContents.send("try-exit")
    }
  })
}

ipcMain.on("set-prevent-close", (event, value) => {
  preventClose = value
})

ipcMain.handle("upload-chunk", async (event, chunkData) => {
  const chunkSizeMB = (chunkData.length / (1024 * 1024)).toFixed(2)

  // Extract header and validate enhanced chunk
  let extractedData
  try {
    extractedData = extractChunkHeader(chunkData)
  } catch (error) {
    return {
      success: false,
      message: `Invalid chunk format: ${error.message}`,
      headerError: true,
    }
  }

  const MAX_CHUNK_SIZE = 15 * 1024 * 1024 // 15MB for enhanced chunks

  if (chunkData.length > MAX_CHUNK_SIZE) {
    return {
      success: false,
      message: `Enhanced chunk too large: ${chunkSizeMB}MB exceeds 15MB limit`,
      oversized: true,
      size: chunkData.length,
      header: extractedData.header,
    }
  }

  // Validate essentials with header fallback
  const quizId = global.quiz_id || extractedData.header.examId
  const studentIdCheck = global.student_id || extractedData.header.studentId

  if (!quizId || !studentIdCheck || !studentToken) {
    return {
      success: false,
      message: "Missing quiz ID, student ID, or authentication token",
      header: extractedData.header,
    }
  }

  // Use sequence from header if available
  const currentSequence = extractedData.header.sequence || sequenceCounter++

  try {
    const result = await uploadEnhancedChunkWithRetry(extractedData, currentSequence)
    return result
  } catch (error) {
    uploadErrors.push({
      sequence: currentSequence,
      error: error.message,
      size: chunkData.length,
      chunkId: extractedData.header.chunkId,
      timestamp: extractedData.header.timestamp,
    })

    return {
      success: false,
      message: `Enhanced upload failed: ${error.message}`,
      sequence: currentSequence,
      size: chunkData.length,
      chunkId: extractedData.header.chunkId,
    }
  }
})

function extractChunkHeader(chunkData) {
  if (!chunkData || chunkData.length < 8) {
    throw new Error("Chunk too small to contain header")
  }

  try {
    // Read header size (first 4 bytes)
    const headerSizeBuffer = chunkData.slice(0, 4)
    const headerSizeView = new DataView(headerSizeBuffer.buffer, headerSizeBuffer.byteOffset, 4)
    const headerSize = headerSizeView.getUint32(0, false) // Big endian

    if (headerSize > 10000 || headerSize < 10) {
      // Reasonable header size limits
      throw new Error(`Invalid header size: ${headerSize} bytes`)
    }

    // Extract header data
    const headerBuffer = chunkData.slice(4, 4 + headerSize)
    const headerJSON = new TextDecoder().decode(headerBuffer)
    const header = JSON.parse(headerJSON)

    // Extract video data
    const videoData = chunkData.slice(4 + headerSize)

    // Validate header structure
    if (!header.chunkId || !header.timestamp || header.sequence === undefined) {
      throw new Error("Missing required header fields")
    }

    return {
      header: header,
      videoData: videoData,
      headerSize: headerSize,
      totalSize: chunkData.length,
    }
  } catch (error) {
    throw new Error(`Header parsing failed: ${error.message}`)
  }
}

async function uploadEnhancedChunkWithRetry(extractedData, sequenceNumber, maxRetries = 3) {
  const uploadId = `${extractedData.header.chunkId}-${Date.now()}`
  activeUploads.add(uploadId)

  // Update stats with enhanced info
  updateEnhancedSizeStats(extractedData)

  let lastError

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await performEnhancedUpload(extractedData, sequenceNumber)

      activeUploads.delete(uploadId)

      updateUploadProgress()

      return {
        success: true,
        message: "Enhanced chunk uploaded successfully",
        sequence: sequenceNumber,
        chunkId: extractedData.header.chunkId,
        attempt: attempt,
        size: extractedData.totalSize,
        videoSize: extractedData.videoData.length,
        headerSize: extractedData.headerSize,
      }
    } catch (error) {
      lastError = error

      // Don't retry on fatal errors
      if (error.isFatalError || error.isAuthError || error.isOversized) {
        break
      }

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        await sleep(delay)
      }
    }
  }

  activeUploads.delete(uploadId)
  throw lastError || new Error("Enhanced upload failed after all retries")
}

async function performEnhancedUpload(extractedData, sequenceNumber) {
  const { header, videoData, headerSize } = extractedData

  // Convert video data to Buffer
  let videoBuffer
  if (videoData instanceof ArrayBuffer) {
    videoBuffer = Buffer.from(videoData)
  } else if (ArrayBuffer.isView(videoData)) {
    videoBuffer = Buffer.from(videoData.buffer, videoData.byteOffset, videoData.byteLength)
  } else {
    videoBuffer = Buffer.from(videoData)
  }

  const totalSizeMB = (extractedData.totalSize / (1024 * 1024)).toFixed(2)

  // Create FormData with enhanced metadata
  const formData = new FormData()

  // Original fields
  formData.append("sequence_number", sequenceNumber.toString())
  formData.append("chunk_size", videoBuffer.length.toString())

  // 🚀 ENHANCED METADATA FROM HEADER
  formData.append("chunk_id", header.chunkId)
  formData.append("chunk_timestamp", header.timestamp.toString())
  formData.append("session_id", header.sessionId || "unknown")
  formData.append("current_question", header.currentQuestion ? header.currentQuestion.toString() : "0")
  formData.append("total_questions", header.totalQuestions ? header.totalQuestions.toString() : "0")
  formData.append("current_answer_length", header.currentAnswer ? header.currentAnswer.toString() : "0")
  formData.append("processing_time", header.processingTime ? header.processingTime.toString() : "0")
  formData.append("is_large_chunk", header.isLargeChunk ? "true" : "false")
  formData.append("priority", header.priority || "normal")
  formData.append("checksum", header.checksum || "unknown")
  formData.append("header_version", header.headerVersion || "1.0")
  formData.append("user_agent", header.userAgent || "unknown")
  formData.append("screen_resolution", header.screenResolution || "unknown")
  formData.append("header_size_bytes", headerSize.toString())
  formData.append(
    "original_chunk_size",
    header.originalSize ? header.originalSize.toString() : videoBuffer.length.toString(),
  )

  // File with enhanced naming
  formData.append("file", videoBuffer, {
    filename: `enhanced_chunk_${header.chunkId}_seq${sequenceNumber.toString().padStart(4, "0")}.webm`,
    contentType: header.mimeType || "video/webm",
    knownLength: videoBuffer.length,
  })

  // Use quiz ID from header if available
  const quizId = global.quiz_id || header.examId
  const studentId = global.student_id || header.studentId

  const uploadUrl = `https://quizroom-backend-production.up.railway.app/api/quiz/${quizId}/student/${studentId}/chunk/`

  try {
    const response = await axios.post(uploadUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${studentToken}`,
        "X-Chunk-Type": "enhanced",
        "X-Header-Version": header.headerVersion || "2.0",
      },
      timeout: 90000, // Longer timeout for enhanced chunks
      maxContentLength: 20 * 1024 * 1024, // 20MB limit
      maxBodyLength: 20 * 1024 * 1024,
      validateStatus: (status) => status < 500,
    })

    if (response.status === 200 || response.status === 201) {
      return response.data
    } else if (response.status === 413) {
      const error = new Error(`Enhanced chunk too large (413): ${totalSizeMB}MB rejected by server`)
      error.isFatalError = true
      error.isOversized = true
      throw error
    } else if (response.status === 403) {
      const error = new Error(`Permission denied for enhanced chunk (403)`)
      error.isAuthError = true
      throw error
    } else {
      const errorMsg = response.data?.message || response.data?.detail || `HTTP ${response.status}`
      throw new Error(`Enhanced server error: ${errorMsg}`)
    }
  } catch (error) {
    // Enhanced error handling
    if (error.code === "ENOTFOUND") {
      const netError = new Error("Network unreachable for enhanced upload")
      netError.isNetworkError = true
      throw netError
    } else if (error.code === "ETIMEDOUT") {
      const timeoutError = new Error(`Enhanced upload timeout for ${totalSizeMB}MB chunk`)
      timeoutError.isTimeoutError = true
      throw timeoutError
    } else if (error.response) {
      const status = error.response.status
      const data = error.response.data
      const message = data?.message || data?.detail || error.message

      const serverError = new Error(`Enhanced server error (${status}): ${message}`)

      if (status === 403 || status === 401) {
        serverError.isAuthError = true
      } else if (status === 413) {
        serverError.isFatalError = true
        serverError.isOversized = true
      }

      throw serverError
    } else {
      throw error
    }
  }
}

let enhancedUploadStats = {
  ...uploadSizeStats,
  totalHeaderSize: 0,
  headerOverhead: 0,
  avgHeaderSize: 0,
  enhancedChunks: 0,
  regularChunks: 0,
  headerEfficiency: 0,
}

function updateEnhancedSizeStats(extractedData) {
  const { totalSize, videoData, headerSize } = extractedData

  // Update regular stats
  enhancedUploadStats.totalUploaded += totalSize
  enhancedUploadStats.totalChunks++
  enhancedUploadStats.enhancedChunks++
  enhancedUploadStats.largestChunk = Math.max(enhancedUploadStats.largestChunk, totalSize)
  enhancedUploadStats.smallestChunk = Math.min(enhancedUploadStats.smallestChunk, totalSize)
  enhancedUploadStats.avgChunkSize = enhancedUploadStats.totalUploaded / enhancedUploadStats.totalChunks

  // Update enhanced stats
  enhancedUploadStats.totalHeaderSize += headerSize
  enhancedUploadStats.avgHeaderSize = enhancedUploadStats.totalHeaderSize / enhancedUploadStats.enhancedChunks
  enhancedUploadStats.headerOverhead = (enhancedUploadStats.totalHeaderSize / enhancedUploadStats.totalUploaded) * 100
  enhancedUploadStats.headerEfficiency = (videoData.length / totalSize) * 100
}

async function performSingleUpload(chunkData, sequenceNumber) {
  // Convert to Buffer
  let chunkBuffer
  if (chunkData instanceof ArrayBuffer) {
    chunkBuffer = Buffer.from(chunkData)
  } else if (ArrayBuffer.isView(chunkData)) {
    chunkBuffer = Buffer.from(chunkData.buffer)
  } else {
    chunkBuffer = Buffer.from(chunkData)
  }

  const chunkSizeMB = (chunkBuffer.length / (1024 * 1024)).toFixed(2)

  // Create FormData with size info
  const formData = new FormData()

  formData.append("sequence_number", sequenceNumber.toString())
  formData.append("chunk_size", chunkBuffer.length.toString())

  formData.append("file", chunkBuffer, {
    filename: `chunk_${sequenceNumber.toString().padStart(4, "0")}.webm`,
    contentType: "video/webm",
    knownLength: chunkBuffer.length,
  })

  const uploadUrl = `https://quizroom-backend-production.up.railway.app/api/quiz/${global.quiz_id}/student/${global.student_id}/chunk/`

  try {
    const response = await axios.post(uploadUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${studentToken}`,
      },
      timeout: 60000,
      maxContentLength: 10 * 1024 * 1024,
      maxBodyLength: 10 * 1024 * 1024,
      validateStatus: (status) => status < 500,
    })

    if (response.status === 200 || response.status === 201) {
      return response.data
    } else if (response.status === 413) {
      const error = new Error(`File too large (413): ${chunkSizeMB}MB chunk rejected by server`)
      error.isFatalError = true
      error.isOversized = true
      throw error
    } else if (response.status === 404) {
      const error = new Error(`Upload endpoint not found (404)`)
      error.isFatalError = true
      throw error
    } else if (response.status === 403) {
      const error = new Error(`Permission denied (403)`)
      error.isAuthError = true
      throw error
    } else {
      const errorMsg = response.data?.message || response.data?.detail || `HTTP ${response.status}`
      throw new Error(`Server error: ${errorMsg}`)
    }
  } catch (error) {
    // Enhanced error handling
    if (error.code === "ENOTFOUND") {
      const netError = new Error("Network unreachable")
      netError.isNetworkError = true
      throw netError
    } else if (error.code === "ETIMEDOUT") {
      const timeoutError = new Error(`Upload timeout for ${chunkSizeMB}MB chunk`)
      timeoutError.isTimeoutError = true
      throw timeoutError
    } else if (error.response) {
      const status = error.response.status
      const data = error.response.data
      const message = data?.message || data?.detail || error.message

      const serverError = new Error(`Server error (${status}): ${message}`)

      if (status === 403 || status === 401) {
        serverError.isAuthError = true
      } else if (status === 404) {
        serverError.isFatalError = true
      } else if (status === 413) {
        serverError.isFatalError = true
        serverError.isOversized = true
      }

      throw serverError
    } else {
      throw error
    }
  }
}

function updateSizeStats(chunkSize) {
  uploadSizeStats.totalUploaded += chunkSize
  uploadSizeStats.totalChunks++
  uploadSizeStats.largestChunk = Math.max(uploadSizeStats.largestChunk, chunkSize)
  uploadSizeStats.smallestChunk = Math.min(uploadSizeStats.smallestChunk, chunkSize)
  uploadSizeStats.avgChunkSize = uploadSizeStats.totalUploaded / uploadSizeStats.totalChunks
}

function updateUploadProgress() {
  const progress = {
    uploaded: sequenceCounter - activeUploads.size,
    total: sequenceCounter,
    active: activeUploads.size,
    errors: uploadErrors.length,
    percentage: sequenceCounter > 0 ? Math.round(((sequenceCounter - activeUploads.size) / sequenceCounter) * 100) : 0,
    totalSizeMB: (uploadSizeStats.totalUploaded / (1024 * 1024)).toFixed(2),
    avgChunkSizeMB: uploadSizeStats.totalChunks > 0 ? (uploadSizeStats.avgChunkSize / (1024 * 1024)).toFixed(2) : 0,
  }

  mainWindow.webContents.send("upload-progress", progress)
}

// Handle recording finish
ipcMain.on("finish-upload", () => {
  // Check if all uploads are complete
  const checkCompletion = () => {
    if (activeUploads.size === 0) {
      mainWindow.webContents.send("upload-complete")
    } else {
      setTimeout(checkCompletion, 1000)
    }
  }

  checkCompletion()
})

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Reset upload state (call this when starting new recording)
ipcMain.handle("reset-upload-state", () => {
  sequenceCounter = 0
  activeUploads.clear()
  uploadErrors = []

  // Reset enhanced stats
  enhancedUploadStats = {
    totalUploaded: 0,
    largestChunk: 0,
    smallestChunk: Number.POSITIVE_INFINITY,
    avgChunkSize: 0,
    totalChunks: 0,
    totalHeaderSize: 0,
    headerOverhead: 0,
    avgHeaderSize: 0,
    enhancedChunks: 0,
    regularChunks: 0,
    headerEfficiency: 0,
  }

  return { success: true }
})

ipcMain.handle("get-upload-debug", () => {
  return {
    sequenceCounter,
    activeUploads: Array.from(activeUploads),
    uploadErrors,
    hasQuizId: !!global.quiz_id,
    hasStudentId: !!global.student_id,
    hasToken: !!studentToken,
    sizeStats: enhancedUploadStats,
    maxChunkSize: 15 * 1024 * 1024,
    currentBitrate: 256000,
    enhancedFeatures: {
      headerProcessing: true,
      metadataExtraction: true,
      fallbackSupport: true,
      enhancedEndpoint: false,
    },
  }
})

ipcMain.handle("get-upload-stats", () => {
  return {
    ...enhancedUploadStats,
    totalUploadedMB: (enhancedUploadStats.totalUploaded / (1024 * 1024)).toFixed(2),
    avgChunkSizeMB: (enhancedUploadStats.avgChunkSize / (1024 * 1024)).toFixed(2),
    largestChunkMB: (enhancedUploadStats.largestChunk / (1024 * 1024)).toFixed(2),
    smallestChunkMB:
      enhancedUploadStats.smallestChunk === Number.POSITIVE_INFINITY
        ? 0
        : (enhancedUploadStats.smallestChunk / (1024 * 1024)).toFixed(2),
    avgHeaderSizeKB: (enhancedUploadStats.avgHeaderSize / 1024).toFixed(2),
    headerOverheadPercent: enhancedUploadStats.headerOverhead.toFixed(2),
    enhancedChunkCount: enhancedUploadStats.enhancedChunks,
    regularChunkCount: enhancedUploadStats.regularChunks,
    headerEfficiencyPercent: enhancedUploadStats.headerEfficiency.toFixed(1),
  }
})

ipcMain.handle("get-chunk-stats", () => {
  return {
    totalChunks: enhancedUploadStats.totalChunks,
    enhancedChunks: enhancedUploadStats.enhancedChunks,
    regularChunks: enhancedUploadStats.regularChunks,
    avgEnhancedSize: (enhancedUploadStats.avgChunkSize / (1024 * 1024)).toFixed(2) + "MB",
    headerOverhead: enhancedUploadStats.headerOverhead.toFixed(2) + "%",
    avgHeaderSize: (enhancedUploadStats.avgHeaderSize / 1024).toFixed(2) + "KB",
    efficiency: enhancedUploadStats.headerEfficiency.toFixed(1) + "%",
    totalDataMB: (enhancedUploadStats.totalUploaded / (1024 * 1024)).toFixed(2),
    totalHeadersMB: (enhancedUploadStats.totalHeaderSize / (1024 * 1024)).toFixed(3),
  }
})

//------------------------------------ Manage Screen Record

ipcMain.handle("save-recording", async (event, arrayBuffer) => {
  const buffer = Buffer.from(arrayBuffer)
  const recordingsPath = path.join(os.homedir(), "Videos", "ExamRecordings")
  fs.mkdirSync(recordingsPath, { recursive: true })

  const filePath = path.join(recordingsPath, `recording-${Date.now()}.webm`)
  fs.writeFileSync(filePath, buffer)
})

ipcMain.handle("get-sources", async () => {
  const sources = await desktopCapturer.getSources({ types: ["screen"] })
  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL(),
  }))
})

//-------------------------------------Token Management ---------------------------------------

ipcMain.handle("save-token", (event, token) => {
  store.set("refreshToken", token)
})

ipcMain.handle("get-token", () => {
  return store.get("refreshToken")
})

// -------------------------------------------------------------------------------------------------------------------------------------------------

// IPC handlers for exam timer , start exam and exit exam

ipcMain.handle("exam-timer", () => {
  if (global.timerInterval) {
    clearInterval(global.timerInterval)
  }

  global.timerValue = global.remainingTime || 0

  global.timerInterval = setInterval(() => {
    if (global.timerValue <= 0) {
      clearInterval(global.timerInterval)
      global.timerInterval = null
      mainWindow.webContents.send("timer-finished")
    } else {
      global.timerValue--
      mainWindow.webContents.send("update-timer", global.timerValue)
    }
  }, 1000)

  return { success: true, timerDuration: global.timerValue }
})

ipcMain.handle("show-course-statistics", async (event, id) => {
  try {
    const response = await sendAuthorizedRequest(
      "get",
      `https://quizroom-backend-production.up.railway.app/api/student/statistics/performance-summary/${id}/`,
    )

    const statistic = response.data
    global.statisticData = statistic
    await mainWindow.loadFile("src/renderer/UI/statistics_screen.html")

    return { success: true }
  } catch (error) {
    return { success: false, message: "Failed to fetch Course statistics" }
  }
})
ipcMain.handle("get-course-statistics", async () => {
  return global.statisticData || null
})

ipcMain.handle("start-exam", async (event, id) => {
  try {
    const response = await sendAuthorizedRequest(
      "get",
      `https://quizroom-backend-production.up.railway.app/api/quiz/${id}/`,
    )

    const quiz = response.data

    const startTime = new Date(quiz.start_date).getTime() // in ms
    const endTime = new Date(quiz.end_date).getTime() // in ms

    const now = Date.now()
    const remaining = Math.floor((endTime - now) / 1000) // in seconds
    global.quiz_id = id
    global.quizData = quiz
    global.remainingTime = remaining > 0 ? remaining : 0 // avoid negative values

    await mainWindow.loadFile("src/renderer/UI/exam_screen.html")

    return { success: true }
  } catch (error) {
    return { success: false, message: "Failed to fetch questions" }
  }
})

// get  quiz data
ipcMain.handle("get-quiz-data", async () => {
  return global.quizData || null
})

let isExiting = false

ipcMain.handle("exit-exam", async () => {
  if (isExiting) return
  isExiting = true

  if (global.timerInterval) {
    clearInterval(global.timerInterval)
    global.timerInterval = null
  }

  preventClose = false

  await mainWindow.loadFile("src/renderer/UI/home.html")

  isExiting = false
})

//------------------------------------------------------------------------------------------------------------------------------------------------------------------
let justLoggedIn = false // do it to check if user visit home screen first once or not
// for Login  i use axios to connect with the backend and electron store to save the token
ipcMain.handle("login", async (event, email, password) => {
  if (!email || !password) {
    return { success: false, message: "Email and password are required." }
  }

  try {
    const response = await axios.post("https://quizroom-backend-production.up.railway.app/api/auth/student-login/", {
      email,
      password,
    })

    studentToken = response.data.access
    refreshToken = response.data.refresh
    studentId = response.data.user.id
    global.student_id = studentId
    store.set("studentId", studentId)
    store.set("studentToken", studentToken)
    store.set("refreshToken", refreshToken)

    currentUser = response.data.user.name
    currentPassword = password
    justLoggedIn = true

    store.set("currentUser", response.data.user.name)
    store.set("currentPassword", password)

    mainWindow.loadFile("src/renderer/UI/home.html")

    return { success: true, user: response.data.user }
  } catch (error) {
    return {
      success: false,
      message: "Login failed. Please check your credentials.",
    }
  }
})

ipcMain.handle("checkJustLoggedIn", () => {
  const wasJustLoggedIn = justLoggedIn
  justLoggedIn = false
  return wasJustLoggedIn
})

// -------------------- Fetch Course List --------------------

ipcMain.handle("get-course-list", async () => {
  try {
    const response = await sendAuthorizedRequest(
      "get",
      "https://quizroom-backend-production.up.railway.app/api/student/courses/",
    )
    return { success: true, courses: response.data }
  } catch (error) {
    return {
      success: false,
      message: "Failed to fetch course list.",
    }
  }
})

let previousQuizzes = null

//------------------------------------------------------------
ipcMain.handle("get-current-quizes", async () => {
  try {
    const response = await sendAuthorizedRequest(
      "get",
      "https://quizroom-backend-production.up.railway.app/api/student/quizzes/current/",
    )

    return { success: true, quizes: response.data }
  } catch (error) {
    return {
      success: false,
      message: "Failed to fetch Current Quizes.",
    }
  }
})

function startCurrentQuizzesStream(window) {
  setInterval(async () => {
    try {
      const response = await sendAuthorizedRequest(
        "get",
        "https://quizroom-backend-production.up.railway.app/api/student/quizzes/current/",
      )
      const current = response.data

      if (JSON.stringify(current) !== JSON.stringify(previousQuizzes)) {
        previousQuizzes = current
        window.webContents.send("current-quizzes-updated", current)
      }
    } catch (error) {
      // Error polling quizzes
    }
  }, 5000)
}

ipcMain.handle("start-quizzes-stream", (event) => {
  const window = event.sender.getOwnerBrowserWindow()
  startCurrentQuizzesStream(window)
  return { success: true }
})

ipcMain.handle("navigate-to-details", async () => {
  if (mainWindow) {
    await mainWindow.loadFile("src/renderer/UI/details_screen.html")
  }
})

//----------------------Fetch results
ipcMain.handle("get-result", async () => {
  try {
    const response = await sendAuthorizedRequest(
      "get",
      "https://quizroom-backend-production.up.railway.app/api/student/submissions/"
    );
    const submissions = response.data;
    
    global.allSubmissions = submissions;
    return { success: true, results: submissions };
  } catch (error) {
    console.error("Error fetching all results:", error);
    return {
      success: false,
      message: "Failed to fetch all results.",
      error: error.message
    };
  }
});

// Handler to get quiz_id from a specific submission by index
ipcMain.handle("get-result-quiz-id", async (event, submissionIndex) => {
  if (!global.allSubmissions || !Array.isArray(global.allSubmissions)) {
    const result = await ipcMain.handle("get-result")();
    if (!result.success) {
     
      return null;
    }
    global.allSubmissions = result.results;
  }

  if (submissionIndex !== undefined && submissionIndex >= 0) {
    const submission = global.allSubmissions[submissionIndex];
    const quizId = submission?.quiz_id || submission?.quiz || null;
    return quizId;
  }
  
  if (global.allSubmissions.length > 0) {
    const quizId = global.allSubmissions[0].quiz_id || global.allSubmissions[0].quiz || null;
    return quizId;
  }
  
  return null;
});

// Handler to get specific quiz submission details
ipcMain.handle("get-quiz-details", async (event, id) => {
  try {
    const response = await sendAuthorizedRequest(
      "get",
      `https://quizroom-backend-production.up.railway.app/api/student/quizzes/${id}/submission/`
    );
    
    const quizSubmission = response.data;    
    global.currentQuizSubmission = quizSubmission;
    return { success: true, results: quizSubmission };
  } catch (error) {
    console.error("Error fetching quiz details:", error);
    return {
      success: false,
      message: "Failed to fetch quiz details.",
      error: error.message
    };
  }
});
// -------------------- Logout --------------------

ipcMain.on("logout", () => {
  currentUser = null
  currentPassword = null
  studentToken = null
  refreshToken = null
  store.delete("studentToken")
  store.delete("currentUser")
  store.delete("currentPassword")

  mainWindow.loadFile("src/renderer/UI/login_screen.html")
})

// -------------------- Get Username --------------------

ipcMain.handle("get-username", () => {
  return { currentUser, currentPassword }
})

// -------------------- App Events --------------------

app.whenReady().then(createWindow)

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

//------------------submit-------------------------------

ipcMain.handle("submit-quiz", async (event, quizId, answers) => {
  try {
    const response = await sendAuthorizedRequest(
      "post",
      `https://quizroom-backend-production.up.railway.app/api/student/quizzes/${quizId}/submit/`,
      { answers },
    )
    return { success: true, detail: response.data.detail }
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.detail || "Quiz submission failed.",
    }
  }
})

//-------------------------------------GET ACCESS TOKEN-------------------------------
async function refreshAccessToken() {
  const refreshToken = store.get("refreshToken")
  if (!refreshToken) return null

  try {
    const response = await axios.post("https://quizroom-backend-production.up.railway.app/api/auth/refresh/", {
      refresh: refreshToken,
    })

    const newAccessToken = response.data.access
    store.set("studentToken", newAccessToken)
    studentToken = newAccessToken
    return newAccessToken
  } catch (error) {
    // logout or prompt login again
    store.delete("refreshToken")
    store.delete("studentToken")
    return null
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
    }

    const response = await axios(config)
    return response
  } catch (error) {
    if (error.response && error.response.status === 401) {
      const newAccess = await refreshAccessToken()
      if (!newAccess) throw new Error("Unauthorized")

      const retryConfig = {
        method,
        url,
        headers: {
          Authorization: `Bearer ${newAccess}`,
        },
        data,
      }

      return await axios(retryConfig)
    }
    throw error
  }
}

//---------------------OTP---------------------

ipcMain.handle("send-otp", async (event, email) => {
  // Always return success and a generic message immediately
  setImmediate(async () => {
    try {
      await fetch("https://quizroom-backend-production.up.railway.app/api/auth/request-password-reset/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
    } catch (err) {}
  })
  return { success: true, message: "Checking email..." }
})

ipcMain.handle("verify-otp", async (event, { email, otp }) => {
  try {
    const response = await fetch("https://quizroom-backend-production.up.railway.app/api/auth/verify-otp/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    })
    const data = await response.json()
    if (response.ok && data.detail === "OTP verified successfully.") {
      return { success: true, message: data.detail }
    } else {
      return { success: false, message: data.detail || "Invalid or expired OTP." }
    }
  } catch (err) {
    return { success: false, message: "Network error" }
  }
})

ipcMain.handle("reset-password", async (event, { email, otp, newPassword }) => {
  try {
    const response = await fetch("https://quizroom-backend-production.up.railway.app/api/auth/reset-password/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp, new_password: newPassword }),
    })
    const data = await response.json()
    if (response.ok && data.detail === "Password has been reset.") {
      return { success: true, message: data.detail }
    } else {
      return { success: false, message: data.detail || "Password reset failed." }
    }
  } catch (err) {
    return { success: false, message: "Network error" }
  }
})

//---------------------Results Stream---------------------
let previousResults = null

function startResultsStream(window) {
  setInterval(async () => {
    try {
      const response = await sendAuthorizedRequest(
        "get",
        "https://quizroom-backend-production.up.railway.app/api/student/submissions/",
      )
      const results = response.data

      if (JSON.stringify(results) !== JSON.stringify(previousResults)) {
        previousResults = results
        window.webContents.send("results-updated", results)
      }
    } catch (error) {
      // Error polling results
    }
  }, 5000)
}

ipcMain.handle("start-results-stream", (event) => {
  const window = event.sender.getOwnerBrowserWindow()
  startResultsStream(window)
  return { success: true }
})

function clearSession() {
  store.delete("refreshToken")
  store.delete("studentToken")
  store.delete("studentId")
  store.delete("currentUser")
  store.delete("currentPassword")

  // Clear global variables
  refreshToken = null
  studentToken = null
  studentId = null
  global.student_id = null
  currentUser = null
  currentPassword = null
}

ipcMain.handle("logout", async (event) => {
  try {
    // Clear all session data
    clearSession()

    // Navigate to login screen
    mainWindow.loadFile("src/renderer/UI/login_screen.html")

    return { success: true, message: "Logged out successfully" }
  } catch (error) {
    console.error("Logout error:", error)
    return { success: false, message: "Error during logout" }
  }
})

ipcMain.handle("window-minimize", () => {
  if (mainWindow) {
    mainWindow.minimize()
  }
})

ipcMain.handle("window-maximize", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.handle("window-close", () => {
  if (mainWindow) {
    mainWindow.close()
  }
})

ipcMain.handle("window-is-maximized", () => {
  return mainWindow ? mainWindow.isMaximized() : false
})
