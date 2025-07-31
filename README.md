 🎓 Educational Desktop Application (Prototype)

This is a prototype for an Educational Desktop Application designed to support students during their exams and allow instructors to monitor and assess submissions efficiently.

 🚀 Planned Features

1. 🔐 Student Authentication
- Secure **login system** for students.
- Option to **reset password**.

 2. 🏠 Home Page
- Display current exam information.
- Show **countdown timer** for upcoming exams.

### 3. 📝 Exam Interface
- Built-in **exam timer** to limit duration.
- **Screen recording** during the exam to monitor student activity.
- Screen recordings are sent to a **web application** for instructors.
- Instructors can **review submissions**, check correct answers, and **send exam results** back to students.

### 4. 👤 Student Profile Page
- View student information.
- See exam history and results.

---

## 🛠 Technologies (Planned or Under Evaluation)
- **Electron** for cross-platform desktop app development.
- **Web Integration** for instructor review and result submission.
- **Secure file handling** and **data synchronization** between desktop and web.

---

## 📌 Notes
- This is an early-stage prototype.
- All features are under active development.
- Contributions and suggestions are welcome.

---
💾 How to Download & Run the App (Release)
✅ 1. Download the Release

Go to the Releases section on this GitHub repository and download the .deb file for Linux (e.g. educational-desktop-app_1.0.0_amd64.deb).

    💡 You can find the "Releases" tab near the top-right corner of the GitHub repo page.

✅ 2. Install the App (Linux)

After downloading the .deb file, run the following command to install:
 ```bash
 sudo dpkg -i educational-desktop-app_1.0.0_amd64.deb
```

If you face dependency issues, fix them with:

 ```bash
sudo apt --fix-broken install
```


🗑 4. Uninstall / Remove the App

To remove the app completely from your system:
```bash
sudo apt remove educational-desktop-app
sudo dpkg -r educational-desktop-app
```



To avoid errors when running the project after downloading:

1. Install all dependencies:
   ```bash
   npm install
if you don't have npm use this command or go to nodejs website and download it:
  ```bash
  sudo apt install npm
