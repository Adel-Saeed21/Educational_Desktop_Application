window.api.getUsername().then(({ currentUser }) => {
  document.getElementById('username').innerText = `Welcome, ${currentUser}`;
});

function logout() {
   window.api.logout();
}

const currentBtn = document.getElementById("currentBtn");
const resultBtn = document.getElementById("resultBtn");

const currentContent = document.getElementById("currentContent");
const resultContent = document.getElementById("resultContent");

currentBtn.addEventListener("click", (e) => {
  e.preventDefault();
  currentContent.classList.remove("hidden");
  resultContent.classList.add("hidden");
});

resultBtn.addEventListener("click", (e) => {
  e.preventDefault();
  resultContent.classList.remove("hidden");
  currentContent.classList.add("hidden");
});






function getCurrentQuizes() {
  const container = document.getElementById('StartExam');
  const loader = document.getElementById('loader');
  container.innerHTML = ''; 
  loader.style.display = 'block'; 

  window.api.getCurrentQuizes().then(response => {
    loader.style.display = 'none'; 

    if (response.success) {
      response.quizes.forEach((exam) => {
  const examCard = document.createElement('div');
  examCard.className = 'exam-card';

  const isSubmitted = exam.submitted; 

  examCard.innerHTML = `
    <input type="checkbox" class="examStatusCheckbox" data-id="${exam.id}" ${isSubmitted ? 'checked' : ''} disabled />
    <h2 style="font-size: ${exam.title.length > 15 ? '16px' : '20px'}">${exam.title}</h2>
    <p><strong>Time:</strong> ${exam.duration} min</p>
    <p><strong>Total Points:</strong> ${exam.total_points}</p>
    <button class="StartExamButton" data-id="${exam.id}" ${isSubmitted ? 'disabled' : ''}>
        Start Exam
    </button>
  `;

  container.appendChild(examCard);
});
    

    const allStartButtons = document.querySelectorAll('.StartExamButton');
allStartButtons.forEach(button => {
  button.addEventListener('click', (e) => {
    const target = e.currentTarget;
    if (!target) return;

    const examId = parseInt(target.dataset.id);
    target.disabled = true;

    window.api.startEXam(examId).then(response => {
      if (response.success) {
        showSnackbar(`Exam ${examId} started!`);

        const checkbox = document.querySelector(`.examStatusCheckbox[data-id="${examId}"]`);
        if (checkbox) checkbox.checked = true;

      } else {
        showSnackbar('Failed to start exam');
        target.disabled = false;
      }
    }).catch(error => {
      showSnackbar('Something went wrong!');
      console.error(error);
      target.disabled = false;
    });
  });
});



    } else {
      console.error('Failed to load exams:', response.message);
      container.innerHTML = `<p style="color:red;">${response.message}</p>`;
    }
  });
}







function getCourseList() {
  window.api.getCourseList().then(response => {
    if (response.success) {
      const courseList = document.getElementById('courseList');
      courseList.innerHTML = ''; // Clear existing courses  
      response.courses.forEach(course => {
        const courseCard = document.createElement('div');
        courseCard.classList.add('course-card');
        courseCard.innerHTML = `
          <h2>${course.name}</h2>
          <p><strong>Instructor:</strong> ${course.instructor_name}</p>
          <p><strong>Level:</strong> ${course.level}</p>
          <button class="enrollButton">Go</button>
        `;
        courseList.appendChild(courseCard);
      });
    } else {
      console.error('Failed to fetch course list:', response.message);
    }
  });
}
window.addEventListener('DOMContentLoaded', () => {
  getCourseList();
  getCurrentQuizes();
  showSnackbar("Login succesfully");
});

function showSnackbar(message) {
    const snackbar = document.getElementById('snackbar');
    snackbar.textContent = message;
    snackbar.classList.add('show');
    setTimeout(() => snackbar.classList.remove('show'), 3000);
}





























