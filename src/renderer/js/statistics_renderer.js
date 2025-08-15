let courseInfo;
  const courseNameElement = document.getElementById("courseName");
  const averageScoreElement = document.getElementById("averageScore");
  const rankingElement = document.getElementById("ranking");
  const totalScoreElement = document.getElementById("totalScore");
  const rankingByTotalScoreElement = document.getElementById("rankingByTotalScore");
  const totalStudentsElement = document.getElementById("totalStudents");

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
