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
            console.log(response);
            updateUI(courseInfo);
        }
    } catch (error) {
        console.error("Error loading course statistics:", error);
    }
}

function updateUI(stats) {
    courseNameElement.textContent = stats.course_name;
    averageScoreElement.textContent = stats.average_score;
    rankingElement.textContent = stats.ranking;
    totalScoreElement.textContent = stats.total_score;
    rankingByTotalScoreElement.textContent = stats.ranking_by_total_score;
    totalStudentsElement.textContent = stats.total_students;
    
    const averageScoreProgress = document.getElementById("averageScoreProgress");
    if (averageScoreProgress && stats.average_score) {
        averageScoreProgress.style.width = `${stats.average_score}%`;
    }
    
    const rankingBadge = document.getElementById("rankingBadge");
    if (rankingBadge && stats.ranking && stats.total_students) {
        const rankingPercentage = ((stats.total_students - stats.ranking + 1) / stats.total_students) * 100;
        if (rankingPercentage >= 90) {
            rankingBadge.textContent = "Excellent";
            rankingBadge.className = "badge excellent";
        } else if (rankingPercentage >= 75) {
            rankingBadge.textContent = "Very Good";
            rankingBadge.className = "badge very-good";
        } else if (rankingPercentage >= 60) {
            rankingBadge.textContent = "Good";
            rankingBadge.className = "badge good";
        } else {
            rankingBadge.textContent = "Needs Improvement";
            rankingBadge.className = "badge needs-improvement";
        }
    }
    
    // Update percentile
    const percentileElement = document.getElementById("percentile");
    if (percentileElement && stats.ranking_by_total_score && stats.total_students) {
        const percentile = ((stats.total_students - stats.ranking_by_total_score + 1) / stats.total_students) * 100;
        percentileElement.textContent = `${Math.round(percentile)}th percentile`;
    }
    
    const totalStudentsScore = document.getElementById("totalStudentsScore");
    if (totalStudentsScore) {
        totalStudentsScore.textContent = stats.total_students;
    }
    
    const scoreTrend = document.getElementById("scoreTrend");
    if (scoreTrend && stats.total_score) {
        if (stats.total_score >= 90) {
            scoreTrend.textContent = "Excellent Performance";
            scoreTrend.className = "trend excellent";
        } else if (stats.total_score >= 75) {
            scoreTrend.textContent = "Good Performance";
            scoreTrend.className = "trend good";
        } else if (stats.total_score >= 60) {
            scoreTrend.textContent = "Average Performance";
            scoreTrend.className = "trend average";
        } else {
            scoreTrend.textContent = "Needs Improvement";
            scoreTrend.className = "trend needs-improvement";
        }
    }
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