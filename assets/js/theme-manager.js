// Theme Management System for QuizRoom
class ThemeManager {
  constructor() {
    this.currentTheme = this.getStoredTheme() || this.getSystemTheme()
    this.init()
  }

  init() {
    this.applyTheme(this.currentTheme)
    this.createThemeToggle()
    this.bindEvents()
  }

  getSystemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }

  getStoredTheme() {
    return localStorage.getItem("quiz-room-theme")
  }

  storeTheme(theme) {
    localStorage.setItem("quiz-room-theme", theme)
  }

  applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme)
    this.currentTheme = theme
    this.storeTheme(theme)
    this.updateThemeToggleIcon()
  }

  toggleTheme() {
    const newTheme = this.currentTheme === "light" ? "dark" : "light"
    this.applyTheme(newTheme)

    // Add a subtle animation effect
    document.body.style.transition = "background-color 0.3s ease, color 0.3s ease"
    setTimeout(() => {
      document.body.style.transition = ""
    }, 300)
  }

  createThemeToggle() {
    // Find existing theme toggle or create new one
    let themeToggle = document.getElementById("themeToggle")

    if (!themeToggle) {
      themeToggle = document.createElement("button")
      themeToggle.id = "themeToggle"
      themeToggle.className = "theme-toggle"
      themeToggle.setAttribute("aria-label", "Toggle theme")
      themeToggle.setAttribute("title", "Toggle light/dark theme")

      // Add to navigation if it exists
      const navigation = document.querySelector(".navigation")
      if (navigation) {
        navigation.appendChild(themeToggle)
      } else {
        // Fallback: add to body
        document.body.appendChild(themeToggle)
      }
    }

    this.updateThemeToggleIcon()
  }

  updateThemeToggleIcon() {
    const themeToggle = document.getElementById("themeToggle")
    if (!themeToggle) return

    const isDark = this.currentTheme === "dark"

    themeToggle.innerHTML = `
      <svg class="theme-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${
          isDark
            ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
            : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
        }
      </svg>
    `
  }

  bindEvents() {
    // Theme toggle click event
    document.addEventListener("click", (e) => {
      if (e.target.closest("#themeToggle")) {
        this.toggleTheme()
      }
    })

    // Listen for system theme changes
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (!this.getStoredTheme()) {
        this.applyTheme(e.matches ? "dark" : "light")
      }
    })

    // Keyboard shortcut (Ctrl/Cmd + Shift + T)
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "T") {
        e.preventDefault()
        this.toggleTheme()
      }
    })
  }

  // Utility method to get current theme
  getCurrentTheme() {
    return this.currentTheme
  }

  // Method to set theme programmatically
  setTheme(theme) {
    if (theme === "light" || theme === "dark") {
      this.applyTheme(theme)
    }
  }
}

// Enhanced notification system
class NotificationManager {
  constructor() {
    this.notifications = []
  }

  show(message, type = "success", duration = 3000) {
    const notification = document.createElement("div")
    notification.className = `notification ${type} fade-in`
    notification.textContent = message

    document.body.appendChild(notification)
    this.notifications.push(notification)

    // Auto remove
    setTimeout(() => {
      this.remove(notification)
    }, duration)

    return notification
  }

  remove(notification) {
    if (notification && notification.parentNode) {
      notification.style.opacity = "0"
      notification.style.transform = "translateX(-50%) translateY(20px)"

      setTimeout(() => {
        notification.remove()
        this.notifications = this.notifications.filter((n) => n !== notification)
      }, 300)
    }
  }

  success(message, duration) {
    return this.show(message, "success", duration)
  }

  error(message, duration) {
    return this.show(message, "error", duration)
  }

  warning(message, duration) {
    return this.show(message, "warning", duration)
  }
}

// Initialize theme manager when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.themeManager = new ThemeManager()
  window.notificationManager = new NotificationManager()
})

// Export for use in other scripts
if (typeof module !== "undefined" && module.exports) {
  module.exports = { ThemeManager, NotificationManager }
}
