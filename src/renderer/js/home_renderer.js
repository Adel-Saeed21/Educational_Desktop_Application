window.api.getUsername().then(({ currentUser }) => {
  document.getElementById('username').innerText = `Welcome, ${currentUser}`;
});

function logout() {
  location.href = 'login_screen.html';
}

function getCourseList() {
  window.api.getCourseList().then(response => {
    if (response.success) {
      const courseList = document.getElementById('courseList');
      courseList.innerHTML = ''; // Clear existing courses  
      response.courses.forEach(course => {
        const courseCard = document.createElement('div');
        courseCard.classList.add('course-card');
        courseCard.innerHTML = `
          <h2>${course.name}</h2>
          <p><strong>Instructor:</strong> ${course.instructor_name}</p>
          <p><strong>Level:</strong> ${course.level}</p>
          <button class="enrollButton">Go</button>
        `;
        courseList.appendChild(courseCard);
      });
    } else {
      console.error('Failed to fetch course list:', response.message);
    }
  });
}
window.addEventListener('DOMContentLoaded', () => {
  getCourseList();
});



  // القائمة اللي فيها الكورسات
  // const courses = [
  //   { title: "📘 Math Course", code: "Math101", level: 2 ,Instructor:"Adel Saeed"},
  //   { title: "🧪 Chemistry Course", code: "Chem202", level: 3 ,Instructor:"Adel Saeed"},
  //   { title: "💻 Programming Basics", code: "CS100", level: 1 ,Instructor:"Adel Saeed"},
  //   { title: "🧬 Biology Course", code: "Bio111", level: 2 ,Instructor:"Adel Saeed"}
  // ];

  // const courseList = document.getElementById("courseList");

  // courses.forEach(course => {
  //   // إنشاء العنصر
  //   const card = document.createElement("div");
  //   card.classList.add("course-card");

  //   // تعبئة المحتوى
  //   card.innerHTML = `
  //     <h2>${course.title}</h2>
  //     <p><strong>Instructor:</strong> ${course.Instructor}</p>
  //     <p><strong>Code:</strong> ${course.code}</p>
  //     <p><strong>Level:</strong> ${course.level}</p>
  //     <button class="enrollButton">Go</button>
  //   `;

  //   // إضافة للكورس ليست
  //   courseList.appendChild(card);
  // });
