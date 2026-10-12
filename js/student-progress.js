import { db } from './firebase-config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
  // Check if logged in
  const studentId = sessionStorage.getItem('currentStudentId');
  if (!studentId) {
    window.location.href = 'student-login.html';
    return;
  }

  // Handle Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('currentStudentId');
      window.location.href = 'student-login.html';
    });
  }

  const grid = document.getElementById('reportsGrid');
  const modal = document.getElementById('reportModal');
  const closeBtn = document.getElementById('closeModalBtn');
  
  // Close modal logic
  closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });

  try {
    const q = query(collection(db, "progress_reports"), where("studentId", "==", studentId));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      grid.innerHTML = '<p style="color: var(--color-text-secondary); grid-column: 1/-1;">No progress reports found yet.</p>';
      return;
    }
    
    let reports = [];
    snap.forEach(doc => reports.push({ id: doc.id, ...doc.data() }));
    
    // Sort by month (descending)
    reports.sort((a, b) => b.reportMonth.localeCompare(a.reportMonth));
    
    let html = '';
    reports.forEach((report, index) => {
      // Format month e.g. "2026-08" -> "August 2026"
      const dateObj = new Date(report.reportMonth + '-01');
      const monthName = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
      
      html += `
        <div class="report-card" data-index="${index}">
          <div class="report-card-header">
            <div class="report-month">${monthName}</div>
            <i data-lucide="file-text" style="color: var(--color-primary);"></i>
          </div>
          <div class="report-tutor">
            <i data-lucide="user" style="width: 14px; height: 14px;"></i>
            Tutor: ${report.tutorName || '-'}
          </div>
          <div style="margin-top: auto; color: var(--color-primary); font-size: 0.875rem; font-weight: 500; display: flex; align-items: center; gap: 0.25rem;">
            View Report <i data-lucide="arrow-right" style="width: 14px; height: 14px;"></i>
          </div>
        </div>
      `;
    });
    
    grid.innerHTML = html;
    if (window.lucide) lucide.createIcons();
    
    // Attach click events
    grid.querySelectorAll('.report-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = card.getAttribute('data-index');
        const report = reports[idx];
        
        // Populate Modal
        document.getElementById('vStudentName').textContent = report.studentName;
        document.getElementById('vCourse').textContent = report.courseType || 'MADRASA ONE TO ONE';
        document.getElementById('vMentor').textContent = report.tutorName || '-';
        
        const dObj = new Date(report.reportMonth + '-01');
        const formattedMonth = dObj.toLocaleString('default', { month: 'long', year: 'numeric' });
        document.getElementById('vReportMonth').textContent = formattedMonth;
        
        const conducted = parseInt(report.attendance?.conducted || 0);
        const attended = parseInt(report.attendance?.attended || 0);
        document.getElementById('vClassesConducted').textContent = conducted;
        document.getElementById('vClassesAttended').textContent = attended;
        document.getElementById('vAttendancePct').textContent = conducted > 0 ? Math.round((attended/conducted)*100) + '%' : '-';
        
        const getStarsAndRemark = (rating) => {
          rating = (rating || '').toLowerCase();
          if (rating.includes('excellent') || rating.includes('very good')) {
            return { stars: '★★★★☆', remark: 'VERY GOOD', cls: '' };
          } else if (rating.includes('good') || rating.includes('satisfactory')) {
            return { stars: '★★★☆☆', remark: 'GOOD', cls: '' };
          } else if (rating.includes('poor') || rating.includes('improve')) {
            return { stars: '★★☆☆☆', remark: 'NEED IMPROVEMENT', cls: 'needs-imp' };
          }
          return { stars: '★★★★☆', remark: 'VERY GOOD', cls: '' };
        };

        const setRatingRow = (idPrefix, ratingVal) => {
           const info = getStarsAndRemark(ratingVal);
           const starsEl = document.getElementById(idPrefix + 'Stars');
           const remarkEl = document.getElementById(idPrefix + 'Remark');
           if (starsEl) starsEl.textContent = info.stars;
           if (remarkEl) {
             remarkEl.textContent = info.remark;
             remarkEl.className = 'remark-pill ' + info.cls;
           }
        };

        setRatingRow('vLiveClass', report.ratings?.liveClassPerformance);
        setRatingRow('vLessonProgress', report.ratings?.lessonProgress);
        setRatingRow('vRevision', report.ratings?.revisionHomework);
        setRatingRow('vActivities', report.ratings?.classActivities);
        
        const topicsList = document.getElementById('vTopicsList');
        if (topicsList) {
          const topics = report.remarks?.topicsCovered || '-';
          const splitTopics = topics.split('\\n').filter(t => t.trim() !== '');
          if (splitTopics.length > 0) {
            topicsList.innerHTML = splitTopics.map(t => `<div class="topic-item"><span class="topic-bullet">&bull;</span> <span>${t}</span></div>`).join('');
          } else {
            topicsList.innerHTML = `<div class="topic-item"><span class="topic-bullet">&bull;</span> <span>${topics}</span></div>`;
          }
        }
        
        document.getElementById('vRemarks').textContent = report.remarks?.mentorRemarks || '-';
        document.getElementById('vRecommendations').textContent = report.remarks?.recommendations || '-';
        
        modal.classList.add('active');
      });
    });
    
  } catch (err) {
    console.error("Error loading reports:", err);
    grid.innerHTML = '<p style="color: var(--color-danger); grid-column: 1/-1;">Error loading reports.</p>';
  }
});
