let courseInfo;
  const courseNameElement = document.getElementById("courseName");
  const averageScoreElement = document.getElementById("averageScore");
  const rankingElement = document.getElementById("ranking");
  const totalScoreElement = document.getElementById("totalScore");
  const rankingByTotalScoreElement = document.getElementById("rankingByTotalScore");
  const totalStudentsElement = document.getElementById("totalStudents");

setupWindowControls()

function setupWindowControls() {
  const minimizeBtn = document.getElementById("minimizeBtn")
  const maximizeBtn = document.getElementById("maximizeBtn")
  const closeBtn = document.getElementById("closeBtn")

  if (minimizeBtn) {
    minimizeBtn.addEventListener("click", () => {
      window.api.windowMinimize()
    })
  }

  if (maximizeBtn) {
    maximizeBtn.addEventListener("click", async () => {
      await window.api.windowMaximize()
      updateMaximizeButton()
    })
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      window.api.windowClose()
    })
  }

  // Update maximize button icon based on window state
  updateMaximizeButton()
}

async function updateMaximizeButton() {
  const maximizeBtn = document.getElementById("maximizeBtn")
  if (!maximizeBtn) return

  try {
    const isMaximized = await window.api.windowIsMaximized()
    const svg = maximizeBtn.querySelector("svg")

    if (isMaximized) {
      // Show restore icon
      svg.innerHTML = `
        <rect x="2" y="3" width="6" height="6" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M4 2h6v6" stroke="currentColor" stroke-width="1.5" fill="none"/>
      `
      maximizeBtn.title = "Restore"
    } else {
      // Show maximize icon
      svg.innerHTML = `
        <rect x="2" y="2" width="8" height="8" stroke="currentColor" stroke-width="1.5" fill="none"/>
      `
      maximizeBtn.title = "Maximize"
    }
  } catch (error) {
    console.error("Error updating maximize button:", error)
  }
}


async function loadCourseStatistics() {
  try {
    const response = await window.api.getCourseStatistics();
    if (response) {
      courseInfo = response;
      
      updateUI(courseInfo);
    } 
  } catch (error) {
    console.error("Error loading course statistics:", error);
  }
}
function updateUI(stats) {
  courseNameElement.textContent = stats.course_name ;
 averageScoreElement.textContent = stats.average_score;
  rankingElement.textContent = stats.ranking;
   totalScoreElement.textContent = stats.total_score;
 rankingByTotalScoreElement.textContent = stats.ranking_by_total_score;
   totalStudentsElement.textContent = stats.total_students ;
}



document.addEventListener("DOMContentLoaded", async () => {
  await loadCourseStatistics();
  
  const homeBtn = document.getElementById("homeBtn");
  if (homeBtn) {
    homeBtn.addEventListener("click", () => {
      window.location.href = "home.html";
    });
  }
});
