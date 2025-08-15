document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("answersContainer")
  const loadingOverlay = document.getElementById("loadingOverlay")
  const emptyState = document.getElementById("emptyState")

  // Summary elements
  const totalQuestionsEl = document.getElementById("totalQuestions")
  const totalPointsEl = document.getElementById("totalPoints")
  const finalScoreEl = document.getElementById("finalScore")

  const classRankEl = document.getElementById("classRank")
  const totalParticipantsEl = document.getElementById("totalParticipants")
  const rankingBadgeEl = document.getElementById("rankingBadge")
  const correctCountEl = document.getElementById("correctCount")
  const incorrectCountEl = document.getElementById("incorrectCount")
  const accuracyProgressEl = document.getElementById("accuracyProgress")
  const submissionDateEl = document.getElementById("submissionDate")
  const gradedDateEl = document.getElementById("gradedDate")
  const submissionStatusEl = document.getElementById("submissionStatus")
  const instructorFeedbackEl = document.getElementById("instructorFeedback")
  const instructorFeedbackSection = document.getElementById("instructorFeedbackSection")

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

    const quizId = await window.api.getResultQuizId(submissionIndex)
    if (!quizId) {
      throw new Error("Quiz ID not found")
    }

    const quizDetailsResponse = await window.api.getQuizDetails(quizId)
    if (!quizDetailsResponse.success) {
      throw new Error(quizDetailsResponse.message || "Failed to get quiz details")
    }

    const submission = quizDetailsResponse.results
    if (!submission) {
      throw new Error("Invalid submission data format")
    }

    const questions = submission.questions || []
    const quizSummary = submission.quiz_summary || {}

    // Calculate summary statistics
    const totalQuestions = questions.length
    const totalPoints = quizSummary.max_total_points || 0
    const earnedPoints = quizSummary.earned_total_points || 0
    const finalScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0

    // Update summary display
    if (totalQuestionsEl) totalQuestionsEl.textContent = totalQuestions
    if (totalPointsEl) totalPointsEl.textContent = `${earnedPoints}/${totalPoints}`
    if (finalScoreEl) finalScoreEl.textContent = `${finalScore}%`

    updatePerformanceStats(submission)

    updateInstructorFeedback(submission)

    // Clear container and populate questions
    container.innerHTML = ""

    questions.forEach((question, index) => {
      const card = document.createElement("div")
      card.className = "answer-card"

      // Handle null/undefined values properly
      const questionText = question.question_text || `Question ${index + 1}`
      const answerText = question.answer_text || "No answer provided"
      const points = question.earned_points
      const maxPoints = question.max_points
      const feedback = question.feedback || "No feedback available"

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

    // Handle empty state
    if (questions.length === 0) {
      showEmptyState()
    }
  } catch (error) {
    console.error("Error loading answer details:", error)
    showErrorState(error.message)
  } finally {
    // Hide loading
    if (loadingOverlay) {
      loadingOverlay.style.display = "none"
    }
  }

  function updatePerformanceStats(submission) {
    // Update ranking information
    if (classRankEl && submission.rank_in_quiz) {
      classRankEl.textContent = submission.rank_in_quiz
    }
    if (totalParticipantsEl && submission.total_participants) {
      totalParticipantsEl.textContent = submission.total_participants
    }

    // Update ranking badge
    if (rankingBadgeEl && submission.rank_in_quiz && submission.total_participants) {
      const rank = submission.rank_in_quiz
      const total = submission.total_participants
      const percentile = Math.round(((total - rank + 1) / total) * 100)

      let badgeText = `${percentile}th percentile`
      let badgeClass = "percentile-low"

      if (percentile >= 90) {
        badgeText = "Top 10%"
        badgeClass = "percentile-high"
      } else if (percentile >= 75) {
        badgeText = "Top 25%"
        badgeClass = "percentile-medium"
      } else if (percentile >= 50) {
        badgeText = "Top 50%"
        badgeClass = "percentile-medium"
      }

      rankingBadgeEl.textContent = badgeText
      rankingBadgeEl.className = `ranking-badge ${badgeClass}`
    }

    // Update accuracy statistics
    if (correctCountEl && submission.correct_count !== undefined) {
      correctCountEl.textContent = submission.correct_count
    }
    if (incorrectCountEl && submission.incorrect_count !== undefined) {
      incorrectCountEl.textContent = submission.incorrect_count
    }

    // Update accuracy progress bar
    if (accuracyProgressEl && submission.correct_count !== undefined && submission.incorrect_count !== undefined) {
      const total = submission.correct_count + submission.incorrect_count
      const accuracy = total > 0 ? (submission.correct_count / total) * 100 : 0
      accuracyProgressEl.style.width = `${accuracy}%`
    }

    // Update submission dates
    if (submissionDateEl && submission.submission_date) {
      const date = new Date(submission.submission_date)
      submissionDateEl.textContent = date.toLocaleDateString() + " " + date.toLocaleTimeString()
    }
    if (gradedDateEl && submission.graded_at) {
      const date = new Date(submission.graded_at)
      gradedDateEl.textContent = date.toLocaleDateString() + " " + date.toLocaleTimeString()
    }

    // Update submission status
    if (submissionStatusEl && submission.status) {
      const status = submission.status
      const statusText = status.charAt(0).toUpperCase() + status.slice(1)
      let statusClass = "status-default"

      if (status === "released") {
        statusClass = "status-released"
      } else if (status === "submitted") {
        statusClass = "status-submitted"
      }

      submissionStatusEl.textContent = statusText
      submissionStatusEl.className = `status-badge ${statusClass}`
    }
  }

  function updateInstructorFeedback(submission) {
    if (submission.instructor_feedback && submission.instructor_feedback.trim()) {
      if (instructorFeedbackEl) {
        instructorFeedbackEl.textContent = submission.instructor_feedback
      }
      if (instructorFeedbackSection) {
        instructorFeedbackSection.style.display = "block"
      }
    } else {
      if (instructorFeedbackSection) {
        instructorFeedbackSection.style.display = "none"
      }
    }
  }

  // Helper functions
  function showEmptyState() {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <h4>No Questions Found</h4>
        <p>This quiz submission doesn't contain any questions.</p>
      </div>
    `

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

  if (exitResultBtn) {
    exitResultBtn.addEventListener("click", () => {
      window.location.href = "home.html"
    })
  }

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
