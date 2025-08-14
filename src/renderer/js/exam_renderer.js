const submit = document.getElementById('Submit');
const exit = document.getElementById('Exit');
const nextBtn = document.getElementById('NextQuestion');
const previousBtn = document.getElementById('Previous');
const questionElement = document.getElementById('Question');
const answerInput = document.getElementById('answer');
const timerElement = document.getElementById('timer');
const uploadingOverlay = document.getElementById('uploadingOverlay');
const uploadProgress = document.getElementById('uploadProgress');

let mediaRecorder;
let recordingChunks = []; 
let isRecording = false;
let hasExited = false;
let pendingChunks = 0;
let uploadInProgress = false;
let recordingStream = null; 
let sequenceCounter = 0;
let activeUploads = new Set(); 
let uploadErrors = [];

const MAX_CHUNK_SIZE = 15 * 1024 * 1024; // 15MB
let currentChunkSize = 0;
let lastChunkTime = Date.now();

let quizQuestions = [];
let answers = {};
let currentQuestionIndex = 0;

let performanceStats = {
  startTime: Date.now(),
  chunksGenerated: 0,
  chunksUploaded: 0,
  chunksFailed: 0,
  totalDataGenerated: 0,
  totalDataUploaded: 0
};

// Header Statistics
let headerStats = {
  totalHeadersCreated: 0,
  totalHeaderSize: 0,
  avgHeaderSize: 0,
  headerOverhead: 0
};

// Chunk Size Monitoring
let chunkSizeAlerts = {
  warningThreshold: 2 * 1024 * 1024, // 2MB
  dangerThreshold: 2.5 * 1024 * 1024, // 2.5MB
  consecutiveWarnings: 0,
  lastAlertTime: 0
};

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    startRecording();
  }, 500);
});

// Load Quiz Data
window.api.getQuizData().then((response) => {
  if (response && response.questions) {
    quizQuestions = response.questions;
    updateUI();
  } else {
    questionElement.innerText = 'Failed to load quiz questions.';
  }
});

// Setup Timer
window.api.examTimer().then((res) => {
  if (res.success) {
    let timeLeft = res.timerDuration;
    updateTimerDisplay(timeLeft);

    const countdown = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(countdown);
        window.api.timerFinished();
        submitExam();
        return;
      }
      updateTimerDisplay(timeLeft);
    }, 1000);
  }
});

// ===== EVENT LISTENERS SETUP =====
// Navigation Event Listeners
nextBtn.addEventListener('click', goToNextQuestion);
previousBtn.addEventListener('click', goToPreviousQuestion);

// Exit Event Listener
exit.addEventListener('click', async () => {
  const confirmExit = confirm('Are you sure you want to exit the exam? Your answers will be submitted.');
  if (confirmExit) {
    await submitExam();
    window.api.exitExam();
  }
});

// Submit Event Listener
submit.addEventListener('click', async () => {
  await submitExam();
});

// Window Event Listeners
window.api.setPreventClose(true);

window.api.onForceExit(async () => {
  await submitExam();
  window.close();
});

window.api.onTryExit(() => {
  showToast('❌ This button is not used to exit the exam.\n Please use the exit button in the window to leave the exam properly');
});

window.api.updateTimer((event, timeLeft) => {
  updateTimerDisplay(timeLeft);
  
  if (timeLeft <= 10) {
    timerElement.style.color = 'red';
    timerElement.style.fontWeight = 'bold';
    timerElement.style.animation = 'blinker 1s linear infinite';
  } else {
    timerElement.style.color = '#00ffcc';
    timerElement.style.animation = 'none';
  }
});

// Upload Progress Listener
window.api.onUploadProgress((progress) => {
  if (uploadProgress && uploadingOverlay.style.display === 'block') {
    uploadProgress.value = progress.percentage;
    
    const progressText = document.getElementById('uploadProgressText');
    if (progressText) {
      progressText.textContent = `Uploading... ${progress.percentage}% (${progress.uploaded}/${progress.total} chunks)`;
    }
  }
});

window.api.onUploadComplete(() => {
  uploadInProgress = false;
  pendingChunks = 0;
  hideUploadingOverlay();
});

window.addEventListener('online', () => {
  showToast('✅ Network connection restored');
});

window.addEventListener('offline', () => {
  showToast('❌ Network connection lost - uploads may fail');
});

// Error Handling
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
});

// Cleanup on Page Unload
window.addEventListener('beforeunload', () => {
  // Stop recording stream
  if (recordingStream) {
    recordingStream.getTracks().forEach(track => track.stop());
  }
  
  // Remove event listeners
  if (window.api.removeUploadProgressListener) {
    window.api.removeUploadProgressListener();
  }
  if (window.api.removeUploadCompleteListener) {
    window.api.removeUploadCompleteListener();
  }
});

function updateUI() {
  const question = quizQuestions[currentQuestionIndex];
  if (!question) return;

  document.getElementById('questionText').innerText = `Q${currentQuestionIndex + 1}: ${question.question_text}`;
  
  const pointsContainer = document.getElementById('questionPoints');
  if (pointsContainer) {
    pointsContainer.querySelector('span:last-child').innerText = `${question.points} pts`;
  }

  answerInput.value = answers[question.id] || "";

  previousBtn.style.display = currentQuestionIndex === 0 ? 'none' : 'inline-block';
  exit.style.display = currentQuestionIndex === 0 ? 'block' : 'none';
  nextBtn.style.display = currentQuestionIndex === quizQuestions.length - 1 ? 'none' : 'inline-block';
  submit.style.display = currentQuestionIndex === quizQuestions.length - 1 ? 'inline-block' : 'none';
}

function updateTimerDisplay(timeLeft) {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  timerElement.innerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function showUploadingOverlay() {
  if (uploadingOverlay) {
    uploadingOverlay.style.display = 'block';
    if (uploadProgress) {
      uploadProgress.value = 0;
    }
  }
}

function hideUploadingOverlay() {
  if (uploadingOverlay) {
    uploadingOverlay.style.display = 'none';
  }
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (toast) {
    toast.textContent = message;
    toast.style.display = "block";
    setTimeout(() => {
      toast.style.display = "none";
    }, 5000); // Increased to 5 seconds for important messages
  } else {
    // Fallback if toast element not found
    console.warn("Toast element not found, using alert:", message);
  }
}

function saveAnswer() {
  const question = quizQuestions[currentQuestionIndex];
  answers[question.id] = answerInput.value;
}

function goToNextQuestion() {
  saveAnswer();
  if (currentQuestionIndex < quizQuestions.length - 1) {
    currentQuestionIndex++;
    updateUI();
  }
}

function goToPreviousQuestion() {
  saveAnswer();
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    updateUI();
  }
}

function calculateOptimalInterval() {
  const actualBitrate = 256000;
  const secondsFor3MB = (MAX_CHUNK_SIZE * 8) / actualBitrate; 
  const optimalInterval = Math.min(secondsFor3MB, 15) * 1000; 
  
  return Math.max(optimalInterval, 5000); 
}

async function startRecording() {
  try {
    // Reset upload state before starting
    await window.api.resetUploadState();
    
    const sources = await window.api.getSources();
    const source = sources[0];

    recordingStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id,
          minWidth: 854,        // 480p width
          maxWidth: 854,
          minHeight: 480,       // 480p height
          maxHeight: 480,
          minFrameRate: 15,     
          maxFrameRate: 15
        }
      }
    });

    mediaRecorder = new MediaRecorder(recordingStream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 256000 
    });
    
    recordingChunks = [];
    pendingChunks = 0;
    currentChunkSize = 0;
    lastChunkTime = Date.now();

    // Setup MediaRecorder Event Handlers
    setupMediaRecorderEventHandlers();

    const optimalInterval = calculateOptimalInterval();
    
    mediaRecorder.start(optimalInterval);
    isRecording = true;
    
    // Show recording status
    const recordingStatus = document.getElementById('recordingStatus');
    if (recordingStatus) {
      recordingStatus.style.display = 'block';
      recordingStatus.textContent = '🔴 Recording...';
      recordingStatus.style.color = '#ff4444';
    }

  } catch (err) {
    showToast("❌ Screen recording permission denied. You cannot start the exam.");
    await new Promise(resolve => setTimeout(resolve, 2500));
    window.api.exitExam();
  }
}

function setupMediaRecorderEventHandlers() {
  // Data Available Handler
  mediaRecorder.ondataavailable = async (event) => {
    if (event.data && event.data.size > 0) {
      const timeTaken = (Date.now() - lastChunkTime) / 1000;
      
      // Analyze chunk before processing
      const analysis = analyzeChunkSize(event.data.size, timeTaken);
      
      // Update performance stats for generation
      updatePerformanceStats('generated', event.data.size);
      
      // Save original chunk for local backup
      recordingChunks.push(event.data);
      
      // Process with Enhanced Headers
      if (analysis.isOversized) {
        await splitAndUploadLargeChunk(event.data);
      } else {
        // Normal processing with header enhancement
        await uploadChunkAsync(event.data);
      }
      
      lastChunkTime = Date.now();
      updateRecordingStats(analysis);
      
      // Log enhanced chunk statistics
      if (window.api.getChunkStats) {
        try {
          const stats = await window.api.getChunkStats();
        } catch (error) {
          // Stats not available - continue silently
        }
      }
    }
  };

  // Stop Handler
  mediaRecorder.onstop = async () => {
    // Stop all tracks to free up resources
    if (recordingStream) {
      recordingStream.getTracks().forEach(track => track.stop());
      recordingStream = null;
    }
    
    // Save local copy
    if (recordingChunks.length > 0) {
      const blob = new Blob(recordingChunks, { type: 'video/webm' });
      const arrayBuffer = await blob.arrayBuffer();
      await window.api.saveRecording(arrayBuffer);
    }
    
    // Signal that recording is finished
    window.api.finishUpload();
  };

  // Error Handler
  mediaRecorder.onerror = (event) => {
    showToast("Recording error occurred. Please restart the exam.");
  };
}

function stopRecording() {
  if (!isRecording) return;
  
  isRecording = false;
  
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    
    // Update recording status
    const recordingStatus = document.getElementById('recordingStatus');
    if (recordingStatus) {
      recordingStatus.textContent = '⏹️ Processing...';
      recordingStatus.style.color = '#ffaa00';
    }
  }
}

// ===== CHUNK PROCESSING FUNCTIONS =====
async function createChunkWithHeader(videoChunk) {
  // Generate unique chunk ID
  sequenceCounter++;
  const chunkId = `chunk_${Date.now()}_${sequenceCounter}`;
  
  // Create comprehensive header
  const chunkHeader = {
    // Chunk identification
    chunkId: chunkId,
    sequence: sequenceCounter,
    timestamp: Date.now(),
    
    // Video metadata
    originalSize: videoChunk.size,
    mimeType: videoChunk.type || 'video/webm',
    
    // Session information
    sessionId: window.sessionId || `session_${Date.now()}`,
    studentId: window.studentId || 'unknown',
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
    isLargeChunk: videoChunk.size > (2 * 1024 * 1024), // > 2MB
    
    // Upload metadata
    uploadAttempt: 1,
    priority: calculateChunkPriority(videoChunk.size),
    
    // Validation
    checksum: await calculateChecksum(videoChunk),
    
    // Header version for future compatibility
    headerVersion: "2.0"
  };
  
  // Convert header to binary format
  const headerJSON = JSON.stringify(chunkHeader);
  const headerBuffer = new TextEncoder().encode(headerJSON);
  
  // Create header size indicator (4 bytes)
  const headerSizeBuffer = new ArrayBuffer(4);
  const headerSizeView = new DataView(headerSizeBuffer);
  headerSizeView.setUint32(0, headerBuffer.length, false); // Big endian
  
  // Get video data
  const videoBuffer = await videoChunk.arrayBuffer();
  
  // Combine all parts: [HeaderSize][Header][VideoData]
  const combinedBuffer = new ArrayBuffer(
    4 + headerBuffer.length + videoBuffer.byteLength
  );
  
  const combinedView = new Uint8Array(combinedBuffer);
  let offset = 0;
  
  // Copy header size (4 bytes)
  combinedView.set(new Uint8Array(headerSizeBuffer), offset);
  offset += 4;
  
  // Copy header data
  combinedView.set(headerBuffer, offset);
  offset += headerBuffer.length;
  
  // Copy video data
  combinedView.set(new Uint8Array(videoBuffer), offset);
  
  // Create enhanced blob
  const enhancedBlob = new Blob([combinedBuffer], { 
    type: 'application/octet-stream' 
  });
  
  return enhancedBlob;
}

async function uploadChunkAsync(chunk) {
  try {
    pendingChunks++;
    const chunkSizeMB = (chunk.size / (1024 * 1024)).toFixed(2);
    
    // Create Chunk with Header and Metadata
    const chunkWithHeader = await createChunkWithHeader(chunk);
    
    if (chunkWithHeader.size > MAX_CHUNK_SIZE) {
      showToast(`🚨 Chunk too large: ${(chunkWithHeader.size / (1024 * 1024)).toFixed(2)}MB`);
    }
    
    // Convert the enhanced chunk to buffer
    const arrayBuffer = await chunkWithHeader.arrayBuffer();
    const result = await window.api.uploadChunk(new Uint8Array(arrayBuffer));
    
    pendingChunks = Math.max(0, pendingChunks - 1);
    
    if (result.success) {
      updatePerformanceStats('uploaded', chunkWithHeader.size, true);
    } else {
      updatePerformanceStats('uploaded', chunkWithHeader.size, false);
      
      if (result.finalAttempt) {
        showToast(`⚠️ Upload error: ${result.message}`);
      }
    }
  } catch (error) {
    pendingChunks = Math.max(0, pendingChunks - 1);
    showToast("⚠️ Network error during upload");
    updatePerformanceStats('uploaded', 0, false);
  }
}

async function splitAndUploadLargeChunk(largeBlob) {
  const originalSizeMB = (largeBlob.size / 1024 / 1024).toFixed(2);
  
  const SAFE_CHUNK_SIZE = 2 * 1024 * 1024; 
  const totalParts = Math.ceil(largeBlob.size / SAFE_CHUNK_SIZE);
  
  for (let i = 0; i < totalParts; i++) {
    const start = i * SAFE_CHUNK_SIZE;
    const end = Math.min(start + SAFE_CHUNK_SIZE, largeBlob.size);
    const chunkPart = largeBlob.slice(start, end);
    
    const partSizeMB = (chunkPart.size / 1024 / 1024).toFixed(2);
    
    // Each split part gets its own header
    recordingChunks.push(chunkPart);
    await uploadChunkAsync(chunkPart);
    
    // Small delay between parts
    if (i < totalParts - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
}

// ===== UTILITY FUNCTIONS =====
function calculateChunkPriority(chunkSize) {
  // Higher priority for smaller, more manageable chunks
  if (chunkSize < 1024 * 1024) return 'high';        // < 1MB
  if (chunkSize < 3 * 1024 * 1024) return 'normal';  // < 3MB  
  if (chunkSize < 5 * 1024 * 1024) return 'low';     // < 5MB
  return 'critical';  // > 5MB - needs special handling
}

async function calculateChecksum(chunk) {
  try {
    const buffer = await chunk.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
  } catch (error) {
    return 'unknown';
  }
}

// ===== MONITORING AND ANALYSIS FUNCTIONS =====
function analyzeChunkSize(chunkSize, timeTaken) {
  const chunkSizeMB = (chunkSize / (1024 * 1024)).toFixed(2);
  const now = Date.now();
  
  if (chunkSize > chunkSizeAlerts.dangerThreshold) {
    if (now - chunkSizeAlerts.lastAlertTime > 30000) {
      showToast(`🚨 Recording chunks are too large: ${chunkSizeMB}MB. This may cause upload failures.`);
      chunkSizeAlerts.lastAlertTime = now;
    }
    
    chunkSizeAlerts.consecutiveWarnings++;
    
    if (chunkSizeAlerts.consecutiveWarnings >= 3) {
      showToast("🔄 Multiple large chunks detected. Consider restarting the exam for better performance.");
    }
    
  } else if (chunkSize > chunkSizeAlerts.warningThreshold) {
    chunkSizeAlerts.consecutiveWarnings++;
    
  } else {
    chunkSizeAlerts.consecutiveWarnings = 0;
  }
  
  return {
    size: chunkSize,
    sizeMB: chunkSizeMB,
    timeTaken: timeTaken,
    isOversized: chunkSize > chunkSizeAlerts.dangerThreshold,
    isLarge: chunkSize > chunkSizeAlerts.warningThreshold,
    rating: chunkSize < chunkSizeAlerts.warningThreshold ? 'good' : 
            chunkSize < chunkSizeAlerts.dangerThreshold ? 'warning' : 'danger'
  };
}

function updateRecordingStats(analysis) {
  const recordingStatus = document.getElementById('recordingStatus');
  if (recordingStatus) {
    let statusText = '🔴 Recording';
    let statusColor = '#ff4444';
    
    switch(analysis.rating) {
      case 'good':
        statusText += ` (${analysis.sizeMB}MB ✅)`;
        statusColor = '#44ff44';
        break;
      case 'warning':
        statusText += ` (${analysis.sizeMB}MB ⚠️)`;
        statusColor = '#ffaa00';
        break;
      case 'danger':
        statusText += ` (${analysis.sizeMB}MB 🚨)`;
        statusColor = '#ff4444';
        break;
    }
    
    recordingStatus.textContent = statusText;
    recordingStatus.style.color = statusColor;
  }
}

function updatePerformanceStats(action, chunkSize = 0, success = true) {
  switch(action) {
    case 'generated':
      performanceStats.chunksGenerated++;
      performanceStats.totalDataGenerated += chunkSize;
      break;
    case 'uploaded':
      if (success) {
        performanceStats.chunksUploaded++;
        performanceStats.totalDataUploaded += chunkSize;
      } else {
        performanceStats.chunksFailed++;
      }
      break;
  }
}

function updateHeaderStats(headerSize, totalChunkSize) {
  headerStats.totalHeadersCreated++;
  headerStats.totalHeaderSize += headerSize;
  headerStats.avgHeaderSize = headerStats.totalHeaderSize / headerStats.totalHeadersCreated;
  headerStats.headerOverhead = (headerStats.totalHeaderSize / totalChunkSize) * 100;
}

function handleOversizedChunk(chunkSize) {
  const sizeMB = (chunkSize / (1024 * 1024)).toFixed(2);
  
  // Suggestions for the user
  const suggestions = [
    "🔄 Try restarting the exam for better performance",
    "🌐 Check your internet connection stability", 
    "💻 Close other applications to free up resources",
    "⚙️ The system will automatically adjust recording quality"
  ];
  
  const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
  showToast(`${randomSuggestion}`);
  
  return false; 
}

function showChunkSizeWarning(sizeMB) {
  const warningMessages = {
    high: `⚠️ Recording chunks are large (${sizeMB}MB). This is normal but may slow uploads.`,
    veryHigh: `🔸 Recording chunks are very large (${sizeMB}MB). Consider restarting if upload issues occur.`,
    critical: `🚨 Recording chunks are critically large (${sizeMB}MB). Upload may fail. Restart recommended.`
  };
  
  const size = parseFloat(sizeMB);
  
  if (size > 8) {
    showToast(warningMessages.critical);
  } else if (size > 6) {
    showToast(warningMessages.veryHigh);
  } else if (size > 4) {
    showToast(warningMessages.high);
  }
}

// ===== EXAM SUBMISSION FUNCTIONS =====
async function submitExam() {
  if (hasExited) return;

  // Check if recording is active
  if (!isRecording || !mediaRecorder || mediaRecorder.state !== 'recording') {
    // Don't block submission, but warn
    showToast("⚠️ Warning: Recording may not be active");
  }

  saveAnswer();
  
  stopRecording();
  
  if (pendingChunks > 0) {
    showUploadingOverlay();
    uploadInProgress = true;
  }
  
  let waitCount = 0;
  const maxWait = 90; 
  
  while ((uploadInProgress || pendingChunks > 0) && waitCount < maxWait) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    waitCount++;
    
    // Update progress display
    const progressText = document.getElementById('uploadProgressText');
    if (progressText) {
      progressText.textContent = `Finalizing upload... ${waitCount}/${maxWait}s`;
    }
  }
  
  if (waitCount >= maxWait) {
    showToast("⚠️ Upload timeout - submitting anyway");
  }
  
  hideUploadingOverlay();

  // Submit quiz answers
  const answersArray = Object.entries(answers).map(([question_id, answer_text]) => ({
    question_id: Number(question_id),
    answer_text: (answer_text || "").trim()
  }));

  const quizId = window.quizId || (quizQuestions.length > 0 ? quizQuestions[0].quiz : null);

  if (!quizId) {
    alert("Quiz ID not found.");
    return;
  }
showUploadingOverlay();
const progressText = document.getElementById('uploadProgressText');
if (progressText) {
  progressText.textContent = "Submitting exam...";
}
  const result = await window.api.submitQuiz(quizId, answersArray);
hideUploadingOverlay();
  if (result.success) {
    alert(result.detail);
    if (!hasExited) {
      hasExited = true;
      window.api.exitExam();
    }
  } else {
    alert(result.message || "Failed to submit quiz.");
  }
}

// ===== MONITORING AND DEBUGGING =====
setTimeout(async () => {
  if (window.api.getUploadDebug) {
    const debug = await window.api.getUploadDebug();
  }
}, 5000);

setInterval(() => {
  // Check if recording unexpectedly stopped
  if (isRecording && (!mediaRecorder || mediaRecorder.state !== 'recording')) {
    showToast('⚠️ Recording may have stopped unexpectedly');
  }
}, 15000); // Check every 15 seconds

// Performance and Size Monitoring
setInterval(async () => {
  if (mediaRecorder && isRecording) {
    // Check upload statistics if available
    if (window.api.getUploadStats) {
      try {
        const stats = await window.api.getUploadStats();
        
      } catch (error) {
        // Could not fetch upload stats
      }
    }
  }
  
  // Auto-restart recording if stopped unexpectedly
  if (isRecording && (!mediaRecorder || mediaRecorder.state !== 'recording')) {
    showToast('🔄 Recording stopped unexpectedly - attempting restart...');
    
    try {
      await startRecording();
    } catch (error) {
      showToast('❌ Could not restart recording. Please exit and re-enter the exam.');
    }
  }
}, 15000);

// ===== ADDITIONAL UTILITY FUNCTIONS =====
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
