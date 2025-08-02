const form = document.getElementById('loginForm');

if (form) {
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        document.getElementById('loader').classList.remove('d-none');

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

        if (!emailRegex.test(username)) {
            showSnackbar('Login failed');

            document.getElementById('loader').classList.add('d-none');
            return;
        }

        const result = await window.api.login(username, password);

        if (!result.success) {
            showSnackbar(result.message || 'Login failed');
        }

        document.getElementById('loader').classList.add('d-none');
    });
}



const toggleEye = document.getElementById('toggleEye');

if (toggleEye) {
    toggleEye.addEventListener('click', () => {
        const passwordField = document.getElementById('password');
        if (passwordField.type === 'password') {
            passwordField.type = 'text';
            toggleEye.src = '../../assets/hide_password.png';
        } else {
            passwordField.type = 'password';
            toggleEye.src = '../../assets/view_password.png';
        }
    });
}

function showSnackbar(message) {
    const snackbar = document.getElementById('snackbar');
    snackbar.textContent = message;
    snackbar.classList.add('show');
    setTimeout(() => snackbar.classList.remove('show'), 3000);
}
// Add event listener for the "Forgot Password?" link
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = "forget_password.html";
    });
}