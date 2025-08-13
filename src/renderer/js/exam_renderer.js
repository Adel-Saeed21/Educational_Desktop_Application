const submit = document.getElementById('Submit');
const exit = document.getElementById('Exit');
const nextBtn = document.getElementById('NextQuestion');
const previousBtn = document.getElementById('Previous');
const questionElement = document.getElementById('Question');
const answerInput = document.getElementById('answer');
const timerElement = document.getElementById('timer');

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
// UI Elements
const uploadingOverlay = document.getElementById('uploadingOverlay');
const uploadProgress = document.getElementById('uploadProgress');

const MAX_CHUNK_SIZE = 15 * 1024 * 1024; 
let currentChunkSize = 0;
let lastChunkTime = Date.now();

// Quiz Variables
let quizQuestions = [];
let answers = {};
let currentQuestionIndex = 0;

// ===== QUIZ DATA LOADING =====
window.api.getQuizData().then((response) => {
  if (response && response.questions) {
    quizQuestions = response.questions;
    updateUI();
  } else {
    questionElement.innerText = 'Failed to load quiz questions.';
  }
});

// ===== TIMER SETUP =====
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
window.api.onForceExit(async () => {
  await submitExam();
  window.close();
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

window.api.setPreventClose(true);

window.api.onTryExit(() => {
  showToast('❌ This button is not used to exit the exam.\n Please use the exit button in the window to leave the exam properly');
});

// ===== UPLOAD PROGRESS LISTENER =====
window.api.onUploadProgress((progress) => {
  console.log(`📊 Upload Progress: ${progress.uploaded}/${progress.total} (${progress.percentage}%)`);
  
  if (uploadProgress && uploadingOverlay.style.display === 'block') {
    uploadProgress.value = progress.percentage;
    
    const progressText = document.getElementById('uploadProgressText');
    if (progressText) {
      progressText.textContent = `Uploading... ${progress.percentage}% (${progress.uploaded}/${progress.total} chunks)`;
    }
  }
});

// ===== UPLOAD COMPLETION LISTENER =====
window.api.onUploadComplete(() => {
  console.log("🎯 All chunks uploaded successfully!");
  uploadInProgress = false;
  pendingChunks = 0;
  hideUploadingOverlay();
});

// ===== UI FUNCTIONS =====
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

setTimeout(async () => {
  if (window.api.getUploadDebug) {
    const debug = await window.api.getUploadDebug();
    console.log("🔍 Debug Info:", debug);
  }
}, 5000);

// ===== EVENT LISTENERS =====
nextBtn.addEventListener('click', goToNextQuestion);
previousBtn.addEventListener('click', goToPreviousQuestion);

exit.addEventListener('click', async () => {
  const confirmExit = confirm('Are you sure you want to exit the exam? Your answers will be submitted.');
  if (confirmExit) {
    await submitExam();
    window.api.exitExam();
  }
});

submit.addEventListener('click', async () => {
  await submitExam();
});

// ===== CALCULATE OPTIMAL INTERVAL =====
function calculateOptimalInterval() {
  
  const actualBitrate = 256000;
  

  const secondsFor3MB = (MAX_CHUNK_SIZE * 8) / actualBitrate; 
  
  const optimalInterval = Math.min(secondsFor3MB, 15) * 1000; 
  
  console.log(`📊 Optimal interval: ${optimalInterval/1000}s for max 10MB chunks`);
  return Math.max(optimalInterval, 5000); 
}

// ===== IMPROVED RECORDING FUNCTIONS =====
async function startRecording() {
  try {
    console.log("🎥 Starting screen recording...");
    
    // Reset upload state before starting
    await window.api.resetUploadState();
    
    const sources = await window.api.getSources();
    const source = sources[0];
    console.log("🎯 Selected source:", source.id);

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
          minFrameRate: 15,     // منخفض للحصول على chunks أصغر
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

    // ===== IMPROVED CHUNK HANDLING WITH SIZE CONTROL =====
    mediaRecorder.ondataavailable = async (event) => {
      if (event.data && event.data.size > 0) {
      
        
        // Save for local recording
        recordingChunks.push(event.data);
        
        // Upload chunk immediately and asynchronously
        uploadChunkAsync(event.data);
        
        lastChunkTime = Date.now();
      }
    };

    mediaRecorder.onstop = async () => {
      console.log("🛑 Recording stopped, finalizing...");
      
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
        console.log(" Local recording saved");
      }
      
      // Signal that recording is finished
      window.api.finishUpload();
      console.log(" Upload finish signal sent");
    };

    mediaRecorder.onerror = (event) => {
      console.error(" MediaRecorder error:", event.error);
      showToast("Recording error occurred. Please restart the exam.");
    };

    const optimalInterval = calculateOptimalInterval();
    console.log(`🎯 Starting recording with ${optimalInterval/1000}s intervals for <10MB chunks`);
    
    mediaRecorder.start(optimalInterval);
    isRecording = true;
    
    console.log("✅ Recording started successfully");
    
    // Show recording status
    const recordingStatus = document.getElementById('recordingStatus');
    if (recordingStatus) {
      recordingStatus.style.display = 'block';
      recordingStatus.textContent = '🔴 Recording...';
      recordingStatus.style.color = '#ff4444';
    }

  } catch (err) {
    console.error("❌ Recording start failed:", err);
    showToast("❌ Screen recording permission denied. You cannot start the exam.");
    await new Promise(resolve => setTimeout(resolve, 2500));
    window.api.exitExam();
  }
}

// ===== ASYNC CHUNK UPLOAD WITH SIZE MONITORING =====
async function uploadChunkAsync(chunk) {
  try {
    pendingChunks++;
    const chunkSizeMB = (chunk.size / (1024 * 1024)).toFixed(2);
    
    // 🚀 CREATE CHUNK WITH HEADER AND METADATA
    const chunkWithHeader = await createChunkWithHeader(chunk);
    
    console.log(`📤 Uploading chunk ${chunkSizeMB}MB with header (${pendingChunks} pending)...`);
    
    if (chunkWithHeader.size > MAX_CHUNK_SIZE) {
      console.error(`🚨 CHUNK TOO LARGE: ${(chunkWithHeader.size / (1024 * 1024)).toFixed(2)}MB > 15MB limit`);
      showToast(`🚨 Chunk too large: ${(chunkWithHeader.size / (1024 * 1024)).toFixed(2)}MB`);
    }
    
    // Convert the enhanced chunk to buffer
    const arrayBuffer = await chunkWithHeader.arrayBuffer();
    const result = await window.api.uploadChunk(new Uint8Array(arrayBuffer));
    
    pendingChunks = Math.max(0, pendingChunks - 1);
    
    if (result.success) {
      console.log(`✅ Enhanced chunk uploaded successfully (${pendingChunks} remaining)`);
      updatePerformanceStats('uploaded', chunkWithHeader.size, true);
    } else {
      console.error("❌ Enhanced chunk upload failed:", result.message);
      updatePerformanceStats('uploaded', chunkWithHeader.size, false);
      
      if (result.finalAttempt) {
        showToast(`⚠️ Upload error: ${result.message}`);
      }
    }
  } catch (error) {
    pendingChunks = Math.max(0, pendingChunks - 1);
    console.error("❌ Enhanced chunk upload error:", error);
    showToast("⚠️ Network error during upload");
    updatePerformanceStats('uploaded', 0, false);
  }
}

// ===== STOP RECORDING =====
function stopRecording() {
  if (!isRecording) return;
  
  console.log("🛑 Stopping recording...");
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
async function createChunkWithHeader(videoChunk) {
  // 🎯 Generate unique chunk ID
  sequenceCounter++;
  const chunkId = `chunk_${Date.now()}_${sequenceCounter}`;
  
  // 📋 Create comprehensive header
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
  
  // 🔧 Convert header to binary format
  const headerJSON = JSON.stringify(chunkHeader);
  const headerBuffer = new TextEncoder().encode(headerJSON);
  
  // 📏 Create header size indicator (4 bytes)
  const headerSizeBuffer = new ArrayBuffer(4);
  const headerSizeView = new DataView(headerSizeBuffer);
  headerSizeView.setUint32(0, headerBuffer.length, false); // Big endian
  
  // 🎬 Get video data
  const videoBuffer = await videoChunk.arrayBuffer();
  
  // 🔗 Combine all parts: [HeaderSize][Header][VideoData]
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
  
  // 🎁 Create enhanced blob
  const enhancedBlob = new Blob([combinedBuffer], { 
    type: 'application/octet-stream' 
  });
  
  console.log(`📦 Enhanced chunk created:`, {
    chunkId,
    sequence: sequenceCounter,
    headerSize: headerBuffer.length,
    videoSize: videoBuffer.byteLength,
    totalSize: enhancedBlob.size,
    compression: ((videoChunk.size / enhancedBlob.size) * 100).toFixed(1) + '%'
  });
  
  return enhancedBlob;
}


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
    console.warn('⚠️ Checksum calculation failed:', error);
    return 'unknown';
  }
}

let headerStats = {
  totalHeadersCreated: 0,
  totalHeaderSize: 0,
  avgHeaderSize: 0,
  headerOverhead: 0
};
function updateHeaderStats(headerSize, totalChunkSize) {
  headerStats.totalHeadersCreated++;
  headerStats.totalHeaderSize += headerSize;
  headerStats.avgHeaderSize = headerStats.totalHeaderSize / headerStats.totalHeadersCreated;
  headerStats.headerOverhead = (headerStats.totalHeaderSize / totalChunkSize) * 100;
  
  // Log stats every 10 chunks
  if (headerStats.totalHeadersCreated % 10 === 0) {
    console.log(`📊 Header Statistics:`, {
      created: headerStats.totalHeadersCreated,
      avgSize: `${headerStats.avgHeaderSize.toFixed(0)} bytes`,
      totalOverhead: `${headerStats.headerOverhead.toFixed(2)}%`
    });
  }
}

// ===== IMPROVED SUBMIT FUNCTION =====
async function submitExam() {
  if (hasExited) return;
  console.log("📝 Starting exam submission...");

  // Check if recording is active
  if (!isRecording || !mediaRecorder || mediaRecorder.state !== 'recording') {
    console.warn("⚠️ Recording not active during submission");
    // Don't block submission, but warn
    showToast("⚠️ Warning: Recording may not be active");
  }

  saveAnswer();
  
  // Stop recording first
  stopRecording();
  
  // Show upload overlay if there are pending uploads
  if (pendingChunks > 0) {
    showUploadingOverlay();
    uploadInProgress = true;
    console.log(`⏳ Waiting for ${pendingChunks} pending uploads...`);
  }
  
  let waitCount = 0;
  const maxWait = 90; 
  
  while ((uploadInProgress || pendingChunks > 0) && waitCount < maxWait) {
    console.log(`⏳ Waiting for uploads... (${pendingChunks} pending, uploadInProgress: ${uploadInProgress})`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    waitCount++;
    
    // Update progress display
    const progressText = document.getElementById('uploadProgressText');
    if (progressText) {ش
      progressText.textContent = `Finalizing upload... ${waitCount}/${maxWait}s`;
    }
  }
  
  if (waitCount >= maxWait) {
    console.warn("⚠️ Upload timeout reached, proceeding with submission");
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

  console.log("📤 Submitting quiz answers...");
  const result = await window.api.submitQuiz(quizId, answersArray);

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

// ===== UI HELPER FUNCTIONS =====
function showUploadingOverlay() {
  if (uploadingOverlay) {
    uploadingOverlay.style.display = 'block';
    if (uploadProgress) {
      uploadProgress.value = 0;
    }
    console.log("📱 Upload overlay shown");
  }
}

function hideUploadingOverlay() {
  if (uploadingOverlay) {
    uploadingOverlay.style.display = 'none';
    console.log("📱 Upload overlay hidden");
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

// ===== MONITORING AND DEBUGGING WITH SIZE TRACKING =====
setInterval(() => {
  if (mediaRecorder) {
    console.log(`📊 Status - Recording: ${mediaRecorder.state}, Pending: ${pendingChunks}, Stream active: ${recordingStream ? 'Yes' : 'No'}`);
  }
  
  // Check if recording unexpectedly stopped
  if (isRecording && (!mediaRecorder || mediaRecorder.state !== 'recording')) {
    console.error('⚠️ Recording flag true but MediaRecorder not recording!');
    showToast('⚠️ Recording may have stopped unexpectedly');
  }
}, 15000); // Check every 15 seconds

// ===== IMPROVED ERROR HANDLING =====
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
});

// ===== CLEANUP ON PAGE UNLOAD =====
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

// ===== START EVERYTHING =====
document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 Exam page loaded, starting recording...");
  
  // Add small delay to ensure page is fully loaded
  setTimeout(() => {
    startRecording();
  }, 500);
});

// ===== NETWORK STATUS MONITORING =====
window.addEventListener('online', () => {
  console.log('📶 Network connection restored');
  showToast('✅ Network connection restored');
});

window.addEventListener('offline', () => {
  console.log('📵 Network connection lost');
  showToast('❌ Network connection lost - uploads may fail');
});


// ===== CHUNK SIZE MONITORING AND ALERTS =====
let chunkSizeAlerts = {
  warningThreshold: 2 * 1024 * 1024, 
  dangerThreshold: 2.5 * 1024 * 1024,  
  consecutiveWarnings: 0,
  lastAlertTime: 0
};

function analyzeChunkSize(chunkSize, timeTaken) {
  const chunkSizeMB = (chunkSize / (1024 * 1024)).toFixed(2);
  const now = Date.now();
  
  if (chunkSize > chunkSizeAlerts.dangerThreshold) {
    console.error(`🚨 DANGEROUS CHUNK SIZE: ${chunkSizeMB}MB`);
    
    if (now - chunkSizeAlerts.lastAlertTime > 30000) {
      showToast(`🚨 Recording chunks are too large: ${chunkSizeMB}MB. This may cause upload failures.`);
      chunkSizeAlerts.lastAlertTime = now;
    }
    
    chunkSizeAlerts.consecutiveWarnings++;
    
    if (chunkSizeAlerts.consecutiveWarnings >= 3) {
      showToast(" Multiple large chunks detected. Consider restarting the exam for better performance.");
      console.warn("Suggesting exam restart due to consistently large chunks");
    }
    
  } else if (chunkSize > chunkSizeAlerts.warningThreshold) {
    console.warn(` Large chunk: ${chunkSizeMB}MB`);
    chunkSizeAlerts.consecutiveWarnings++;
    
  } else {
    chunkSizeAlerts.consecutiveWarnings = 0;
    console.log(` Good chunk size: ${chunkSizeMB}MB in ${timeTaken}s`);
  }
  
  if (timeTaken > 10) {
    console.warn(`Slow chunk generation: ${timeTaken}s for ${chunkSizeMB}MB`);
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

mediaRecorder.ondataavailable = async (event) => {
  if (event.data && event.data.size > 0) {
    const timeTaken = (Date.now() - lastChunkTime) / 1000;
    
    // Analyze chunk before processing
    const analysis = analyzeChunkSize(event.data.size, timeTaken);
    
    console.log(`📦 Raw chunk ${analysis.rating.toUpperCase()}: ${analysis.sizeMB}MB in ${analysis.timeTaken.toFixed(1)}s`);
    
    // Update performance stats for generation
    updatePerformanceStats('generated', event.data.size);
    
    // Save original chunk for local backup
    recordingChunks.push(event.data);
    
    // 🚀 PROCESS WITH ENHANCED HEADERS
    if (analysis.isOversized) {
      console.warn(`🔪 Splitting oversized chunk: ${analysis.sizeMB}MB`);
      await splitAndUploadLargeChunk(event.data);
      
    } else {
      // Normal processing with header enhancement
      console.log(`📤 Processing chunk with enhanced header: ${analysis.sizeMB}MB`);
      await uploadChunkAsync(event.data);
    }
    
    lastChunkTime = Date.now();
    updateRecordingStats(analysis);
    
    // 📊 Log enhanced chunk statistics
    if (window.api.getChunkStats) {
      try {
        const stats = await window.api.getChunkStats();
        if (stats && stats.totalChunks % 5 === 0) {
          console.log(`📈 Enhanced Chunk Progress:`, {
            total: stats.totalChunks,
            withHeaders: stats.enhancedChunks || stats.totalChunks,
            avgEnhancedSize: stats.avgEnhancedSize || 'calculating...',
            headerEfficiency: stats.headerOverhead || 'calculating...'
          });
        }
      } catch (error) {
        // Stats not available - continue silently
      }
    }
  }
};

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

async function splitAndUploadLargeChunk(largeBlob) {
  const originalSizeMB = (largeBlob.size / 1024 / 1024).toFixed(2);
  console.log(`🔪 Splitting large chunk: ${originalSizeMB}MB`);
  
  const SAFE_CHUNK_SIZE = 2 * 1024 * 1024; // 2MB per part after header
  const totalParts = Math.ceil(largeBlob.size / SAFE_CHUNK_SIZE);
  
  console.log(`📊 Will create ${totalParts} parts from ${originalSizeMB}MB chunk`);
  
  for (let i = 0; i < totalParts; i++) {
    const start = i * SAFE_CHUNK_SIZE;
    const end = Math.min(start + SAFE_CHUNK_SIZE, largeBlob.size);
    const chunkPart = largeBlob.slice(start, end);
    
    const partSizeMB = (chunkPart.size / 1024 / 1024).toFixed(2);
    console.log(`📦 Processing split part ${i + 1}/${totalParts}: ${partSizeMB}MB`);
    
    // Each split part gets its own header
    recordingChunks.push(chunkPart);
    await uploadChunkAsync(chunkPart);
    
    // Small delay between parts
    if (i < totalParts - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  console.log(`✅ Successfully split and uploaded ${originalSizeMB}MB into ${totalParts} enhanced chunks`);
}

setInterval(async () => {
  if (mediaRecorder && isRecording) {
  
    
    if (window.api.getUploadStats) {
      try {
        const stats = await window.api.getUploadStats();
        
        if (parseFloat(stats.avgChunkSizeMB) > 6) {
          console.warn(`⚠️ High average chunk size detected: ${stats.avgChunkSizeMB}MB`);
        }
        
      } catch (error) {
        console.warn("📊 Could not fetch upload stats:", error.message);
      }
    }
  }
  
  if (isRecording && (!mediaRecorder || mediaRecorder.state !== 'recording')) {
    console.error(' Recording flag true but MediaRecorder not recording!');
    showToast(' Recording stopped unexpectedly - attempting restart...');
    
    try {
      await startRecording();
    } catch (error) {
      console.error('❌ Failed to restart recording:', error);
      showToast('❌ Could not restart recording. Please exit and re-enter the exam.');
    }
  }
}, 15000);

function showChunkSizeWarning(sizeMB) {
  const warningMessages = {
    high: ` Recording chunks are large (${sizeMB}MB). This is normal but may slow uploads.`,
    veryHigh: `Recording chunks are very large (${sizeMB}MB). Consider restarting if upload issues occur.`,
    critical: `Recording chunks are critically large (${sizeMB}MB). Upload may fail. Restart recommended.`
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

function handleOversizedChunk(chunkSize) {
  const sizeMB = (chunkSize / (1024 * 1024)).toFixed(2);
  
  console.error(`🚫 Chunk rejected: ${sizeMB}MB > 8MB limit`);
  
  // اقتراحات للمستخدم
  const suggestions = [
    " Try restarting the exam for better performance",
    " Check your internet connection stability", 
    "Close other applications to free up resources",
    " The system will automatically adjust recording quality"
  ];
  
  const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
  showToast(`${randomSuggestion}`);
  
  return false; 
}

// ===== Performance monitoring =====
let performanceStats = {
  startTime: Date.now(),
  chunksGenerated: 0,
  chunksUploaded: 0,
  chunksFailed: 0,
  totalDataGenerated: 0,
  totalDataUploaded: 0
};

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
  
  
  const elapsed = (Date.now() - performanceStats.startTime) / 1000;
  if (elapsed > 0 && elapsed % 60 < 1) { 
    const generatedMB = (performanceStats.totalDataGenerated / 1024 / 1024).toFixed(2);
    const uploadedMB = (performanceStats.totalDataUploaded / 1024 / 1024).toFixed(2);
    const successRate = performanceStats.chunksGenerated > 0 ? 
      ((performanceStats.chunksUploaded / performanceStats.chunksGenerated) * 100).toFixed(1) : 0;
    
    console.log(` Performance Summary (${elapsed.toFixed(0)}s):`);
    console.log(`   Generated: ${performanceStats.chunksGenerated} chunks (${generatedMB}MB)`);
    console.log(`   Uploaded: ${performanceStats.chunksUploaded} chunks (${uploadedMB}MB)`);
    console.log(`   Failed: ${performanceStats.chunksFailed} chunks`);
    console.log(`   Success rate: ${successRate}%`);
    console.log(`   Data efficiency: ${((parseFloat(uploadedMB) / parseFloat(generatedMB)) * 100).toFixed(1)}%`);
  }
}