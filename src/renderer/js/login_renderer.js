const form = document.getElementById('loginForm');

if (form) {
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        const result = await window.api.login(username, password);

        if (!result.success) {
            showSnackbar(result.message || 'Login failed');
        }
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
