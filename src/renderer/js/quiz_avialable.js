const startExamBtn = document.getElementById('StartExamButton');
startExamBtn.addEventListener('click', () => {
  window.api.startEXam().then(response => {
    if (response.success) {
      console.log('Exam started successfully');
    } else {
      console.error('Failed to start exam:', response.message); }})})