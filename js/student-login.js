import { db } from './firebase-config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  // If already logged in as a student, redirect to dashboard
  if (sessionStorage.getItem('currentStudentId')) {
    window.location.href = 'student-dashboard.html';
  }

  const loginForm = document.getElementById('studentLoginForm');
  const loginError = document.getElementById('loginError');
  const loginBtn = document.getElementById('loginBtn');
  
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const loginId = document.getElementById('loginId').value.trim();
      
      loginError.style.display = 'none';
      loginBtn.innerHTML = '<i data-lucide="loader" class="animate-spin" style="width: 16px; height: 16px;"></i><span> Signing In...</span>';
      lucide.createIcons();
      loginBtn.disabled = true;

      try {
        const studentsRef = collection(db, "students");
        
        // Search by studentId, phone, or whatsapp
        const q1 = query(studentsRef, where("studentId", "==", loginId));
        const q2 = query(studentsRef, where("phone", "==", loginId));
        const q3 = query(studentsRef, where("whatsapp", "==", loginId));

        const [snap1, snap2, snap3] = await Promise.all([
          getDocs(q1),
          getDocs(q2),
          getDocs(q3)
        ]);

        let authenticated = false;
        let studentDocId = null;

        const checkDoc = (doc) => {
          if (!authenticated) {
            authenticated = true;
            studentDocId = doc.id;
          }
        };

        snap1.forEach(checkDoc);
        snap2.forEach(checkDoc);
        snap3.forEach(checkDoc);

        if (authenticated && studentDocId) {
          sessionStorage.setItem('currentStudentId', studentDocId);
          window.location.href = 'student-dashboard.html';
        } else {
          showError();
        }

      } catch (error) {
        console.error("Login Error:", error);
        showError("An error occurred. Please try again.");
      }
    });
  }

  function showError(msg = "Invalid Abrar ID or Mobile Number.") {
    loginError.textContent = msg;
    loginError.style.display = 'block';
    loginBtn.innerHTML = '<span>Sign In</span>';
    loginBtn.disabled = false;
  }
});
