import { toast } from './toast.js';
// js/auth.js
import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Handle Login Form
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const btn = loginForm.querySelector('button');
    const originalText = btn.textContent;
    
    try {
      btn.textContent = 'Signing in...';
      btn.disabled = true;

      // First check if it's a tutor login
      try {
        let tutorMatched = false;
        const normalizedInput = email.toLowerCase();
        const normalizedPassDigits = password.replace(/\D/g, '');

        const checkTutorMatch = (doc) => {
          const tutorData = doc.data();
          const tId = String(tutorData.tutorId || '').trim().toLowerCase();
          const tUser = String(tutorData.loginUsername || '').trim().toLowerCase();
          const tEmail = String(tutorData.email || '').trim().toLowerCase();
          const tPhone = String(tutorData.phone || '').trim();
          const tPhoneDigits = tPhone.replace(/\D/g, '');
          const tPass = String(tutorData.password || '').trim();

          const idMatch = (tId && tId === normalizedInput) ||
                          (tUser && tUser === normalizedInput) ||
                          (tEmail && tEmail === normalizedInput);
          const passMatch = (tPhone && tPhone === password) ||
                            (normalizedPassDigits && tPhoneDigits && tPhoneDigits.endsWith(normalizedPassDigits) && normalizedPassDigits.length >= 6) ||
                            (tPass && tPass === password);

          if (idMatch && passMatch && String(tutorData.status || 'active').toLowerCase() === 'active') {
            tutorMatched = true;
            localStorage.setItem('tutorLoggedIn', 'true');
            localStorage.setItem('tutorId', doc.id);
            localStorage.setItem('tutorName', tutorData.name || tutorData.tutorId || 'Tutor');
          }
        };

        // Fast exact queries first, then fallback scan for case-insensitive match
        const qId = query(collection(db, 'tutors'), where('tutorId', '==', email));
        const snapId = await getDocs(qId);
        snapId.forEach(checkTutorMatch);

        if (!tutorMatched) {
          const qIdUpper = query(collection(db, 'tutors'), where('tutorId', '==', email.toUpperCase()));
          const snapIdUpper = await getDocs(qIdUpper);
          snapIdUpper.forEach(checkTutorMatch);
        }

        if (!tutorMatched) {
          const qUser = query(collection(db, 'tutors'), where('loginUsername', '==', email));
          const snapUser = await getDocs(qUser);
          snapUser.forEach(checkTutorMatch);
        }

        if (!tutorMatched) {
          const allTutorsSnap = await getDocs(collection(db, 'tutors'));
          allTutorsSnap.forEach((doc) => {
            if (!tutorMatched) checkTutorMatch(doc);
          });
        }

        if (tutorMatched) {
          window.location.href = 'tutor-dashboard.html';
          return; // Stop execution, we are logged in as a tutor
        }
      } catch (err) {
        console.error("Error checking tutor login", err);
        if (err.code === 'permission-denied' || err.message.includes('permission')) {
          toast.error("Firestore Error: You don't have permission to read the database without being logged in. Please update your Firestore Rules in Firebase Console to allow unauthenticated reads for tutors.");
          btn.textContent = originalText;
          btn.disabled = false;
          return;
        }
      }

      // If input is not an email address, don't send an invalid request to Firebase Auth
      if (!email.includes('@')) {
        toast.error('Invalid tutor username or password.');
        btn.textContent = originalText;
        btn.disabled = false;
        return;
      }

      // Attempt Firebase admin login
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = 'dashboard.html';
    } catch (error) {
      console.error('Login error:', error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        toast.error('Invalid email or password. Please check your credentials.');
      } else {
        toast.error('Login failed: ' + (error.message || 'Invalid credentials'));
      }
      btn.textContent = originalText;
      btn.disabled = false;
    }
  });
}

// Global Auth State Observer
// Only redirect to index.html if we are NOT already on it
onAuthStateChanged(auth, (user) => {
  const isLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/');
  const isTutorPage = window.location.pathname.endsWith('tutor-dashboard.html') || window.location.pathname.endsWith('tutor-progress.html');
  
  if (user) {
    // If user is logged in and on login page, redirect to dashboard
    if (isLoginPage) {
      window.location.href = 'dashboard.html';
    }
    
    // Update UI with user info if elements exist
    const userNameEl = document.getElementById('userName');
    if (userNameEl) {
      userNameEl.textContent = user.displayName || user.email;
    }
  } else {
    // If user is not logged in and NOT on login page, redirect to login
    if (!isLoginPage) {
      if (isTutorPage && localStorage.getItem('tutorLoggedIn')) {
        // Allow tutor to stay on tutor pages
      } else {
        // Use relative path back to root index.html depending on current depth
        const depth = window.location.pathname.split('/').length - 2;
        const prefix = depth > 0 ? '../'.repeat(depth) : '';
        window.location.href = prefix + 'index.html';
      }
    } else {
      if (localStorage.getItem('tutorLoggedIn')) {
        window.location.href = 'tutor-dashboard.html';
      }
    }
  }
});

// Handle Logout
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await signOut(auth);
      // redirect handled by onAuthStateChanged
    } catch (error) {
      console.error('Logout error:', error);
    }
  });
}
