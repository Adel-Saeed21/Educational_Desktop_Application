const forgotForm = document.getElementById('forgotForm');
const otpForm = document.getElementById('otpForm');
const snackbar = document.getElementById('snackbar');
const timerSpan = document.getElementById('timer');
const resetPasswordForm = document.getElementById('resetPasswordForm');
const backToEmailBtn = document.getElementById('backToEmailBtn');
let timerInterval, timeLeft = 60;
let email = "";

function showSnackbar(message, color = "#e74c3c") {
    snackbar.textContent = message;
    snackbar.style.backgroundColor = color;
    snackbar.className = "show";
    setTimeout(() => snackbar.className = snackbar.className.replace("show", ""), 3000);
}

forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    email = document.getElementById('forgotEmail').value;
    const result = await window.api.sendOtp(email);
    if (result.success) {
        showSnackbar("OTP sent to your email", "#27ae60");
        forgotForm.style.display = "none";
        otpForm.style.display = "block";
        startTimer();
    } else {
        showSnackbar(result.message || "Failed to send OTP");
    }
});

// Fixed: Back to email button should go from OTP form to email form
backToEmailBtn.addEventListener('click', (e) => {
    e.preventDefault();
    // Clear the timer when going back
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    otpForm.style.display = 'none';
    forgotForm.style.display = 'block';
    document.getElementById('otpInput').value = '';
    timerSpan.textContent = '';
});

otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const otp = document.getElementById('otpInput').value;
    const result = await window.api.verifyOtp(email, otp);
    if (result.success) {
        showSnackbar("OTP verified! Please enter your new password.", "#27ae60");
        if (timerInterval) {
            clearInterval(timerInterval);
        }
        otpForm.style.display = "none";
        showResetPasswordForm(email, otp);
    } else {
        showSnackbar(result.message || "Invalid OTP");
    }
});

function startTimer() {
    timeLeft = 600; // 10 minutes
    timerSpan.textContent = `Time left: ${formatTime(timeLeft)}`;
    
    // Clear any existing timer first
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    timerInterval = setInterval(() => {
        timeLeft--;
        timerSpan.textContent = `Time left: ${formatTime(timeLeft)}`;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timerSpan.textContent = "OTP expired. Please request a new one.";
            otpForm.style.display = "none";
            forgotForm.style.display = "block";
            showSnackbar("OTP expired. Please request a new one.");
            // Clear OTP input when expired
            document.getElementById('otpInput').value = '';
        }
    }, 1000);
}

// Helper function to format seconds as mm:ss
function formatTime(seconds) {
    const min = Math.floor(seconds / 60).toString().padStart(2, '0');
    const sec = (seconds % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
}

function showResetPasswordForm(email, otp) {
    // Hide all other forms first
    forgotForm.style.display = 'none';
    otpForm.style.display = 'none';
    
    // Create and show a simple reset password form
    const container = document.getElementById('loginFormContainer');
    
    // Check if reset form already exists, if so remove it first
    const existingResetForm = document.getElementById('resetPasswordForm');
    if (existingResetForm) {
        existingResetForm.remove();
    }
    
    container.innerHTML += `
        <form id="resetPasswordForm" style="display: block;">
            <div class="mb-3">
                <label for="newPassword" class="form-label">New Password:</label>
                <input type="password" id="newPassword" class="form-control" required minlength="8" />
            </div>
            <div class="mb-3">
                <label for="confirmPassword" class="form-label">Confirm New Password:</label>
                <input type="password" id="confirmPassword" class="form-control" required minlength="8" />
            </div>
            <div class="text-center">
                <button type="submit" class="btn btn-success">Reset Password</button>
                <button type="button" id="backToOtpBtn" class="btn btn-secondary ms-2">Back to OTP</button>
            </div>
        </form>
    `;
    
    // Add event listener for the new reset password form
    document.getElementById('resetPasswordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        // Check if passwords match
        if (newPassword !== confirmPassword) {
            showSnackbar("Passwords do not match.");
            return;
        }
        
        const result = await window.api.resetPassword(email, otp, newPassword);
        if (result.success) {
            showSnackbar("Password has been reset. You can now log in.", "#27ae60");
            setTimeout(() => window.location.href = "login_screen.html", 2000);
        } else {
            showSnackbar(result.message || "Password reset failed.");
        }
    });
    
    
    document.getElementById('backToOtpBtn').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('resetPasswordForm').remove();
        otpForm.style.display = 'block';
        startTimer();
    });
}