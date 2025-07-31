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

// عناصر DOM الخاصة بالنتائج
const showResultBtn = document.getElementById("resultBtn");
const resultSection = document.getElementById("resultContent");
const currentSection = document.getElementById("currentContent");
const submissionTableContainer = document.getElementById("detailedResultsContainer");

// إظهار/إخفاء الأقسام
showResultBtn.addEventListener("click", () => {
  currentSection.classList.add("hidden");
  resultSection.classList.remove("hidden");
  showStaticSubmissions(); // عرض النتائج المؤقتة
});

const staticSubmissions = [
  {
    submission_id: 1,
    quiz_id: 5,
    quiz_title: "Math Quiz",
    status: "graded",
    grade: 95,
    graded_at: "2025-07-20T15:00:00+03:00"
  },
  {
    submission_id: 2,
    quiz_id: 6,
    quiz_title: "Physics Quiz",
    status: "pending",
    grade: null,
    graded_at: null
  }
];


// عرض النتائج المؤقتة
function showStaticSubmissions() {
  window.api.getResult().then(staticSubmissions => {
    const results = staticSubmissions.results;
    if (!Array.isArray(results)) {
      console.error("Expected an array, got:", staticSubmissions);
      return;
    }

    let html = `
      <table class="table table-bordered">
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
    `;


    results.forEach((submission, index) => {
      html += `
        <tr>
          <td>${index + 1}</td>
          <td>${submission.quiz_title}</td>
          <td>${submission.status}</td>
          <td>${submission.grade !== null ? submission.grade : "—"}</td>
          <td>
            <button class="view-details-btn" data-index="${index}">View Details</button>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    const submissionTableContainer = document.getElementById("submissionTableContainer");
    submissionTableContainer.innerHTML = html;

    document.querySelectorAll(".view-details-btn").forEach(button => {
      button.addEventListener("click", (e) => {
        const index = e.target.getAttribute("data-index");
        const submission = staticSubmissions[index];
        localStorage.setItem("currentSubmission", JSON.stringify(submission));
window.api.navigateToDetails();      });
    });
  }).catch(err => {
    console.error("Error loading results:", err.message);
  });
}









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
      ${isSubmitted ? 'Submmitted' : 'Start Exam'}  
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







// function getCourseList() {
//   window.api.getCourseList().then(response => {
//     if (response.success) {
//       const courseList = document.getElementById('courseList');
//       courseList.innerHTML = ''; // Clear existing courses  
//       response.courses.forEach(course => {
//         const courseCard = document.createElement('div');
//         courseCard.classList.add('course-card');
//         courseCard.innerHTML = `
//           <h2>${course.name}</h2>
//           <p><strong>Instructor:</strong> ${course.instructor_name}</p>
//           <p><strong>Level:</strong> ${course.level}</p>
//           <button class="enrollButton">Show Feedback</button>
//         `;
//         courseList.appendChild(courseCard);
//       });
//     } else {
//       console.error('Failed to fetch course list:', response.message);
//     }
//   });
// }
window.addEventListener('DOMContentLoaded', async () => {
 // getCourseList();
  getCurrentQuizes();
  showStaticSubmissions();

  const justLoggedIn = await window.api.checkJustLoggedIn();
  if (justLoggedIn) {
    showSnackbar("Login successfully");
  }
});


function showSnackbar(message) {
    const snackbar = document.getElementById('snackbar');
    snackbar.textContent = message;
    snackbar.classList.add('show');
    setTimeout(() => snackbar.classList.remove('show'), 3000);
}





























