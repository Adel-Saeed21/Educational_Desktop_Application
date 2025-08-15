const submit = document.getElementById("Submit")
const exit = document.getElementById("Exit")
const nextBtn = document.getElementById("NextQuestion")
const previousBtn = document.getElementById("Previous")
const questionElement = document.getElementById("Question")
const answerInput = document.getElementById("answer")
const timerElement = document.getElementById("timer")
const uploadingOverlay = document.getElementById("uploadingOverlay")
const uploadProgress = document.getElementById("uploadProgress")
const clearAnswerBtn = document.getElementById("clearAnswer")

let mediaRecorder
let recordedChunks = []
let isRecording = false
let hasExited = false
let pendingChunks = 0
let uploadInProgress = false
let recordingStream = null
let sequenceCounter = 0
const activeUploads = new Set()
const uploadErrors = []

const uploadedChunks = new Set() // Track uploaded chunk checksums
const chunkUploadQueue = new Map() // Track chunks being uploaded

const MAX_CHUNK_SIZE = 15 * 1024 * 1024 // 15MB
let currentChunkSize = 0
let lastChunkTime = Date.now()

let quizQuestions = []
const answers = {}
let currentQuestionIndex = 0

const performanceStats = {
  startTime: Date.now(),
  chunksGenerated: 0,
  chunksUploaded: 0,
  chunksFailed: 0,
  totalDataGenerated: 0,
  totalDataUploaded: 0,
}

// Header Statistics
const headerStats = {
  totalHeadersCreated: 0,
  totalHeaderSize: 0,
  avgHeaderSize: 0,
  headerOverhead: 0,
}

// Chunk Size Monitoring
const chunkSizeAlerts = {
  warningThreshold: 2 * 1024 * 1024, // 2MB
  dangerThreshold: 2.5 * 1024 * 1024, // 2.5MB
  consecutiveWarnings: 0,
  lastAlertTime: 0,
}

const isSubmitting = false // Add submission state tracking

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    startRecording()
  }, 500)
})

// Load Quiz Data
window.api.getQuizData().then((response) => {
  if (response && response.questions) {
    quizQuestions = response.questions
    updateUI()
  } else {
    questionElement.innerText = "Failed to load quiz questions."
  }
})

// Setup Timer
window.api.examTimer().then((res) => {
  if (res.success) {
    let timeLeft = res.timerDuration
    updateTimerDisplay(timeLeft)

    const countdown = setInterval(() => {
      timeLeft--
      if (timeLeft <= 0) {
        clearInterval(countdown)
        window.api.timerFinished()
        submitExam()
        return
      }
      updateTimerDisplay(timeLeft)
    }, 1000)
  }
})

// ===== EVENT LISTENERS SETUP =====
// Navigation Event Listeners
nextBtn.addEventListener("click", goToNextQuestion)
previousBtn.addEventListener("click", goToPreviousQuestion)

// Clear Answer Button Functionality
if (clearAnswerBtn) {
  clearAnswerBtn.addEventListener("click", () => {
    if (answerInput) {
      answerInput.value = ""
      answerInput.disabled = false // Ensure input is not disabled
      answerInput.readOnly = false // Ensure input is not read-only

      // Force focus and ensure input is interactive
      setTimeout(() => {
        answerInput.focus()
        answerInput.click() // Additional trigger to ensure input is active
      }, 50)

      // Update character count if it exists
      updateCharacterCount()

      // Show feedback
      showToast("✅ Answer cleared successfully")
    }
  })
}

// Character Count Functionality for the Answer Input
if (answerInput) {
  answerInput.addEventListener("input", updateCharacterCount)
}

// Exit Event Listener
exit.addEventListener("click", async (e) => {
  e.preventDefault()

  console.log("[v0] Exit button clicked")

  exit.innerHTML = '<span class="loading-spinner"></span> Exiting...'

  try {
    console.log("[v0] Attempting submission before exit")
    await submitExam()
  } catch (error) {
    console.error("Exit submission error:", error)
    console.log("[v0] Proceeding with exit despite submission error")
  }

  console.log("[v0] Forcing exit")
  hasExited = true
  window.api.exitExam()
})

// Submit Event Listener
submit.addEventListener("click", async (e) => {
  e.preventDefault()

  console.log("[v0] Submit button clicked, starting submission process")

  submit.disabled = true
  submit.innerHTML = '<span class="loading-spinner"></span> Submitting...'

  try {
    await submitExam()
  } catch (error) {
    console.error("[v0] Submission error:", error)
    showToast("⚠️ Please try again or use Exit button")

    submit.disabled = false
    submit.innerHTML = '<i class="fas fa-check"></i> Submit Exam'
  }
})

// Window Event Listeners
window.api.setPreventClose(true)

window.api.onForceExit(async () => {
  await submitExam()
  window.close()
})

window.api.onTryExit(() => {
  showToast(
    "❌ This button is not used to exit the exam.\n Please use the exit button in the window to leave the exam properly",
  )
})

window.api.updateTimer((event, timeLeft) => {
  updateTimerDisplay(timeLeft)

  if (timeLeft <= 10) {
    timerElement.style.color = "red"
    timerElement.style.fontWeight = "bold"
    timerElement.style.animation = "blinker 1s linear infinite"
  } else {
    timerElement.style.color = "#00ffcc"
    timerElement.style.animation = "none"
  }
})

window.api.onUploadProgress((progress) => {
  if (uploadProgress && uploadingOverlay.style.display === "block") {
    uploadProgress.value = progress.percentage

    const progressText = document.getElementById("uploadProgressText")
    if (progressText) {
      progressText.textContent = `Uploading... ${progress.percentage}% (${progress.uploaded}/${progress.total} chunks)`
    }
  }
})

window.api.onUploadComplete(() => {
  uploadInProgress = false
  pendingChunks = 0
  hideUploadingOverlay()
})

window.addEventListener("online", () => {
  showToast("✅ Network connection restored")
})

window.addEventListener("offline", () => {
  showToast("❌ Network connection lost - uploads may fail")
})

// Error Handling
window.addEventListener("error", (e) => {
  console.error("Global error:", e.error)
})

window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled promise rejection:", e.reason)
})

// Cleanup on Page Unload
window.addEventListener("beforeunload", () => {
  // Stop recording stream
  if (recordingStream) {
    recordingStream.getTracks().forEach((track) => track.stop())
  }

  // Remove event listeners
  if (window.api.removeUploadProgressListener) {
    window.api.removeUploadProgressListener()
  }
  if (window.api.removeUploadCompleteListener) {
    window.api.removeUploadCompleteListener()
  }
})

function updateUI() {
  const question = quizQuestions[currentQuestionIndex]
  if (!question) return

  document.getElementById("questionText").innerText = `Q${currentQuestionIndex + 1}: ${question.question_text}`

  const pointsContainer = document.getElementById("questionPoints")
  if (pointsContainer) {
    pointsContainer.querySelector("span:last-child").innerText = `${question.points} pts`
  }

  answerInput.value = answers[question.id] || ""

  previousBtn.style.display = currentQuestionIndex === 0 ? "none" : "inline-flex"
  previousBtn.disabled = currentQuestionIndex === 0

  const isFirstQuestion = currentQuestionIndex === 0
  const isFinalQuestion = currentQuestionIndex === quizQuestions.length - 1

  exit.style.display = "inline-flex"
  exit.disabled = false
  nextBtn.style.display = isFinalQuestion ? "none" : "inline-flex"
  submit.style.display = isFinalQuestion ? "inline-flex" : "none"

  updateProgressIndicators()
  updateCharacterCount()
}

function updateTimerDisplay(timeLeft) {
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  timerElement.innerText = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function showUploadingOverlay() {
  if (uploadingOverlay) {
    uploadingOverlay.style.display = "block"
    if (uploadProgress) {
      uploadProgress.value = 0
    }
  }
}

function hideUploadingOverlay() {
  if (uploadingOverlay) {
    uploadingOverlay.style.display = "none"
  }
}

function showToast(message) {
  const toast = document.getElementById("toast")
  if (toast) {
    toast.textContent = message
    toast.style.display = "block"
    setTimeout(() => {
      toast.style.display = "none"
    }, 5000) // Increased to 5 seconds for important messages
  } else {
    // Fallback if toast element not found
    console.warn("Toast element not found, using alert:", message)
  }
}

function saveAnswer() {
  const question = quizQuestions[currentQuestionIndex]
  answers[question.id] = answerInput.value
}

function goToNextQuestion() {
  saveAnswer()
  if (currentQuestionIndex < quizQuestions.length - 1) {
    currentQuestionIndex++
    updateUI()
  }
}

function goToPreviousQuestion() {
  saveAnswer()
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--
    updateUI()

    showToast(`📝 Moved to question ${currentQuestionIndex + 1}`)

    if (answerInput) {
      setTimeout(() => {
        answerInput.focus()
      }, 100)
    }
  }
}

function calculateOptimalInterval() {
  const actualBitrate = 256000
  const secondsFor3MB = (MAX_CHUNK_SIZE * 8) / actualBitrate
  const optimalInterval = Math.min(secondsFor3MB, 15) * 1000

  return Math.max(optimalInterval, 5000)
}

async function startRecording() {
  try {
    // Reset upload state before starting
    await window.api.resetUploadState()

    const sources = await window.api.getSources()
    const source = sources[0]

    recordingStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: source.id,
          minWidth: 854, // 480p width
          maxWidth: 854,
          minHeight: 480, // 480p height
          maxHeight: 480,
          minFrameRate: 15,
          maxFrameRate: 15,
        },
      },
    })

    mediaRecorder = new MediaRecorder(recordingStream, {
      mimeType: "video/webm;codecs=vp9",
      videoBitsPerSecond: 256000,
    })

    recordedChunks = []
    pendingChunks = 0
    currentChunkSize = 0
    lastChunkTime = Date.now()

    // Setup MediaRecorder Event Handlers
    setupMediaRecorderEventHandlers()

    const optimalInterval = calculateOptimalInterval()

    mediaRecorder.start(optimalInterval)
    isRecording = true

    // Show recording status
    const recordingStatus = document.getElementById("recordingStatus")
    if (recordingStatus) {
      recordingStatus.style.display = "block"
      recordingStatus.textContent = "🔴 Recording..."
      recordingStatus.style.color = "#ff4444"
    }
  } catch (err) {
    showToast("❌ Screen recording permission denied. You cannot start the exam.")
    await new Promise((resolve) => setTimeout(resolve, 2500))
    window.api.exitExam()
  }
}

function setupMediaRecorderEventHandlers() {
  // Data Available Handler
  mediaRecorder.ondataavailable = async (event) => {
    if (event.data && event.data.size > 0) {
      const timeTaken = (Date.now() - lastChunkTime) / 1000

      // Analyze chunk before processing
      const analysis = analyzeChunkSize(event.data.size, timeTaken)

      // Update performance stats for generation
      updatePerformanceStats("generated", event.data.size)

      // Save original chunk for local backup
      recordedChunks.push(event.data)

      // Process with Enhanced Headers
      if (analysis.isOversized) {
        await splitAndUploadLargeChunk(event.data)
      } else {
        // Normal processing with header enhancement
        await uploadChunkAsync(event.data)
      }

      lastChunkTime = Date.now()
      updateRecordingStats(analysis)

      // Log enhanced chunk statistics
      if (window.api.getChunkStats) {
        try {
          const stats = await window.api.getChunkStats()
        } catch (error) {
          // Stats not available - continue silently
        }
      }
    }
  }

  // Stop Handler
  mediaRecorder.onstop = async () => {
    // Stop all tracks to free up resources
    if (recordingStream) {
      recordingStream.getTracks().forEach((track) => track.stop())
      recordingStream = null
    }

    // Save local copy
    if (recordedChunks.length > 0) {
      const blob = new Blob(recordedChunks, { type: "video/webm" })
      const arrayBuffer = await blob.arrayBuffer()
      await window.api.saveRecording(arrayBuffer)
    }

    // Signal that recording is finished
    window.api.finishUpload()
  }

  // Error Handler
  mediaRecorder.onerror = (event) => {
    showToast("Recording error occurred. Please restart the exam.")
  }
}

function stopRecording() {
  if (!isRecording) return

  isRecording = false

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop()

    // Update recording status
    const recordingStatus = document.getElementById("recordingStatus")
    if (recordingStatus) {
      recordingStatus.textContent = "⏹️ Processing..."
      recordingStatus.style.color = "#ffaa00"
    }
  }
}

// ===== CHUNK PROCESSING FUNCTIONS =====
async function createChunkWithHeader(videoChunk) {
  // Generate unique chunk ID
  sequenceCounter++
  const chunkId = `chunk_${Date.now()}_${sequenceCounter}`

  const checksum = await calculateChecksum(videoChunk)

  if (uploadedChunks.has(checksum)) {
    console.log(`Skipping duplicate chunk with checksum: ${checksum}`)
    return null // Return null for duplicate chunks
  }

  // Create comprehensive header
  const chunkHeader = {
    // Chunk identification
    chunkId: chunkId,
    sequence: sequenceCounter,
    timestamp: Date.now(),

    // Video metadata
    originalSize: videoChunk.size,
    mimeType: videoChunk.type || "video/webm",

    // Session information
    sessionId: window.sessionId || `session_${Date.now()}`,
    studentId: window.studentId || "unknown",
    examId: window.examId || (quizQuestions.length > 0 ? quizQuestions[0].quiz : null),

    // Recording context
    currentQuestion: currentQuestionIndex + 1,
    totalQuestions: quizQuestions.length,
    currentAnswer: answerInput ? answerInput.value.length : 0,

    // System information
    userAgent: navigator.userAgent,
    screenResolution: `${screen.width}x${screen.height}`,

    // Chunk processing info
    processingTime: Date.now() - lastChunkTime,
    isLargeChunk: videoChunk.size > 2 * 1024 * 1024, // > 2MB

    // Upload metadata
    uploadAttempt: 1,
    priority: calculateChunkPriority(videoChunk.size),

    // Validation
    checksum: checksum,

    // Header version for future compatibility
    headerVersion: "2.0",
  }

  // Convert header to binary format
  const headerJSON = JSON.stringify(chunkHeader)
  const headerBuffer = new TextEncoder().encode(headerJSON)

  // Create header size indicator (4 bytes)
  const headerSizeBuffer = new ArrayBuffer(4)
  const headerSizeView = new DataView(headerSizeBuffer)
  headerSizeView.setUint32(0, headerBuffer.length, false) // Big endian

  // Get video data
  const videoBuffer = await videoChunk.arrayBuffer()

  // Combine all parts: [HeaderSize][Header][VideoData]
  const combinedBuffer = new ArrayBuffer(4 + headerBuffer.length + videoBuffer.byteLength)

  const combinedView = new Uint8Array(combinedBuffer)
  let offset = 0

  // Copy header size (4 bytes)
  combinedView.set(new Uint8Array(headerSizeBuffer), offset)
  offset += 4

  // Copy header data
  combinedView.set(headerBuffer, offset)
  offset += headerBuffer.length

  // Copy video data
  combinedView.set(new Uint8Array(videoBuffer), offset)

  // Create enhanced blob
  const enhancedBlob = new Blob([combinedBuffer], {
    type: "application/octet-stream",
  })

  return enhancedBlob
}

async function uploadChunkAsync(chunk) {
  try {
    pendingChunks++

    const checksum = await calculateChecksum(chunk)

    if (uploadedChunks.has(checksum) || chunkUploadQueue.has(checksum)) {
      console.log(`[v0] Skipping duplicate chunk with checksum: ${checksum}`)
      pendingChunks = Math.max(0, pendingChunks - 1)
      return { success: true, skipped: true, reason: "duplicate" }
    }

    chunkUploadQueue.set(checksum, true)

    // Create Chunk with Header and Metadata instantly
    const chunkWithHeader = await createChunkWithHeader(chunk)

    if (!chunkWithHeader) {
      chunkUploadQueue.delete(checksum)
      pendingChunks = Math.max(0, pendingChunks - 1)
      return { success: true, skipped: true, reason: "duplicate" }
    }

    // Convert and upload immediately
    const arrayBuffer = await chunkWithHeader.arrayBuffer()
    const result = await window.api.uploadChunk(new Uint8Array(arrayBuffer))

    chunkUploadQueue.delete(checksum)

    if (result.success || result.statusCode === 409) {
      if (result.statusCode === 409) {
        console.log(`[v0] Chunk already exists on server (409), marking as successful: ${checksum}`)
        result.success = true
        result.message = "Chunk already uploaded"
      }
      uploadedChunks.add(checksum)
      updatePerformanceStats("uploaded", chunkWithHeader.size, true)
    } else {
      updatePerformanceStats("uploaded", chunkWithHeader.size, false)
      console.error(`[v0] Upload failed for chunk ${checksum}:`, result)

      if (result.finalAttempt) {
        showToast(`⚠️ Upload error: ${result.message}`)
      }
    }

    pendingChunks = Math.max(0, pendingChunks - 1)
    return result
  } catch (error) {
    const checksum = await calculateChecksum(chunk)
    chunkUploadQueue.delete(checksum)

    pendingChunks = Math.max(0, pendingChunks - 1)
    console.error(`[v0] Network error during upload:`, error)
    showToast("⚠️ Network error during upload")
    updatePerformanceStats("uploaded", 0, false)
    return { success: false, error: error.message }
  }
}

async function splitAndUploadLargeChunk(largeBlob) {
  const originalSizeMB = (largeBlob.size / 1024 / 1024).toFixed(2)

  const SAFE_CHUNK_SIZE = 2 * 1024 * 1024
  const totalParts = Math.ceil(largeBlob.size / SAFE_CHUNK_SIZE)

  for (let i = 0; i < totalParts; i++) {
    const start = i * SAFE_CHUNK_SIZE
    const end = Math.min(start + SAFE_CHUNK_SIZE, largeBlob.size)
    const chunkPart = largeBlob.slice(start, end)

    const partSizeMB = (chunkPart.size / 1024 / 1024).toFixed(2)

    // Each split part gets its own header
    recordedChunks.push(chunkPart)
    await uploadChunkAsync(chunkPart)

    // Small delay between parts
    if (i < totalParts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
  }
}

// ===== UTILITY FUNCTIONS =====
function calculateChunkPriority(chunkSize) {
  // Higher priority for smaller, more manageable chunks
  if (chunkSize < 1024 * 1024) return "high" // < 1MB
  if (chunkSize < 3 * 1024 * 1024) return "normal" // < 3MB
  if (chunkSize < 5 * 1024 * 1024) return "low" // < 5MB
  return "critical" // > 5MB - needs special handling
}

async function calculateChecksum(chunk) {
  try {
    const buffer = await chunk.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .substring(0, 16)
  } catch (error) {
    return "unknown"
  }
}

// ===== MONITORING AND ANALYSIS FUNCTIONS =====
function analyzeChunkSize(chunkSize, timeTaken) {
  const chunkSizeMB = (chunkSize / (1024 * 1024)).toFixed(2)
  const now = Date.now()

  if (chunkSize > chunkSizeAlerts.dangerThreshold) {
    if (now - chunkSizeAlerts.lastAlertTime > 30000) {
      showToast(`🚨 Recording chunks are too large: ${chunkSizeMB}MB. This may cause upload failures.`)
      chunkSizeAlerts.lastAlertTime = now
    }

    chunkSizeAlerts.consecutiveWarnings++

    if (chunkSizeAlerts.consecutiveWarnings >= 3) {
      showToast("🔄 Multiple large chunks detected. Consider restarting the exam for better performance.")
    }
  } else if (chunkSize > chunkSizeAlerts.warningThreshold) {
    chunkSizeAlerts.consecutiveWarnings++
  } else {
    chunkSizeAlerts.consecutiveWarnings = 0
  }

  return {
    size: chunkSize,
    sizeMB: chunkSizeMB,
    timeTaken: timeTaken,
    isOversized: chunkSize > chunkSizeAlerts.dangerThreshold,
    isLarge: chunkSize > chunkSizeAlerts.warningThreshold,
    rating:
      chunkSize < chunkSizeAlerts.warningThreshold
        ? "good"
        : chunkSize < chunkSizeAlerts.dangerThreshold
          ? "warning"
          : "danger",
  }
}

function updateRecordingStats(analysis) {
  const recordingStatus = document.getElementById("recordingStatus")
  if (recordingStatus) {
    recordingStatus.textContent = "🔴 Recording"
    recordingStatus.style.color = "#ff4444"
    recordingStatus.style.display = "block"
  }
}

function updatePerformanceStats(action, chunkSize = 0, success = true) {
  switch (action) {
    case "generated":
      performanceStats.chunksGenerated++
      performanceStats.totalDataGenerated += chunkSize
      break
    case "uploaded":
      if (success) {
        performanceStats.chunksUploaded++
        performanceStats.totalDataUploaded += chunkSize
      } else {
        performanceStats.chunksFailed++
      }
      break
  }
}

function updateHeaderStats(headerSize, totalChunkSize) {
  headerStats.totalHeadersCreated++
  headerStats.totalHeaderSize += headerSize
  headerStats.avgHeaderSize = headerStats.totalHeaderSize / headerStats.totalHeadersCreated
  headerStats.headerOverhead = (headerStats.totalHeaderSize / totalChunkSize) * 100
}

function handleOversizedChunk(chunkSize) {
  const sizeMB = (chunkSize / (1024 * 1024)).toFixed(2)

  // Suggestions for the user
  const suggestions = [
    "🔄 Try restarting the exam for better performance",
    "🌐 Check your internet connection stability",
    "💻 Close other applications to free up resources",
    "⚙️ The system will automatically adjust recording quality",
  ]

  const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)]
  showToast(`${randomSuggestion}`)

  return false
}

function showChunkSizeWarning(sizeMB) {
  const warningMessages = {
    high: `⚠️ Recording chunks are large (${sizeMB}MB). This is normal but may slow uploads.`,
    veryHigh: `🔸 Recording chunks are very large (${sizeMB}MB). Consider restarting if upload issues occur.`,
    critical: `🚨 Recording chunks are critically large (${sizeMB}MB). Upload may fail. Restart recommended.`,
  }

  const size = Number.parseFloat(sizeMB)

  if (size > 8) {
    showToast(warningMessages.critical)
  } else if (size > 6) {
    showToast(warningMessages.veryHigh)
  } else if (size > 4) {
    showToast(warningMessages.high)
  }
}

// ===== EXAM SUBMISSION FUNCTIONS =====
async function submitExam() {
  if (hasExited) {
    console.log("[v0] Exam already submitted, skipping")
    showToast("❌ Exam already submitted")
    return
  }

  console.log("[v0] Starting submitExam function")
  console.log("[v0] Quiz questions:", quizQuestions.length)
  console.log("[v0] Current answers:", Object.keys(answers).length)

  // Save current answer before submission
  saveAnswer()

  // Show upload overlay immediately for better UX
  showUploadingOverlay()
  uploadInProgress = true

  try {
    // Stop recording if still active
    if (isRecording && mediaRecorder && mediaRecorder.state === "recording") {
      console.log("[v0] Stopping recording before submission")
      stopRecording()
      // Wait a moment for recording to stop properly
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    console.log("[v0] Checking for pending uploads...")
    let waitTime = 0
    const maxWaitTime = 2000 // Reduced to 2 seconds

    while (pendingChunks > 0 && waitTime < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, 200))
      waitTime += 200
      console.log(`[v0] Waiting for ${pendingChunks} pending chunks... (${waitTime}ms)`)
    }

    if (pendingChunks > 0) {
      console.log(`[v0] Proceeding with submission despite ${pendingChunks} pending chunks`)
    }

    // Prepare answers array with default "no answer" for empty responses
    const answersArray = quizQuestions.map((question) => {
      const answerText = answers[question.id] || ""
      return {
        question_id: Number(question.id),
        answer_text: answerText.trim() || "no answer",
      }
    })

    console.log("[v0] Prepared answers array:", answersArray)

    const quizId = window.quizId || (quizQuestions.length > 0 ? quizQuestions[0].quiz : null)

    if (!quizId) {
      console.error("[v0] Quiz ID not found, attempting submission anyway")
      const fallbackQuizId = quizQuestions.length > 0 ? quizQuestions[0].quiz : 1
      console.log("[v0] Using fallback quiz ID:", fallbackQuizId)
    }

    const finalQuizId = quizId || (quizQuestions.length > 0 ? quizQuestions[0].quiz : 1)
    console.log("[v0] Submitting quiz with ID:", finalQuizId)
    console.log(
      "[v0] API URL: https://quizroom-backend-production.up.railway.app/api/student/quizzes/" +
        finalQuizId +
        "/submit/",
    )

    const progressText = document.getElementById("uploadProgressText")
    if (progressText) {
      progressText.textContent = "Submitting exam..."
    }

    console.log("[v0] Making API call to submit quiz")
    console.log("[v0] Answers being sent:", JSON.stringify(answersArray, null, 2))

    const submitResult = await window.api.submitQuiz(finalQuizId, answersArray)

    console.log("[v0] Raw API response:", JSON.stringify(submitResult, null, 2))

    if (submitResult && (submitResult.success || submitResult.detail)) {
      hideUploadingOverlay()
      showToast("✅ Exam submitted successfully!")

      hasExited = true
      uploadInProgress = false

      console.log("[v0] Submission successful, navigating away")

      // Auto-navigate after brief delay
      setTimeout(() => {
        window.api.exitExam()
      }, 2000)

      return // Return early on success
    } else {
      console.log("[v0] Unexpected API response format:", submitResult)

      // Try to extract useful information from response
      if (submitResult && submitResult.message && submitResult.message.includes("already submitted")) {
        hideUploadingOverlay()
        showToast("✅ Exam was already submitted successfully!")
        hasExited = true
        uploadInProgress = false
        setTimeout(() => {
          window.api.exitExam()
        }, 2000)
        return
      }

      console.log("[v0] Attempting to exit despite unexpected response")
      hideUploadingOverlay()
      showToast("⚠️ Submission completed - please check your results")
      hasExited = true
      uploadInProgress = false
      setTimeout(() => {
        window.api.exitExam()
      }, 3000)
      return
    }
  } catch (error) {
    console.error("[v0] Submission error details:", error)
    hideUploadingOverlay()

    let errorMessage = "Submission may have completed - please check your results"

    if (error.message && error.message.includes("timeout")) {
      errorMessage = "Submission timed out but may have succeeded - please check your results"
    } else if (error.message && error.message.includes("Network")) {
      errorMessage = "Network error during submission - please check your results"
    }

    showToast(`⚠️ ${errorMessage}`)

    uploadInProgress = false

    const submitBtn = document.getElementById("Submit")
    const exitBtn = document.getElementById("Exit")

    if (submitBtn) {
      submitBtn.disabled = false
      submitBtn.innerHTML = '<i class="fas fa-check"></i> Submit Exam'
    }

    if (exitBtn) {
      exitBtn.disabled = false
      exitBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Exit Exam'
    }

    console.error("[v0] Full error object:", error)
    console.error("[v0] Error stack:", error.stack)

    setTimeout(() => {
      showToast("You can still exit the exam using the Exit button")
    }, 3000)
  }
}

function updateCharacterCount() {
  const characterCountElement = document.getElementById("characterCount")
  if (characterCountElement) {
    characterCountElement.innerText = `Characters: ${answerInput.value.length}`
  }
}

function updateProgressIndicators() {
  const progressIndicator = document.getElementById("progressIndicator")
  if (progressIndicator) {
    progressIndicator.innerText = `Question ${currentQuestionIndex + 1} of ${quizQuestions.length}`
  }
}
