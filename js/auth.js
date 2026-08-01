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
        const q = query(collection(db, 'tutors'), where('loginUsername', '==', email));
        const querySnapshot = await getDocs(q);
        
        let tutorMatched = false;
        querySnapshot.forEach((doc) => {
          const tutorData = doc.data();
          if (tutorData.loginPassword === password && tutorData.status === 'active') {
            tutorMatched = true;
            localStorage.setItem('tutorLoggedIn', 'true');
            localStorage.setItem('tutorId', doc.id);
            localStorage.setItem('tutorName', tutorData.name);
          }
        });
        
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
      
      // If not a tutor, attempt firebase admin login
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = 'dashboard.html';
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed: Invalid credentials');
      btn.textContent = originalText;
      btn.disabled = false;
    }
  });
}

// Global Auth State Observer
// Only redirect to index.html if we are NOT already on it
onAuthStateChanged(auth, (user) => {
  const isLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('abrar-main/');
  const isTutorDashboard = window.location.pathname.endsWith('tutor-dashboard.html');
  
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
      if (isTutorDashboard && localStorage.getItem('tutorLoggedIn')) {
        // Allow tutor to stay on tutor dashboard
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
