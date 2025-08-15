const form = document.getElementById("loginForm")
const loginButton = document.getElementById("loginButton")
const usernameInput = document.getElementById("username")
const passwordInput = document.getElementById("password")
const toggleEye = document.getElementById("toggleEye")
const loader = document.getElementById("loader")
const snackbar = document.getElementById("snackbar")

function validateEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return emailRegex.test(email)
}

function validateForm() {
  const email = usernameInput.value.trim()
  const password = passwordInput.value

  // Reset previous validation states
  usernameInput.classList.remove("error")
  passwordInput.classList.remove("error")

  let isValid = true

  if (!email) {
    usernameInput.classList.add("error")
    isValid = false
  } else if (!validateEmail(email)) {
    usernameInput.classList.add("error")
    showNotification("Please enter a valid email address", "error")
    isValid = false
  }

  if (!password) {
    passwordInput.classList.add("error")
    isValid = false
  } else if (password.length < 6) {
    passwordInput.classList.add("error")
    showNotification("Password must be at least 6 characters", "error")
    isValid = false
  }

  return isValid
}

function setLoadingState(isLoading) {
  if (isLoading) {
    loginButton.classList.add("loading")
    loginButton.disabled = true
    loader.style.display = "flex"

    // Add loading animation to button
    const btnSpinner = loginButton.querySelector(".btn-spinner")
    if (btnSpinner) {
      btnSpinner.style.display = "block"
    }
  } else {
    loginButton.classList.remove("loading")
    loginButton.disabled = false
    loader.style.display = "none"

    // Remove loading animation from button
    const btnSpinner = loginButton.querySelector(".btn-spinner")
    if (btnSpinner) {
      btnSpinner.style.display = "none"
    }
  }
}

function showNotification(message, type = "error", duration = 4000) {
  const notificationText = snackbar.querySelector(".notification-text")
  const notificationIcon = snackbar.querySelector(".notification-icon")

  if (notificationText) {
    notificationText.textContent = message
  }

  // Update icon based on type
  if (notificationIcon) {
    if (type === "success") {
      notificationIcon.innerHTML = `
                <circle cx="12" cy="12" r="10"/>
                <polyline points="9,12 12,15 22,5"/>
            `
    } else if (type === "error") {
      notificationIcon.innerHTML = `
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
            `
    }
  }

  snackbar.className = `notification ${type} fade-in`
  snackbar.style.display = "flex"

  // Auto hide
  setTimeout(() => {
    snackbar.style.opacity = "0"
    snackbar.style.transform = "translateX(-50%) translateY(20px)"

    setTimeout(() => {
      snackbar.style.display = "none"
      snackbar.style.opacity = "1"
      snackbar.style.transform = "translateX(-50%)"
    }, 300)
  }, duration)
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoadingState(true)

    const username = usernameInput.value.trim()
    const password = passwordInput.value

    try {
      const result = await window.api.login(username, password)

      if (result.success) {
        showNotification("Login successful! Redirecting...", "success", 2000)

        // Add success animation
        form.classList.add("success")

        // Redirect after short delay
        setTimeout(() => {
          // The API will handle the navigation
        }, 1500)
      } else {
        showNotification(result.message || "Login failed. Please check your credentials.", "error")
      }
    } catch (error) {
      console.error("Login error:", error)
      showNotification("An unexpected error occurred. Please try again.", "error")
    } finally {
      setLoadingState(false)
    }
  })
}

if (toggleEye) {
  toggleEye.addEventListener("click", (e) => {
    e.preventDefault()

    const eyeIcon = toggleEye.querySelector(".eye-icon")

    if (passwordInput.type === "password") {
      passwordInput.type = "text"
      toggleEye.setAttribute("aria-label", "Hide password")

      // Update icon to "eye-off"
      eyeIcon.innerHTML = `
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
            `
    } else {
      passwordInput.type = "password"
      toggleEye.setAttribute("aria-label", "Show password")

      // Update icon to "eye"
      eyeIcon.innerHTML = `
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
            `
    }

    // Add a subtle animation
    eyeIcon.style.transform = "scale(0.8)"
    setTimeout(() => {
      eyeIcon.style.transform = "scale(1)"
    }, 150)
  })
}

const forgotPasswordLink = document.getElementById("forgotPasswordLink")
if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener("click", (e) => {
    e.preventDefault()

    // Add loading state to link
    forgotPasswordLink.style.opacity = "0.6"
    forgotPasswordLink.style.pointerEvents = "none"

    setTimeout(() => {
      window.location.href = "forget_password.html"
    }, 200)
  })
}
;[usernameInput, passwordInput].forEach((input) => {
  if (!input) return

  // Add floating label effect
  input.addEventListener("focus", () => {
    input.parentElement.classList.add("focused")
  })

  input.addEventListener("blur", () => {
    if (!input.value) {
      input.parentElement.classList.remove("focused")
    }
    input.classList.remove("error")
  })

  // Real-time validation feedback
  input.addEventListener("input", () => {
    input.classList.remove("error")

    if (input === usernameInput && input.value) {
      if (validateEmail(input.value)) {
        input.classList.add("valid")
      } else {
        input.classList.remove("valid")
      }
    }
  })
})

document.addEventListener("keydown", (e) => {
  // Enter key to submit (when not already focused on submit button)
  if (e.key === "Enter" && document.activeElement !== loginButton) {
    e.preventDefault()
    form.dispatchEvent(new Event("submit"))
  }

  // Escape key to clear form
  if (e.key === "Escape") {
    usernameInput.value = ""
    passwordInput.value = ""
    usernameInput.focus()
  }
})

document.addEventListener("DOMContentLoaded", () => {
  // Focus on first empty input
  if (!usernameInput.value) {
    usernameInput.focus()
  } else if (!passwordInput.value) {
    passwordInput.focus()
  }

  // Initialize theme if not already done
  if (!window.themeManager) {
    // Fallback theme initialization
    const savedTheme = localStorage.getItem("quiz-room-theme") || "light"
    document.documentElement.setAttribute("data-theme", savedTheme)
  }
})

const style = document.createElement("style")
style.textContent = `
    .form-input.error {
        border-color: var(--accent-error) !important;
        box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1) !important;
    }
    
    .form-input.valid {
        border-color: var(--accent-success) !important;
    }
    
    .input-wrapper.focused .input-icon {
        color: var(--accent-primary);
    }
    
    .form.success {
        animation: successPulse 0.6s ease-out;
    }
    
    @keyframes successPulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.02); }
        100% { transform: scale(1); }
    }
`
document.head.appendChild(style)
