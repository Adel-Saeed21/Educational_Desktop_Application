// Global variables
let currentStep = 1
let otpTimer = null
let otpTimeLeft = 300 // 5 minutes
let userEmail = ""

// Initialize the application
window.addEventListener("DOMContentLoaded", () => {
  initializeApp()
})

function initializeApp() {
  // Initialize theme
  initializeTheme()

  // Setup event listeners
  setupEventListeners()

  // Initialize first step
  showStep(1)
}

// Initialize theme
function initializeTheme() {
  const themeToggle = document.getElementById("themeToggle")
  const currentTheme = localStorage.getItem("theme") || "dark"
  document.documentElement.setAttribute("data-theme", currentTheme)

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme")
      const newTheme = currentTheme === "dark" ? "light" : "dark"
      document.documentElement.setAttribute("data-theme", newTheme)
      localStorage.setItem("theme", newTheme)
    })
  }
}

// Setup all event listeners
function setupEventListeners() {
  // Back to login button
  const backBtn = document.getElementById("backToLogin")
  if (backBtn) {
    backBtn.addEventListener("click", (e) => {
      e.preventDefault()
      window.api.navigateToLogin()
    })
  }

  // Step 1: Email form
  const emailForm = document.getElementById("emailForm")
  if (emailForm) {
    emailForm.addEventListener("submit", handleEmailSubmit)
  }

  // Step 2: OTP form
  const otpForm = document.getElementById("otpForm")
  if (otpForm) {
    otpForm.addEventListener("submit", handleOtpSubmit)
  }

  // Step 3: Password reset form
  const passwordForm = document.getElementById("passwordForm")
  if (passwordForm) {
    passwordForm.addEventListener("submit", handlePasswordSubmit)
  }

  // Resend OTP button
  const resendBtn = document.getElementById("resendOtp")
  if (resendBtn) {
    resendBtn.addEventListener("click", handleResendOtp)
  }

  // OTP input handling
  setupOtpInputs()

  // Password visibility toggles
  setupPasswordToggles()
}

// Setup OTP inputs with auto-focus and validation
function setupOtpInputs() {
  const otpInputs = document.querySelectorAll(".otp-input")

  otpInputs.forEach((input, index) => {
    // Handle input
    input.addEventListener("input", (e) => {
      const value = e.target.value

      // Only allow digits
      if (!/^\d$/.test(value)) {
        e.target.value = ""
        return
      }

      // Move to next input
      if (value && index < otpInputs.length - 1) {
        otpInputs[index + 1].focus()
      }

      // Check if all inputs are filled
      checkOtpComplete()
    })

    // Handle backspace
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !e.target.value && index > 0) {
        otpInputs[index - 1].focus()
      }
    })

    // Handle paste
    input.addEventListener("paste", (e) => {
      e.preventDefault()
      const pastedData = e.clipboardData.getData("text").replace(/\D/g, "")

      if (pastedData.length === 7) {
        otpInputs.forEach((inp, idx) => {
          inp.value = pastedData[idx] || ""
        })
        checkOtpComplete()
      }
    })
  })
}

// Setup password visibility toggles
function setupPasswordToggles() {
  const toggles = document.querySelectorAll(".password-toggle")

  toggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const input = toggle.previousElementSibling
      const isPassword = input.type === "password"

      input.type = isPassword ? "text" : "password"
      toggle.innerHTML = isPassword
        ? '<img src="../assets/hide_password.png" alt="Hide" width="20" height="20">'
        : '<img src="../assets/view_password.png" alt="Show" width="20" height="20">'
    })
  })
}

// Handle email form submission
async function handleEmailSubmit(e) {
  e.preventDefault()

  const emailInput = document.getElementById("email")
  const submitBtn = document.getElementById("emailSubmitBtn")
  const errorMsg = document.getElementById("emailError")

  const email = emailInput.value.trim()

  // Validate email
  if (!email) {
    showError(errorMsg, "Please enter your email address")
    return
  }

  if (!isValidEmail(email)) {
    showError(errorMsg, "Please enter a valid email address")
    return
  }

  // Clear previous errors
  hideError(errorMsg)

  // Show loading state
  const originalText = submitBtn.textContent
  submitBtn.disabled = true
  submitBtn.textContent = "Sending..."

  try {
    const response = await window.api.requestPasswordReset(email)

    if (response.success) {
      userEmail = email
      showStep(2)
      startOtpTimer()
      showSnackbar("OTP sent to your email successfully!", "success")
    } else {
      showError(errorMsg, response.message || "Failed to send reset email")
    }
  } catch (error) {
    console.error("Error requesting password reset:", error)
    showError(errorMsg, "Something went wrong. Please try again.")
  } finally {
    submitBtn.disabled = false
    submitBtn.textContent = originalText
  }
}

// Handle OTP form submission
async function handleOtpSubmit(e) {
  e.preventDefault()

  const submitBtn = document.getElementById("otpSubmitBtn")
  const errorMsg = document.getElementById("otpError")

  const otp = getOtpValue()

  // Validate OTP
  if (otp.length !== 7) {
    showError(errorMsg, "Please enter the complete 7-digit OTP")
    return
  }

  // Clear previous errors
  hideError(errorMsg)

  // Show loading state
  const originalText = submitBtn.textContent
  submitBtn.disabled = true
  submitBtn.textContent = "Verifying..."

  try {
    const response = await window.api.verifyOtp(userEmail, otp)

    if (response.success) {
      stopOtpTimer()
      showStep(3)
      showSnackbar("OTP verified successfully!", "success")
    } else {
      showError(errorMsg, response.message || "Invalid OTP. Please try again.")
      clearOtpInputs()
    }
  } catch (error) {
    console.error("Error verifying OTP:", error)
    showError(errorMsg, "Something went wrong. Please try again.")
    clearOtpInputs()
  } finally {
    submitBtn.disabled = false
    submitBtn.textContent = originalText
  }
}

// Handle password reset form submission
async function handlePasswordSubmit(e) {
  e.preventDefault()

  const newPasswordInput = document.getElementById("newPassword")
  const confirmPasswordInput = document.getElementById("confirmPassword")
  const submitBtn = document.getElementById("passwordSubmitBtn")
  const errorMsg = document.getElementById("passwordError")

  const newPassword = newPasswordInput.value
  const confirmPassword = confirmPasswordInput.value

  // Validate passwords
  if (!newPassword) {
    showError(errorMsg, "Please enter a new password")
    return
  }

  if (newPassword.length < 8) {
    showError(errorMsg, "Password must be at least 8 characters long")
    return
  }

  if (newPassword !== confirmPassword) {
    showError(errorMsg, "Passwords do not match")
    return
  }

  // Clear previous errors
  hideError(errorMsg)

  // Show loading state
  const originalText = submitBtn.textContent
  submitBtn.disabled = true
  submitBtn.textContent = "Resetting..."

  try {
    const response = await window.api.resetPassword(userEmail, newPassword)

    if (response.success) {
      showSnackbar("Password reset successfully!", "success")
      setTimeout(() => {
        window.api.navigateToLogin()
      }, 2000)
    } else {
      showError(errorMsg, response.message || "Failed to reset password")
    }
  } catch (error) {
    console.error("Error resetting password:", error)
    showError(errorMsg, "Something went wrong. Please try again.")
  } finally {
    submitBtn.disabled = false
    submitBtn.textContent = originalText
  }
}

// Handle resend OTP
async function handleResendOtp(e) {
  e.preventDefault()

  const resendBtn = document.getElementById("resendOtp")
  const originalText = resendBtn.textContent

  resendBtn.disabled = true
  resendBtn.textContent = "Sending..."

  try {
    const response = await window.api.requestPasswordReset(userEmail)

    if (response.success) {
      clearOtpInputs()
      startOtpTimer()
      showSnackbar("New OTP sent successfully!", "success")
    } else {
      showSnackbar("Failed to resend OTP", "error")
    }
  } catch (error) {
    console.error("Error resending OTP:", error)
    showSnackbar("Something went wrong. Please try again.", "error")
  } finally {
    resendBtn.disabled = false
    resendBtn.textContent = originalText
  }
}

// Show specific step
function showStep(step) {
  // Hide all steps
  document.querySelectorAll(".step").forEach((stepEl) => {
    stepEl.classList.remove("active")
  })

  // Show current step
  const currentStepEl = document.getElementById(`step${step}`)
  if (currentStepEl) {
    currentStepEl.classList.add("active")
  }

  // Update progress indicator
  updateProgressIndicator(step)

  currentStep = step

  // Focus on first input of current step
  setTimeout(() => {
    const firstInput = currentStepEl?.querySelector("input")
    if (firstInput) {
      firstInput.focus()
    }
  }, 100)
}

// Update progress indicator
function updateProgressIndicator(step) {
  const indicators = document.querySelectorAll(".progress-step")

  indicators.forEach((indicator, index) => {
    const stepNumber = index + 1

    if (stepNumber < step) {
      indicator.classList.add("completed")
      indicator.classList.remove("active")
    } else if (stepNumber === step) {
      indicator.classList.add("active")
      indicator.classList.remove("completed")
    } else {
      indicator.classList.remove("active", "completed")
    }
  })
}

// Start OTP timer
function startOtpTimer() {
  otpTimeLeft = 300 // 5 minutes
  updateTimerDisplay()

  otpTimer = setInterval(() => {
    otpTimeLeft--
    updateTimerDisplay()

    if (otpTimeLeft <= 0) {
      stopOtpTimer()
      enableResendButton()
    }
  }, 1000)
}

// Stop OTP timer
function stopOtpTimer() {
  if (otpTimer) {
    clearInterval(otpTimer)
    otpTimer = null
  }
}

// Update timer display
function updateTimerDisplay() {
  const timerEl = document.getElementById("otpTimer")
  if (timerEl) {
    const minutes = Math.floor(otpTimeLeft / 60)
    const seconds = otpTimeLeft % 60
    timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`
  }
}

// Enable resend button
function enableResendButton() {
  const resendBtn = document.getElementById("resendOtp")
  const timerEl = document.getElementById("otpTimer")

  if (resendBtn) {
    resendBtn.disabled = false
    resendBtn.textContent = "Resend OTP"
  }

  if (timerEl) {
    timerEl.textContent = "Expired"
    timerEl.style.color = "var(--danger)"
  }
}

// Get OTP value from inputs
function getOtpValue() {
  const otpInputs = document.querySelectorAll(".otp-input")
  return Array.from(otpInputs)
    .map((input) => input.value)
    .join("")
}

// Clear OTP inputs
function clearOtpInputs() {
  const otpInputs = document.querySelectorAll(".otp-input")
  otpInputs.forEach((input) => {
    input.value = ""
  })

  // Focus on first input
  if (otpInputs.length > 0) {
    otpInputs[0].focus()
  }
}

// Check if OTP is complete
function checkOtpComplete() {
  const otp = getOtpValue()
  const submitBtn = document.getElementById("otpSubmitBtn")

  if (submitBtn) {
    submitBtn.disabled = otp.length !== 7
  }
}

// Utility functions
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

function showError(errorElement, message) {
  if (errorElement) {
    errorElement.textContent = message
    errorElement.style.display = "block"
  }
}

function hideError(errorElement) {
  if (errorElement) {
    errorElement.style.display = "none"
    errorElement.textContent = ""
  }
}

function showSnackbar(message, type = "success") {
  const snackbar = document.getElementById("snackbar")
  if (!snackbar) return

  const messageEl = snackbar.querySelector(".snackbar-message")
  const iconEl = snackbar.querySelector(".snackbar-icon")

  if (messageEl) messageEl.textContent = message

  // Update icon based on type
  if (iconEl) {
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
  }

  snackbar.classList.add("show")

  setTimeout(() => {
    snackbar.classList.remove("show")
  }, 3000)
}

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  stopOtpTimer()
})
