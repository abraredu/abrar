import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy, getDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
  const dataGrid = document.getElementById('dataGrid');
  const filterMonth = document.getElementById('filterMonth');
  const exportBtn = document.getElementById('exportDataBtn');
  
  let allReports = [];

  // Set default month to current month
  const today = new Date();
  filterMonth.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  async function loadData() {
    dataGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 2rem;">Loading data...</div>';
    
    try {
      allReports = [];
      const q = query(collection(db, "progress_reports"));
      const snapshot = await getDocs(q);
      
      snapshot.forEach(doc => {
        allReports.push({ id: doc.id, ...doc.data() });
      });

      renderTable();
    } catch (error) {
      console.error("Error loading reports:", error);
      dataGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #ef4444; padding: 2rem;">Error loading data.</div>';
    }
  }

  // Modal elements
  const modal = document.getElementById('reportModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');
  const printableReport = document.getElementById('printableReport');

  let currentReportStudent = "Student";

  // Handle View & Delete Button Clicks
  dataGrid.addEventListener('click', async (e) => {
    const delBtn = e.target.closest('.delete-report-btn');
    if (delBtn) {
      e.preventDefault();
      const reportId = delBtn.getAttribute('data-id');
      const report = allReports.find(r => r.id === reportId);
      const label = report ? `${report.studentName || 'this student'} (${report.reportMonth || ''})` : 'this report';
      if (!confirm(`Delete progress report for ${label}?`)) return;
      try {
        delBtn.disabled = true;
        await deleteDoc(doc(db, 'progress_reports', reportId));
        allReports = allReports.filter(r => r.id !== reportId);
        renderTable();
      } catch (err) {
        console.error('Error deleting report:', err);
        alert('Failed to delete report: ' + err.message);
        delBtn.disabled = false;
      }
      return;
    }

    const viewBtn = e.target.closest('.view-btn');
    if (viewBtn) {
      e.preventDefault();
      const reportId = viewBtn.getAttribute('data-id');
      const report = allReports.find(r => r.id === reportId);
      if (report) {
        currentReportStudent = report.studentName || 'Student';
        
        // Populate modern report template
        if(document.getElementById('vStudentName')) document.getElementById('vStudentName').innerText = report.studentName || '-';
        if(document.getElementById('vCourse')) document.getElementById('vCourse').innerText = report.courseName || report.course || '-';
        if(document.getElementById('vMentor')) document.getElementById('vMentor').innerText = report.tutorName || '-';
        if(document.getElementById('vReportMonth')) document.getElementById('vReportMonth').innerText = report.reportMonth || '-';
        const conductedVal = report.attendance?.conducted ?? report.classesConducted ?? 0;
        const isIndiv = Boolean(report.attendance?.isIndividual);
        const attendedVal = isIndiv ? conductedVal : (report.attendance?.attended ?? report.classesAttended ?? 0);
        if(document.getElementById('vClassesConducted')) document.getElementById('vClassesConducted').innerText = conductedVal;
        const attEl = document.getElementById('vClassesAttended');
        const pctEl = document.getElementById('vAttendancePct');
        if(attEl) attEl.innerText = attendedVal;
        
        let pct = 0;
        if (conductedVal > 0) {
          pct = Math.round((attendedVal / conductedVal) * 100);
        }
        if(pctEl) pctEl.innerText = pct + '%';
        const attBox = attEl ? attEl.closest('.att-box') : null;
        const pctBox = pctEl ? pctEl.closest('.att-box') : null;
        const attWrap = attEl ? attEl.closest('.attendance-boxes') : null;
        if (attBox) attBox.style.display = isIndiv ? 'none' : '';
        if (pctBox) pctBox.style.display = isIndiv ? 'none' : '';
        if (attWrap) attWrap.style.gridTemplateColumns = isIndiv ? '1fr' : '';
        
        const setRow = (id, val) => {
          if (document.getElementById(id)) document.getElementById(id).innerText = val || '-';
        };
        
        setRow('vLiveClass', report.liveClassPerf);
        setRow('vLessonProgress', report.lessonProgress);
        setRow('vRevision', report.revisionHomework);
        setRow('vActivities', report.classActivities);
        
        const topicsList = document.getElementById('vTopicsList');
        if (topicsList) {
          const topics = report.topicsCovered || '-';
          const splitTopics = topics.split('\\n').filter(t => t.trim() !== '');
          if (splitTopics.length > 0) {
            topicsList.innerHTML = splitTopics.map(t => `<div class="topic-item"><span class="topic-bullet">&bull;</span> <span>${t}</span></div>`).join('');
          } else {
            topicsList.innerHTML = `<div class="topic-item"><span class="topic-bullet">&bull;</span> <span>${topics}</span></div>`;
          }
        }
        
        if(document.getElementById('vRemarks')) document.getElementById('vRemarks').innerText = report.mentorRemarks || '-';
        if(document.getElementById('vRecommendations')) document.getElementById('vRecommendations').innerText = report.recommendations || '-';
        
        printableReport.style.display = 'block';
        modal.style.display = 'flex';
      }
    }
  });

  closeModalBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

  const printPdfBtn = document.getElementById('printPdfBtn');
  if (printPdfBtn) {
    printPdfBtn.addEventListener('click', () => {
      window.print();
    });
  }

  if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener('click', async () => {
      downloadPdfBtn.disabled = true;
      downloadPdfBtn.innerHTML = 'Generating...';
      try {
        const canvas = await html2canvas(printableReport, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
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
          pdf.addImage(
            imgData, 'PNG',
            margin,
            margin - yOffset,
            contentWidth,
            contentHeight
          );
          yOffset += (pageHeight - margin * 2);
          remainingHeight -= (pageHeight - margin * 2);
          isFirstPage = false;
        }

        pdf.save(`Progress_Report_${currentReportStudent}.pdf`);
      } catch (error) {
        console.error('PDF generation failed:', error);
        alert('Failed to generate PDF. Please try again.');
      } finally {
        downloadPdfBtn.disabled = false;
        downloadPdfBtn.innerHTML = '<i data-lucide="download"></i> Download PDF';
        if (window.lucide) lucide.createIcons();
      }
    });
  }

  function renderTable() {
    const selectedMonth = filterMonth.value;
    
    // Filter reports by selected month
    const filteredReports = selectedMonth 
      ? allReports.filter(r => r.reportMonth === selectedMonth)
      : allReports;
      
    if (filteredReports.length === 0) {
      dataGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--color-text-secondary);">No reports found for this month.</div>';
      return;
    }

    let html = '';
    filteredReports.forEach(report => {
      // Format month string (e.g. "2026-10" to "October 2026")
      const date = new Date(report.reportMonth + '-01');
      const monthStr = date.toLocaleString('default', { month: 'long', year: 'numeric' }) || report.reportMonth;
      
      html += `
        <div class="card" style="border: 1px solid var(--color-border); box-shadow: 0 2px 4px rgba(0,0,0,0.02); padding: 1.5rem; position: relative; border-radius: 12px; background: white;">
          
          <i data-lucide="file-text" style="position: absolute; top: 1.5rem; right: 1.5rem; color: #15803d; width: 24px; height: 24px;"></i>
          
          <h4 style="margin: 0 0 1rem 0; font-size: 1.4rem; color: #1e293b; font-weight: 600;">
            ${monthStr}
            <div style="font-size: 0.9rem; color: #0d9488; margin-top: 0.25rem;">${report.studentName || 'Student'}</div>
          </h4>
          
          <div style="display: flex; align-items: center; gap: 0.5rem; color: #64748b; font-size: 0.95rem; margin-bottom: 1.5rem;">
            <i data-lucide="user" style="width: 16px; height: 16px;"></i>
            <span>Tutor: <span style="text-transform: uppercase;">${report.tutorName || '-'}</span></span>
          </div>
          
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
            <a href="#" class="view-btn" data-id="${report.id}" style="color: #0d9488; text-decoration: none; font-weight: 500; display: inline-flex; align-items: center; gap: 0.25rem;">
              View Report <i data-lucide="arrow-right" style="width: 16px; height: 16px;"></i>
            </a>
            <button type="button" class="delete-report-btn" data-id="${report.id}" title="Delete Report" style="background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; border-radius: 8px; width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s;">
              <i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>
            </button>
          </div>
        </div>
      `;
    });
    
    dataGrid.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }

  filterMonth.addEventListener('change', renderTable);
  
  exportBtn.addEventListener('click', () => {
    const selectedMonth = filterMonth.value;
    const filteredReports = selectedMonth 
      ? allReports.filter(r => r.reportMonth === selectedMonth)
      : allReports;
      
    if (filteredReports.length === 0) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Student Name,Tutor,Course,Month,Classes Conducted,Classes Attended,Live Class Perf,Lesson Progress,Revision/Homework,Activities,Topics Covered,Remarks,Recommendations\n";
    
    filteredReports.forEach(row => {
      const student = `"${row.studentName || ''}"`;
      const tutor = `"${row.tutorName || ''}"`;
      const course = `"${row.courseName || row.course || ''}"`;
      const month = `"${row.reportMonth || ''}"`;
      const conducted = `"${row.classesConducted || ''}"`;
      const attended = `"${row.classesAttended || ''}"`;
      const live = `"${row.liveClassPerf || ''}"`;
      const prog = `"${row.lessonProgress || ''}"`;
      const rev = `"${row.revisionHomework || ''}"`;
      const act = `"${row.classActivities || ''}"`;
      const topics = `"${(row.topicsCovered || '').replace(/"/g, '""')}"`;
      const remarks = `"${(row.mentorRemarks || '').replace(/"/g, '""')}"`;
      const recs = `"${(row.recommendations || '').replace(/"/g, '""')}"`;
      
      csvContent += `${student},${tutor},${course},${month},${conducted},${attended},${live},${prog},${rev},${act},${topics},${remarks},${recs}\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `progress_reports_${selectedMonth || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  loadData();
});
