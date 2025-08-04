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
document.getElementById("searchInput").addEventListener("input", () => {
  filterAndRenderResults();
});

document.getElementById("statusFilter").addEventListener("change", () => {
  filterAndRenderResults();
});


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


const showResultBtn = document.getElementById("resultBtn");
const resultSection = document.getElementById("resultContent");
const currentSection = document.getElementById("currentContent");
const submissionTableContainer = document.getElementById("detailedResultsContainer");


showResultBtn.addEventListener("click", () => {
  currentSection.classList.add("hidden");
  resultSection.classList.remove("hidden");
  showStaticSubmissions(); 
});


let currentPage = 1;
const itemsPerPage = 7;
let globalResults = null;

function showStaticSubmissions(page = 1, results = globalResults) {
  const renderPage = (resultsToRender) => {
    currentPage = page;
    const startIndex = (page - 1) * itemsPerPage;
    const paginatedResults = resultsToRender.slice(startIndex, startIndex + itemsPerPage);

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

    paginatedResults.forEach((submission, index) => {
      html += `
        <tr>
          <td>${startIndex + index + 1}</td>
          <td>${submission.quiz_title}</td>
          <td>${submission.status}</td>
          <td>${submission.grade !== null ? submission.grade : "—"}</td>
          <td>
            <button class="view-details-btn" 
                    data-index="${startIndex + index}" 
                    data-status="${submission.status}">
              View Details
            </button>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;

    const totalPages = Math.ceil(resultsToRender.length / itemsPerPage);
    html += `<div class="pagination-controls" style="margin-top:10px;">`;

    if (page > 1) {
      html += `<button id="prevPage">Previous</button>`;
    }

    html += `<span style="margin: 0 10px;">Page ${page} of ${totalPages}</span>`;

    if (page < totalPages) {
      html += `<button id="nextPage">Next</button>`;
    }

    html += `</div>`;

    const submissionTableContainer = document.getElementById("submissionTableContainer");
    submissionTableContainer.innerHTML = html;

    document.querySelectorAll(".view-details-btn").forEach(button => {
      button.addEventListener("click", (e) => {
        const index = e.target.getAttribute("data-index");
        const status = e.target.getAttribute("data-status");

        if (status.toLowerCase() === "graded") {
          localStorage.setItem("selectedSubmissionIndex", index);
          window.api.navigateToDetails();
        } else {
          alert("This quiz has not been graded yet.");
        }
      });
    });

    if (page > 1) {
      document.getElementById("prevPage").addEventListener("click", () => {
        showStaticSubmissions(page - 1, resultsToRender);
      });
    }

    if (page < totalPages) {
      document.getElementById("nextPage").addEventListener("click", () => {
        showStaticSubmissions(page + 1, resultsToRender);
      });
    }
  };

  if (results) {
    renderPage(results);
  } else {
    window.api.getResult().then(staticSubmissions => {
      if (!Array.isArray(staticSubmissions.results)) {
        console.error("Expected an array, got:", staticSubmissions);
        return;
      }
      globalResults = staticSubmissions.results;
      filterAndRenderResults(); 
    }).catch(err => {
      console.error("Error loading results:", err.message);
    });
  }
}




function renderCurrentQuizes(quizzes) {
  const container = document.getElementById('StartExam');
  container.innerHTML = ''; 

  quizzes.forEach((exam) => {
    const examCard = document.createElement('div');
    examCard.className = 'exam-card';

    const isSubmitted = exam.submitted;

    examCard.innerHTML = `
      <input type="checkbox" class="examStatusCheckbox" data-id="${exam.id}" ${isSubmitted ? 'checked' : ''} disabled />
      <h2 style="font-size: ${exam.title.length > 15 ? '16px' : '20px'}">${exam.title}</h2>
      <p><strong>Time:</strong> ${exam.duration} min</p>
      <p><strong>Total Points:</strong> ${exam.total_points}</p>
      <button class="StartExamButton" data-id="${exam.id}" ${isSubmitted ? 'disabled' : ''}>
        ${isSubmitted ? 'Submitted' : 'Start Exam'}  
      </button>
    `;

    container.appendChild(examCard);
  });

  attachStartExamHandlers();
}

function attachStartExamHandlers() {
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
}


function getCurrentQuizes() {
  const loader = document.getElementById('loader');
  loader.style.display = 'block';


  window.api.getCurrentQuizes().then(response => {
    loader.style.display = 'none';
    if (response.success) {
      renderCurrentQuizes(response.quizes);
    } else {
      document.getElementById('StartExam').innerHTML = `<p style="color:red;">${response.message}</p>`;
    }
  });

  
  window.api.startQuizzesStream();

  
  window.api.onCurrentQuizzesUpdate((quizzes) => {
    renderCurrentQuizes(quizzes);
  });
}
function filterAndRenderResults() {
  const searchTerm = document.getElementById("searchInput").value.toLowerCase();
  const selectedStatus = document.getElementById("statusFilter").value;

  if (!Array.isArray(globalResults)) return;

  const filtered = globalResults.filter(sub => {
    const matchesTitle = sub.quiz_title.toLowerCase().includes(searchTerm);
    const matchesStatus = selectedStatus ? sub.status.toLowerCase() === selectedStatus : true;
    return matchesTitle && matchesStatus;
  });

  showStaticSubmissions(1, filtered); 
}

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


// function getCurrentQuizes() {
//   const container = document.getElementById('StartExam');
//   const loader = document.getElementById('loader');
//   container.innerHTML = ''; 
//   loader.style.display = 'block'; 

//   window.api.getCurrentQuizes().then(response => {
//     loader.style.display = 'none'; 

//     if (response.success) {
//       response.quizes.forEach((exam) => {
//   const examCard = document.createElement('div');
//   examCard.className = 'exam-card';

//   const isSubmitted = exam.submitted; 

//   examCard.innerHTML = `
//     <input type="checkbox" class="examStatusCheckbox" data-id="${exam.id}" ${isSubmitted ? 'checked' : ''} disabled />
//     <h2 style="font-size: ${exam.title.length > 15 ? '16px' : '20px'}">${exam.title}</h2>
//     <p><strong>Time:</strong> ${exam.duration} min</p>
//     <p><strong>Total Points:</strong> ${exam.total_points}</p>
//     <button class="StartExamButton" data-id="${exam.id}" ${isSubmitted ? 'disabled' : ''}>
//       ${isSubmitted ? 'Submmitted' : 'Start Exam'}  
//     </button>
//   `;

//   container.appendChild(examCard);
// });
    

//     const allStartButtons = document.querySelectorAll('.StartExamButton');
// allStartButtons.forEach(button => {
//   button.addEventListener('click', (e) => {
//     const target = e.currentTarget;
//     if (!target) return;

//     const examId = parseInt(target.dataset.id);
//     target.disabled = true;

//     window.api.startEXam(examId).then(response => {
//       if (response.success) {
//         showSnackbar(`Exam ${examId} started!`);

//         const checkbox = document.querySelector(`.examStatusCheckbox[data-id="${examId}"]`);
//         if (checkbox) checkbox.checked = true;

//       } else {
//         showSnackbar('Failed to start exam');
//         target.disabled = false;
//       }
//     }).catch(error => {
//       showSnackbar('Something went wrong!');
//       console.error(error);
//       target.disabled = false;
//     });
//   });
// });



//     } else {
//       console.error('Failed to load exams:', response.message);
//       container.innerHTML = `<p style="color:red;">${response.message}</p>`;
//     }
//   });
// }







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






























