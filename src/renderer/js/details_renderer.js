document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("answersContainer");

  const index = localStorage.getItem("selectedSubmissionIndex");
  const answers = await window.api.getResultSolutions(Number(index)); 

  if (!answers || answers.length === 0) {
    container.innerHTML = "<p>No answers found.</p>";
    return;
  }

  answers.forEach(answer => {
    const card = document.createElement("div");
    card.className = "answer-card";
    card.innerHTML = `
        <h3 class="question-title">Question: ${answer.question_text}</h3>
        <p class="info-row"><span class="label">Answer:</span><span class="value">${answer.answer_text}</span></p>
        <p class="info-row"><span class="label">Points:</span><span class="value">${answer.points}</span></p>
        <p class="info-row"><span class="label">Feedback:</span><span class="value">${answer.feedback}</span></p>
      `;

    container.appendChild(card);
  });
    if (exitResultBtn) {
    exitResultBtn.addEventListener('click', () => {
      window.location.href = "home.html";
    });
  }
});
