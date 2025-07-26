window.api.getUsername().then(({ currentUser }) => {
  document.getElementById('username').innerText = `Welcome, ${currentUser}`;
});

function logout() {
  location.href = 'login_screen.html';
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
        examCard.innerHTML = `
          <h2>${exam.title}</h2>
          <p><strong>Time:</strong> ${exam.duration} hour(s)</p>
          <p><strong>Total Points:</strong> ${exam.total_points}</p>
          <button class="StartExamButton" data-id="${exam.id}">
            <img src="../../assets/start.png" alt="Start Icon">
            Start Exam
          </button>
        `;
        container.appendChild(examCard);
      });

      const allStartButtons = document.querySelectorAll('.StartExamButton');
      allStartButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          const examId = e.currentTarget.dataset.id;
          window.api.startExam(examId).then(response => {
            if (response.success) {
              console.log(`Exam ${examId} started successfully`);
            } else {
              console.error('Failed to start exam:', response.message);
            }
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
});










































