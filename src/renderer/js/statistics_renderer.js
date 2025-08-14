const stats = {
  course_id: 1,
  course_name: "Math 101",
  average_score: 85.0,
  ranking: 2,
  total_score: 255.0,
  ranking_by_total_score: 3,
  total_students: 25
};

document.getElementById("courseName").textContent = stats.course_name;
document.getElementById("averageScore").textContent = stats.average_score;
document.getElementById("ranking").textContent = stats.ranking;
document.getElementById("totalScore").textContent = stats.total_score;
document.getElementById("rankingByTotalScore").textContent = stats.ranking_by_total_score;
document.getElementById("totalStudents").textContent = stats.total_students;

document.addEventListener("DOMContentLoaded", () => {
  if (homeBtn) {
    homeBtn.addEventListener("click", () => {
      window.location.href = "home.html";
    });
  }
});

