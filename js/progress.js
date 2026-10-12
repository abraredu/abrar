import { toast } from './toast.js';
import { db } from './firebase-config.js';
import { collection, query, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
  const tableBody = document.getElementById('adminReportsTableBody');
  const filterMonth = document.getElementById('filterMonth');
  const filterStudent = document.getElementById('filterStudent');
  let allReports = [];

  // Set default month to current month
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  filterMonth.value = currentMonth;

  async function loadReports() {
    tableBody.innerHTML = '<tr><td colspan="5" style="padding: 2rem; text-align: center; color: var(--color-text-secondary);">Loading reports...</td></tr>';
    try {
      const q = query(collection(db, "progress_reports"));
      const snap = await getDocs(q);
      allReports = [];
      snap.forEach(doc => allReports.push({ id: doc.id, ...doc.data() }));
      
      // Sort by updated descending
      allReports.sort((a, b) => {
        let t1 = a.updatedAt?.toMillis() || a.createdAt?.toMillis() || 0;
        let t2 = b.updatedAt?.toMillis() || b.createdAt?.toMillis() || 0;
        return t2 - t1;
      });
      renderTable();
    } catch (error) {
      console.error("Error fetching reports:", error);
      tableBody.innerHTML = '<tr><td colspan="5" style="padding: 2rem; text-align: center; color: var(--color-danger);">Error loading reports.</td></tr>';
    }
  }

  function renderTable() {
    const month = filterMonth.value;
    const search = filterStudent.value.toLowerCase();

    const filtered = allReports.filter(r => {
      let matchMonth = !month || r.reportMonth === month;
      let matchSearch = !search || (r.studentName && r.studentName.toLowerCase().includes(search));
      return matchMonth && matchSearch;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" style="padding: 2rem; text-align: center; color: var(--color-text-secondary);">No reports found matching criteria.</td></tr>';
      return;
    }

    let html = '';
    filtered.forEach((r, idx) => {
      const dateObj = new Date(r.reportMonth + '-01');
      const monthName = dateObj.toLocaleString('default', { month: 'short', year: 'numeric' });
      
      const conducted = r.attendance?.conducted || 0;
      const attended = r.attendance?.attended || 0;
      const pct = conducted > 0 ? Math.round((attended/conducted)*100) + '%' : '-';

      html += `
        <tr style="border-bottom: 1px solid var(--color-border);">
          <td style="padding: 1rem; font-weight: 500;">${r.studentName || '-'}</td>
          <td style="padding: 1rem;">${monthName}</td>
          <td style="padding: 1rem; color: var(--color-text-secondary);">${r.tutorName || '-'}</td>
          <td style="padding: 1rem;">${pct} (${attended}/${conducted})</td>
          <td style="padding: 1rem;">
            <button class="btn btn-outline btn-print-report" data-idx="${idx}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">
              <i data-lucide="download" style="width: 14px; height: 14px;"></i> PDF
            </button>
          </td>
        </tr>
      `;
    });
    tableBody.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();

    // Attach print events
    const btns = tableBody.querySelectorAll('.btn-print-report');
    btns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = btn.getAttribute('data-idx');
        await handlePrint(filtered[idx], btn);
      });
    });
  }

  filterMonth.addEventListener('change', renderTable);
  filterStudent.addEventListener('input', renderTable);

  await loadReports();

  async function handlePrint(report, btn) {
    if (!report) return;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader" class="animate-spin" style="width:14px; height:14px;"></i>';
    btn.disabled = true;

    // Populate hidden report
    document.getElementById('vStudentName').innerText = report.studentName || '-';
    const courseEl = document.getElementById('vCourse'); if(courseEl) courseEl.innerText = report.courseType || '-';
    const mentorEl = document.getElementById('vMentor'); if(mentorEl) mentorEl.innerText = report.tutorName || '-';
    const dateObj = new Date(report.reportMonth + '-01');
    const monthName = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
    document.getElementById('vReportMonth').innerText = monthName;
    
    const conducted = parseInt(report.attendance?.conducted || 0);
    const attended = parseInt(report.attendance?.attended || 0);
    document.getElementById('vClassesConducted').innerText = conducted;
    document.getElementById('vClassesAttended').innerText = attended;
    const pctEl = document.getElementById('vAttendancePct');
    if(pctEl) pctEl.innerText = conducted > 0 ? Math.round((attended/conducted)*100) + '%' : '-';
    
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
        topicsList.innerHTML = splitTopics.map(t => \`<div class="topic-item"><span class="topic-bullet">&bull;</span> <span>\${t}</span></div>\`).join('');
      } else {
        topicsList.innerHTML = \`<div class="topic-item"><span class="topic-bullet">&bull;</span> <span>\${topics}</span></div>\`;
      }
    }
    
    document.getElementById('vRemarks').innerText = report.remarks?.mentorRemarks || '-';
    document.getElementById('vRecommendations').innerText = report.remarks?.recommendations || '-';

    const reportEl = document.getElementById('printableReport');
    reportEl.style.display = 'block';
    reportEl.style.position = 'absolute';
    reportEl.style.left = '-9999px';
    reportEl.style.width = '794px';

    try {
      if (!window.html2canvas || !window.jspdf) {
        throw new Error("PDF libraries not loaded yet");
      }
      
      const canvas = await html2canvas(reportEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f8fafc',
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = (canvas.height * contentWidth) / canvas.width;

      let yOffset = 0;
      let remainingHeight = contentHeight;
      let isFirstPage = true;

      while (remainingHeight > 0) {
        if (!isFirstPage) pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, margin - yOffset, contentWidth, contentHeight);
        yOffset += (pageHeight - margin * 2);
        remainingHeight -= (pageHeight - margin * 2);
        isFirstPage = false;
      }

      pdf.save(\`Progress_Report_\${report.studentName || 'Student'}.pdf\`);
    } catch (error) {
      console.error('PDF generation failed:', error);
      toast.error('Failed to generate PDF.');
    } finally {
      reportEl.style.display = 'none';
      reportEl.style.position = '';
      reportEl.style.left = '';
      reportEl.style.width = '';
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
});
