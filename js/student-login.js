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
        
        // Search by studentId, phone, whatsapp, or admNo
        const q1 = query(studentsRef, where("studentId", "==", loginId));
        const q2 = query(studentsRef, where("phone", "==", loginId));
        const q3 = query(studentsRef, where("whatsapp", "==", loginId));
        const q4 = query(studentsRef, where("admNo", "==", loginId));

        const [snap1, snap2, snap3, snap4] = await Promise.all([
          getDocs(q1),
          getDocs(q2),
          getDocs(q3),
          getDocs(q4)
        ]);

        let matchedStudent = null;

        const checkDoc = (docSnap) => {
          if (!matchedStudent) {
            matchedStudent = { id: docSnap.id, ...docSnap.data() };
          }
        };

        snap1.forEach(checkDoc);
        snap2.forEach(checkDoc);
        snap3.forEach(checkDoc);
        snap4.forEach(checkDoc);

        if (matchedStudent) {
          // Check admission status - students must be accepted to enter the portal
          const admissionStatus = (matchedStudent.admissionStatus || '').toLowerCase();
          const hasAdmissionDate = matchedStudent.admissionDate && matchedStudent.admissionDate.trim() !== '' && matchedStudent.admissionDate !== '-';
          const isAccepted = admissionStatus === 'accepted' || (!matchedStudent.admissionStatus && hasAdmissionDate);

          if (!isAccepted) {
            showError("Admission Pending: Your admission application has not been accepted yet. You can access the student portal once your admission is approved by administration.");
            return;
          }

          if (matchedStudent.status === 'inactive' || matchedStudent.status === 'suspended') {
            showError("Your account is currently inactive. Please contact administration.");
            return;
          }

          sessionStorage.setItem('currentStudentId', matchedStudent.id);
          window.location.href = 'student-dashboard.html';
        } else {
          showError("Invalid Abrar ID or Mobile Number.");
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
