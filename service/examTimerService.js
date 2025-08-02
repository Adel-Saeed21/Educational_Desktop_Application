let timerInterval;
let remainingSeconds = 0;

function startTimer(duration, sendUpdate, onFinish) {
  clearInterval(timerInterval);
  remainingSeconds = duration;

  timerInterval = setInterval(() => {
    remainingSeconds--;

    if (typeof sendUpdate === 'function') {
      sendUpdate(remainingSeconds);
    }

    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      if (typeof onFinish === 'function') {
        onFinish();
      }
    }
  }, 1000);
}

function getRemainingTime() {
  return remainingSeconds;
}

function stopTimer() {
  clearInterval(timerInterval);
}

module.exports = {
  startTimer,
  getRemainingTime,
  stopTimer
};
