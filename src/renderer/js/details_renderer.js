document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("answersContainer");

  try {
    const answers = await window.api.getResultSolutions();

    if (!answers || answers.length === 0) {
      container.innerHTML = "<p>No results found.</p>";
      return;
    }

    answers.forEach(answer => {
      const card = document.createElement("div");
      card.className = "card"; 
      card.innerHTML = `
        <h3 class="question-title">Question: ${answer.question_text}</h3>
        <p class="info-row"><span class="label">Answer:</span><span class="value">${answer.answer_text}</span></p>
        <p class="info-row"><span class="label">Points:</span><span class="value">${answer.points}</span></p>
        <p class="info-row"><span class="label">Feedback:</span><span class="value">${answer.feedback}</span></p>
      `;

      container.appendChild(card);
    });
  } catch (error) {
    console.error("Error loading result solutions:", error);
    container.innerHTML = "<p style='color: red;'>Error loading results.</p>";
  }
});
