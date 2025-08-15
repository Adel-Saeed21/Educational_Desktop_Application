// Global variables
let currentPage = 1
const itemsPerPage = 7
let globalResults = null
let currentQuizzes = []
let currentCourses = []

// Initialize the application
window.addEventListener("DOMContentLoaded", async () => {
  initializeApp()
})

async function initializeApp() {
  try {
    setupWindowControls()

    // Load username
    await loadUsername()

    // Initialize theme
    initializeTheme()

    // Setup event listeners
    setupEventListeners()

    // Load initial data
    await loadInitialData()

    // Check for login success message
    const justLoggedIn = await window.api.checkJustLoggedIn()
    if (justLoggedIn) {
      showSnackbar("Login successful!", "success")
    }
  } catch (error) {
    console.error("Error initializing app:", error)
    showSnackbar("Error loading application", "error")
  }
}

function setupWindowControls() {
  const minimizeBtn = document.getElementById("minimizeBtn")
  const maximizeBtn = document.getElementById("maximizeBtn")
  const closeBtn = document.getElementById("closeBtn")

  if (minimizeBtn) {
    minimizeBtn.addEventListener("click", () => {
      window.api.windowMinimize()
    })
  }

  if (maximizeBtn) {
    maximizeBtn.addEventListener("click", async () => {
      await window.api.windowMaximize()
      updateMaximizeButton()
    })
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      window.api.windowClose()
    })
  }

  // Update maximize button icon based on window state
  updateMaximizeButton()
}

async function updateMaximizeButton() {
  const maximizeBtn = document.getElementById("maximizeBtn")
  if (!maximizeBtn) return

  try {
    const isMaximized = await window.api.windowIsMaximized()
    const svg = maximizeBtn.querySelector("svg")

    if (isMaximized) {
      // Show restore icon
      svg.innerHTML = `
        <rect x="2" y="3" width="6" height="6" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M4 2h6v6" stroke="currentColor" stroke-width="1.5" fill="none"/>
      `
      maximizeBtn.title = "Restore"
    } else {
      // Show maximize icon
      svg.innerHTML = `
        <rect x="2" y="2" width="8" height="8" stroke="currentColor" stroke-width="1.5" fill="none"/>
      `
      maximizeBtn.title = "Maximize"
    }
  } catch (error) {
    console.error("Error updating maximize button:", error)
  }
}

// Load username
async function loadUsername() {
  try {
    const { currentUser } = await window.api.getUsername()
    document.getElementById("username").innerText = `Welcome, ${currentUser}`
  } catch (error) {
    console.error("Error loading username:", error)
    document.getElementById("username").innerText = "Welcome, User"
  }
}

// Initialize theme
function initializeTheme() {
  const themeToggle = document.getElementById("themeToggle")
  const currentTheme = localStorage.getItem("theme") || "dark"
  document.documentElement.setAttribute("data-theme", currentTheme)

  themeToggle.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme")
    const newTheme = currentTheme === "dark" ? "light" : "dark"
    document.documentElement.setAttribute("data-theme", newTheme)
    localStorage.setItem("theme", newTheme)
  })
}

// Setup all event listeners
function setupEventListeners() {
  // Navigation tabs
  setupTabNavigation()

  // Header buttons
  setupHeaderButtons()

  // Search and filter
  setupSearchAndFilter()

  // Modal
  setupModal()
}

// Setup tab navigation
function setupTabNavigation() {
  const tabs = document.querySelectorAll(".nav-tab")
  const contents = document.querySelectorAll(".tab-content")

  tabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      e.preventDefault()
      const targetTab = tab.getAttribute("data-tab")

      // Update active tab
      tabs.forEach((t) => t.classList.remove("active"))
      tab.classList.add("active")

      // Update active content
      contents.forEach((content) => {
        content.classList.remove("active")
        if (
          content.id === `${targetTab}Content` ||
          (targetTab === "current" && content.id === "currentContent") ||
          (targetTab === "courses" && content.id === "CoursesContent") ||
          (targetTab === "results" && content.id === "resultContent")
        ) {
          content.classList.add("active")
        }
      })

      // Load data for the selected tab
      loadTabData(targetTab)
    })
  })
}

// Setup header buttons
function setupHeaderButtons() {
  // Logout button
  const logoutBtn = document.getElementById("logoutBtn")
  logoutBtn.addEventListener("click", (e) => {
    e.preventDefault()
    showConfirmModal("Confirm Logout", "Are you sure you want to logout?", () => {
      try {
        window.api.logout()
      } catch (error) {
        console.error("Logout error:", error)
        showSnackbar("Error during logout", "error")
      }
    })
  })

  // Refresh button
  const refreshBtn = document.getElementById("refreshBtn")
  refreshBtn.addEventListener("click", async (e) => {
    e.preventDefault()
    await refreshCurrentTab()
    showSnackbar("Data refreshed", "success")
  })
}

// Setup search and filter functionality
function setupSearchAndFilter() {
  // Quiz search
  const quizSearchInput = document.getElementById("quizSearchInput")
  if (quizSearchInput) {
    quizSearchInput.addEventListener(
      "input",
      debounce(() => {
        filterQuizzes()
      }, 300),
    )
  }

  // Course search
  const courseSearchInput = document.getElementById("courseSearchInput")
  if (courseSearchInput) {
    courseSearchInput.addEventListener(
      "input",
      debounce(() => {
        filterCourses()
      }, 300),
    )
  }

  // Results search and filter
  const searchInput = document.getElementById("searchInput")
  const statusFilter = document.getElementById("statusFilter")

  if (searchInput) {
    searchInput.addEventListener(
      "input",
      debounce(() => {
        filterAndRenderResults()
      }, 300),
    )
  }

  if (statusFilter) {
    statusFilter.addEventListener("change", () => {
      filterAndRenderResults()
    })
  }
}

// Setup modal functionality
function setupModal() {
  const modal = document.getElementById("confirmModal")
  const modalClose = document.getElementById("modalClose")
  const modalCancel = document.getElementById("modalCancel")
  ;[modalClose, modalCancel].forEach((btn) => {
    if (btn) {
      btn.addEventListener("click", () => {
        hideModal()
      })
    }
  })

  // Close modal on backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      hideModal()
    }
  })
}

// Load initial data
async function loadInitialData() {
  await loadTabData("current")
}

// Load data for specific tab
async function loadTabData(tab) {
  switch (tab) {
    case "current":
      await getCurrentQuizzes()
      break
    case "courses":
      await getCourseList()
      break
    case "results":
      await showStaticSubmissions()
      break
  }
}

// Refresh current active tab
async function refreshCurrentTab() {
  const activeTab = document.querySelector(".nav-tab.active")
  if (activeTab) {
    const tabType = activeTab.getAttribute("data-tab")
    await loadTabData(tabType)
  }
}

// Get current quizzes
async function getCurrentQuizzes() {
  const container = document.getElementById("StartExam")
  showLoadingState(container)

  try {
    const response = await window.api.getCurrentQuizes()

    if (response.success) {
      currentQuizzes = response.quizes || []
      renderCurrentQuizzes(currentQuizzes)

      // Setup real-time updates
      window.api.startQuizzesStream()
      window.api.onCurrentQuizzesUpdate((quizzes) => {
        currentQuizzes = quizzes
        renderCurrentQuizzes(currentQuizzes)
      })
    } else {
      showEmptyState(container, "No Quizzes Available", response.message || "You don't have any quizzes at the moment.")
    }
  } catch (error) {
    console.error("Error loading quizzes:", error)
    showErrorState(container, "Failed to load quizzes")
  }
}

// Render current quizzes
function renderCurrentQuizzes(quizzes) {
  const container = document.getElementById("StartExam")

  if (!quizzes || quizzes.length === 0) {
    showEmptyState(container, "No Quizzes Available", "You don't have any quizzes at the moment.")
    return
  }

  container.innerHTML = ""

  quizzes.forEach((quiz) => {
    const quizCard = createQuizCard(quiz)
    container.appendChild(quizCard)
  })
}

// Create quiz card element
function createQuizCard(quiz) {
  const card = document.createElement("div")
  card.className = "quiz-card"

  const isSubmitted = quiz.submitted

  card.innerHTML = `
        <div class="quiz-status ${isSubmitted ? "completed" : ""}"></div>
        <h3 class="quiz-title">${escapeHtml(quiz.title)}</h3>
        <div class="quiz-meta">
            <div class="quiz-meta-item">
                <svg class="quiz-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12,6 12,12 16,14"></polyline>
                </svg>
                <span><strong>Duration:</strong> ${quiz.duration} minutes</span>
            </div>
            <div class="quiz-meta-item">
                <svg class="quiz-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                </svg>
                <span><strong>Points:</strong> ${quiz.total_points}</span>
            </div>
        </div>
        <div class="quiz-actions">
            <button class="btn ${isSubmitted ? "btn-secondary" : "btn-primary"} start-exam-btn" 
                    data-id="${quiz.id}" 
                    ${isSubmitted ? "disabled" : ""}>
                ${isSubmitted ? "Submitted" : "Start Exam"}
            </button>
        </div>
    `

  // Add event listener to start exam button
  const startBtn = card.querySelector(".start-exam-btn")
  startBtn.addEventListener("click", (e) => {
    e.preventDefault()
    if (!isSubmitted) {
      startExam(quiz.id, startBtn)
    }
  })

  return card
}

// Start exam
async function startExam(examId, button) {
  const originalText = button.textContent
  button.disabled = true
  button.textContent = "Starting..."

  try {
    const response = await window.api.startEXam(examId)

    if (response.success) {
      showSnackbar(`Exam started successfully!`, "success")

      // Update the quiz card to show as submitted
      const card = button.closest(".quiz-card")
      const statusIndicator = card.querySelector(".quiz-status")
      statusIndicator.classList.add("completed")

      button.textContent = "Submitted"
      button.classList.remove("btn-primary")
      button.classList.add("btn-secondary")
    } else {
      showSnackbar("Failed to start exam", "error")
      button.disabled = false
      button.textContent = originalText
    }
  } catch (error) {
    console.error("Error starting exam:", error)
    showSnackbar("Something went wrong!", "error")
    button.disabled = false
    button.textContent = originalText
  }
}

// Get course list
async function getCourseList() {
  const container = document.getElementById("courseList")
  showLoadingState(container)

  try {
    const response = await window.api.getCourseList()

    if (response.success) {
      currentCourses = response.courses || []
      renderCourses(currentCourses)
    } else {
      showEmptyState(container, "No Courses Available", response.message || "You don't have any courses at the moment.")
    }
  } catch (error) {
    console.error("Error loading courses:", error)
    showErrorState(container, "Failed to load courses")
  }
}

// Render courses
function renderCourses(courses) {
  const container = document.getElementById("courseList")

  if (!courses || courses.length === 0) {
    showEmptyState(container, "No Courses Available", "You don't have any courses at the moment.")
    return
  }

  container.innerHTML = ""

  courses.forEach((course) => {
    const courseCard = createCourseCard(course)
    container.appendChild(courseCard)
  })
}

// Create course card element
function createCourseCard(course) {
  const card = document.createElement("div")
  card.className = "course-card"

  card.innerHTML = `
        <h3 class="quiz-title">${escapeHtml(course.name)}</h3>
        <div class="quiz-meta">
            <div class="quiz-meta-item">
                <svg class="quiz-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                </svg>
                <span><strong>Level:</strong> ${escapeHtml(course.level)}</span>
            </div>
        </div>
        <div class="quiz-actions">
            <button class="btn btn-success show-feedback-btn" data-id="${course.id}">
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z"/>
                    <path d="M19 7h-4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                </svg>
                View Course Statistics
            </button>
        </div>
    `

  // Add event listener to show feedback button
  const feedbackBtn = card.querySelector(".show-feedback-btn")
  feedbackBtn.addEventListener("click", (e) => {
    e.preventDefault()
    showCourseFeedback(course.id, feedbackBtn)
  })

  return card
}

async function showCourseFeedback(courseId, button) {
  const originalText = button.innerHTML
  button.disabled = true
  button.innerHTML = `
    <svg class="btn-icon spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12a9 9 0 11-6.219-8.56"/>
    </svg>
    Loading Statistics...
  `

  try {
    const response = await window.api.showCourseStatistics(courseId)

    if (response.success) {
      showSnackbar("Course statistics opened successfully!", "success")
    } else {
      showSnackbar("Failed to load course statistics", "error")
    }
  } catch (error) {
    console.error("Error showing course statistics:", error)
    showSnackbar("Something went wrong while loading statistics!", "error")
  } finally {
    button.disabled = false
    button.innerHTML = originalText
  }
}

// Show static submissions (results)
async function showStaticSubmissions(page = 1, results = globalResults) {
  const container = document.getElementById("submissionTableContainer")

  if (!results) {
    showLoadingState(container)

    try {
      const response = await window.api.getResult()

      if (Array.isArray(response.results)) {
        globalResults = response.results

        // Setup real-time updates
        window.api.startResultsStream()
        window.api.onResultsUpdate((results) => {
          globalResults = results
          filterAndRenderResults()
        })

        filterAndRenderResults()
      } else {
        showEmptyState(container, "No Results Available", "You don't have any quiz results yet.")
      }
    } catch (error) {
      console.error("Error loading results:", error)
      showErrorState(container, "Failed to load results")
    }
    return
  }

  renderResultsTable(results, page)
}

// Render results table
function renderResultsTable(results, page) {
  const container = document.getElementById("submissionTableContainer")
  currentPage = page

  if (!results || results.length === 0) {
    showEmptyState(container, "No Results Found", "No results match your current filters.")
    return
  }

  const startIndex = (page - 1) * itemsPerPage
  const paginatedResults = results.slice(startIndex, startIndex + itemsPerPage)
  const totalPages = Math.ceil(results.length / itemsPerPage)

  let html = `
        <table class="results-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Quiz Title</th>
                    <th>Status</th>
                    <th>Grade</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
    `

  paginatedResults.forEach((submission, index) => {
    const actualIndex = startIndex + index
    const grade = submission.grade !== null ? submission.grade : "—"
    const gradeClass = getGradeClass(submission.grade)

    html += `
            <tr>
                <td>${actualIndex + 1}</td>
                <td>${escapeHtml(submission.quiz_title)}</td>
                <td><span class="status-badge ${submission.status.toLowerCase()}">${submission.status}</span></td>
                <td><span class="grade-display ${gradeClass}">${grade}</span></td>
                <td>
                    <button class="btn btn-secondary view-details-btn" 
                            data-index="${actualIndex}" 
                            data-status="${submission.status}">
                        View Details
                    </button>
                </td>
            </tr>
        `
  })

  html += `</tbody></table>`

  // Add pagination
  if (totalPages > 1) {
    html += `
            <div class="pagination-controls">
                <button id="prevPage" ${page <= 1 ? "disabled" : ""}>Previous</button>
                <span class="pagination-info">Page ${page} of ${totalPages}</span>
                <button id="nextPage" ${page >= totalPages ? "disabled" : ""}>Next</button>
            </div>
        `
  }

  container.innerHTML = html

  // Add event listeners
  setupResultsEventListeners(results, page, totalPages)
}

// Setup results event listeners
function setupResultsEventListeners(results, page, totalPages) {
  // View details buttons
  document.querySelectorAll(".view-details-btn").forEach((button) => {
    button.addEventListener("click", (e) => {
      const index = Number.parseInt(e.target.getAttribute("data-index"))
      const status = e.target.getAttribute("data-status")

      if (status.toLowerCase() === "released") {
        localStorage.setItem("selectedSubmissionIndex", index.toString())
        window.api.navigateToDetails()
      } else {
        showSnackbar("This quiz has not been released yet.", "warning")
      }
    })
  })

  // Pagination buttons
  const prevBtn = document.getElementById("prevPage")
  const nextBtn = document.getElementById("nextPage")

  if (prevBtn && page > 1) {
    prevBtn.addEventListener("click", () => {
      showStaticSubmissions(page - 1, results)
    })
  }

  if (nextBtn && page < totalPages) {
    nextBtn.addEventListener("click", () => {
      showStaticSubmissions(page + 1, results)
    })
  }
}

// Filter functions
function filterQuizzes() {
  const searchTerm = document.getElementById("quizSearchInput").value.toLowerCase()
  const filtered = currentQuizzes.filter((quiz) => quiz.title.toLowerCase().includes(searchTerm))
  renderCurrentQuizzes(filtered)
}

function filterCourses() {
  const searchTerm = document.getElementById("courseSearchInput").value.toLowerCase()
  const filtered = currentCourses.filter(
    (course) => course.name.toLowerCase().includes(searchTerm) || course.level.toLowerCase().includes(searchTerm),
  )
  renderCourses(filtered)
}

function filterAndRenderResults() {
  const searchTerm = document.getElementById("searchInput")?.value.toLowerCase() || ""
  const selectedStatus = document.getElementById("statusFilter")?.value || ""

  if (!Array.isArray(globalResults)) return

  const filtered = globalResults.filter((sub) => {
    const matchesTitle = sub.quiz_title.toLowerCase().includes(searchTerm)
    const matchesStatus = selectedStatus ? sub.status.toLowerCase() === selectedStatus : true
    return matchesTitle && matchesStatus
  })

  showStaticSubmissions(1, filtered)
}

// Utility functions
function showLoadingState(container) {
  container.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading...</p>
        </div>
    `
}

function showEmptyState(container, title, message) {
  container.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            </div>
            <h3>${title}</h3>
            <p>${message}</p>
        </div>
    `
}

function showErrorState(container, message) {
  container.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </div>
            <h3>Error</h3>
            <p>${message}</p>
            <button class="btn btn-primary" onclick="location.reload()">Retry</button>
        </div>
    `
}

function showSnackbar(message, type = "success") {
  const snackbar = document.getElementById("snackbar")
  const messageEl = snackbar.querySelector(".snackbar-message")
  const iconEl = snackbar.querySelector(".snackbar-icon")

  messageEl.textContent = message

  // Update icon based on type
  let iconSvg = ""
  switch (type) {
    case "success":
      iconSvg = '<polyline points="20 6 9 17 4 12"></polyline>'
      break
    case "error":
      iconSvg = '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>'
      break
    case "warning":
      iconSvg = '<line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'
      break
    default:
      iconSvg = '<polyline points="20 6 9 17 4 12"></polyline>'
  }

  iconEl.innerHTML = iconSvg
  snackbar.classList.add("show")

  setTimeout(() => {
    snackbar.classList.remove("show")
  }, 3000)
}

function showConfirmModal(title, message, onConfirm) {
  const modal = document.getElementById("confirmModal")
  const titleEl = document.getElementById("modalTitle")
  const messageEl = document.getElementById("modalMessage")
  const confirmBtn = document.getElementById("modalConfirm")

  titleEl.textContent = title
  messageEl.textContent = message

  // Remove existing listeners
  const newConfirmBtn = confirmBtn.cloneNode(true)
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn)

  // Add new listener
  newConfirmBtn.addEventListener("click", () => {
    hideModal()
    onConfirm()
  })

  modal.classList.add("show")
}

function hideModal() {
  const modal = document.getElementById("confirmModal")
  modal.classList.remove("show")
}

function getGradeClass(grade) {
  if (grade === null || grade === undefined) return ""
  const numGrade = Number.parseFloat(grade)
  if (numGrade >= 80) return "high"
  if (numGrade >= 60) return "medium"
  return "low"
}

function escapeHtml(text) {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}

function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}
