window.api.getUsername().then(({ currentUser }) => {
  document.getElementById('username').innerText = `Welcome, ${currentUser}`;
});

function logout() {
  location.href = '/home/infinity/Desktop/prototype/src/renderer/login_screen.html';
}
