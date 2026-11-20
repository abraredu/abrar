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
      
      const conducted = parseInt(report.attendance?.conducted || 0, 10);
      const attended = parseInt(report.attendance?.attended || 0, 10);
      const isIndiv = Boolean(report.attendance?.isIndividual);
      const attSummary = isIndiv
        ? `${conducted} Classes Conducted`
        : `${attended}/${conducted} Attended (${conducted > 0 ? Math.round((attended / conducted) * 100) : 0}%)`;

      html += `
        <div class="report-card" data-index="${index}">
          <div class="report-card-accent"></div>
          <div class="report-card-body">
            <div class="report-card-header">
              <div>
                <div class="report-month">${monthName}</div>
                <span class="report-sub-badge">${isIndiv ? '1-on-1 Individual' : 'Monthly Report'}</span>
              </div>
              <div class="report-card-icon">
                <i data-lucide="file-check-2" style="width: 20px; height: 20px;"></i>
              </div>
            </div>
            <div class="report-meta-strip">
              <div class="report-tutor">
                <i data-lucide="user" style="width: 14px; height: 14px; color: #087A42;"></i>
                <span>Tutor: ${report.tutorName || '-'}</span>
              </div>
              <div class="report-tutor" style="color: #64748b; font-weight: 500;">
                <i data-lucide="calendar-check" style="width: 14px; height: 14px; color: #087A42;"></i>
                <span>${attSummary}</span>
              </div>
            </div>
            <div class="report-card-cta">
              <span>View Progress Report</span>
              <i data-lucide="arrow-right" style="width: 15px; height: 15px;"></i>
            </div>
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
        const isIndiv = Boolean(report.attendance?.isIndividual);
        const attended = isIndiv ? conducted : parseInt(report.attendance?.attended || 0);
        document.getElementById('vClassesConducted').textContent = conducted;
        const attEl = document.getElementById('vClassesAttended');
        const pctEl = document.getElementById('vAttendancePct');
        attEl.textContent = attended;
        pctEl.textContent = conducted > 0 ? Math.round((attended/conducted)*100) + '%' : '-';
        const attBox = attEl.closest('.att-box');
        const pctBox = pctEl.closest('.att-box');
        const attWrap = attEl.closest('.attendance-boxes');
        if (attBox) attBox.style.display = isIndiv ? 'none' : '';
        if (pctBox) pctBox.style.display = isIndiv ? 'none' : '';
        if (attWrap) {
          attWrap.style.gridTemplateColumns = isIndiv ? '1fr' : '';
          attWrap.classList.toggle('is-individual', isIndiv);
        }
        
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
