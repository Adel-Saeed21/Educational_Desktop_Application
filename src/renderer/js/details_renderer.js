document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("answersContainer")
  const loadingOverlay = document.getElementById("loadingOverlay")
  const emptyState = document.getElementById("emptyState")

  // Summary elements
  const totalQuestionsEl = document.getElementById("totalQuestions")
  const totalPointsEl = document.getElementById("totalPoints")
  const finalScoreEl = document.getElementById("finalScore")

  // Show loading
  if (loadingOverlay) {
    loadingOverlay.style.display = "flex"
  }

  try {
    const index = localStorage.getItem("selectedSubmissionIndex")
    if (!index) {
      throw new Error("No submission selected")
    }

    const submissionIndex = Number(index)
    if (isNaN(submissionIndex) || submissionIndex < 0) {
      throw new Error("Invalid submission index")
    }

    // Get the detailed answers
    const answers = await window.api.getResultSolutions(submissionIndex)

    if (!answers || answers.length === 0) {
      showEmptyState()
      return
    }

    // Calculate summary statistics
    const totalQuestions = answers.length
    const totalPoints = answers.reduce((sum, answer) => sum + (answer.max_points || answer.points || 0), 0)
    const earnedPoints = answers.reduce((sum, answer) => sum + (answer.points || 0), 0)
    const finalScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0

    // Update summary display
    if (totalQuestionsEl) totalQuestionsEl.textContent = totalQuestions
    if (totalPointsEl) totalPointsEl.textContent = `${earnedPoints}/${totalPoints}`
    if (finalScoreEl) finalScoreEl.textContent = `${finalScore}%`

    // Clear container and populate answers
    container.innerHTML = ""

    answers.forEach((answer, index) => {
      const card = document.createElement("div")
      card.className = "answer-card"

      // Handle null/undefined values properly
      const questionText = answer.question_text || `Question ${index + 1}`
      const answerText = answer.answer_text || "No answer provided"
      const points = answer.points !== undefined ? answer.points : 0
      const maxPoints = answer.max_points || points || 1
      const feedback = answer.feedback || "No feedback available"

      // Determine score status
      const scorePercentage = maxPoints > 0 ? (points / maxPoints) * 100 : 0
      let scoreClass = "score-low"
      if (scorePercentage >= 80) scoreClass = "score-high"
      else if (scorePercentage >= 60) scoreClass = "score-medium"

      card.innerHTML = `
        <div class="question-header">
          <h4 class="question-title">${questionText}</h4>
          <div class="question-score ${scoreClass}">
            <span class="score-text">${points}/${maxPoints}</span>
            <span class="score-percentage">${Math.round(scorePercentage)}%</span>
          </div>
        </div>
        
        <div class="answer-content">
          <div class="answer-section">
            <label class="section-label">Your Answer:</label>
            <div class="answer-text">${answerText}</div>
          </div>
          
          <div class="feedback-section">
            <label class="section-label">Feedback:</label>
            <div class="feedback-text ${feedback === "No feedback available" ? "no-feedback" : ""}">${feedback}</div>
          </div>
        </div>
      `

      container.appendChild(card)
    })
  } catch (error) {
    console.error("Error loading answer details:", error)
    showErrorState(error.message)
  } finally {
    // Hide loading
    if (loadingOverlay) {
      loadingOverlay.style.display = "none"
    }
  }

  // Helper functions
  function showEmptyState() {
    container.style.display = "none"
    if (emptyState) {
      emptyState.style.display = "flex"
    }

    // Reset summary to show no data
    if (totalQuestionsEl) totalQuestionsEl.textContent = "0"
    if (totalPointsEl) totalPointsEl.textContent = "0/0"
    if (finalScoreEl) finalScoreEl.textContent = "0%"
  }

  function showErrorState(message) {
    container.innerHTML = `
      <div class="error-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <h4>Error Loading Results</h4>
        <p>${message}</p>
        <button onclick="location.reload()" class="retry-btn">Try Again</button>
      </div>
    `

    // Reset summary to show error state
    if (totalQuestionsEl) totalQuestionsEl.textContent = "--"
    if (totalPointsEl) totalPointsEl.textContent = "--"
    if (finalScoreEl) finalScoreEl.textContent = "--%"
  }

  const exitResultBtn = document.getElementById("exitResultBtn")
  //const exportBtn = document.getElementById("exportBtn")

  if (exitResultBtn) {
    exitResultBtn.addEventListener("click", () => {
      window.location.href = "home.html"
    })
  }

  // if (exportBtn) {
  //   exportBtn.addEventListener("click", async () => {
  //     try {
  //       const index = localStorage.getItem("selectedSubmissionIndex")
  //       if (index) {
  //         await window.api.exportResults(Number(index))
  //         showNotification("Results exported successfully!", "success")
  //       }
  //     } catch (error) {
  //       console.error("Export error:", error)
  //       showNotification("Failed to export results", "error")
  //     }
  //   })
  // }

  // Notification function
  function showNotification(message, type = "info") {
    const notification = document.createElement("div")
    notification.className = `notification notification-${type}`
    notification.textContent = message

    document.body.appendChild(notification)

    // Trigger animation
    setTimeout(() => notification.classList.add("show"), 100)

    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.remove("show")
      setTimeout(() => document.body.removeChild(notification), 300)
    }, 3000)
  }
})
