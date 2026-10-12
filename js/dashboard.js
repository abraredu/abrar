// js/dashboard.js
import { db } from './firebase-config.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
  const activeStudentsEl = document.getElementById('dashActiveStudents');
  const monthCollectionEl = document.getElementById('dashMonthCollection');
  const activeTutorsEl = document.getElementById('dashActiveTutors');
  const pendingFeesEl = document.getElementById('dashPendingFees');
  const pendingTitleEl = document.getElementById('dashPendingTitle');
  const recentActivitiesList = document.getElementById('recentActivitiesList');

  const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
  const auth = getAuth();
  
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        // 1. Fetch Students
        const studentsQ = query(collection(db, "students"), where("status", "==", "active"));
        const studentsSnap = await getDocs(studentsQ);
        const activeStudents = [];
        studentsSnap.forEach(doc => activeStudents.push({ id: doc.id, ...doc.data() }));
        if (activeStudentsEl) activeStudentsEl.textContent = activeStudents.length;

        // 2. Fetch Tutors
        const tutorsQ = query(collection(db, "tutors"), where("status", "==", "active"));
        const tutorsSnap = await getDocs(tutorsQ);
        if (activeTutorsEl) activeTutorsEl.textContent = tutorsSnap.size;

        // 3. Fetch Payments for this month (for pending/overdue calc)
        const paymentsQ = query(collection(db, "payments"), where("billingMonth", "==", currentMonth));
        const paymentsSnap = await getDocs(paymentsQ);
        const currentPayments = [];
        paymentsSnap.forEach(doc => currentPayments.push(doc.data()));

        let totalPending = 0;
        let totalOverdue = 0;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const currMonthIdx = today.getMonth();
        const currYear = today.getFullYear();

        activeStudents.forEach(student => {
          const monthlyFee = student.monthlyFee || 0;
          
          const studentPayments = currentPayments.filter(p => p.studentId === student.id);
          const actualPaid = studentPayments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
          const waived = studentPayments.reduce((sum, p) => sum + (p.waivedAmount || 0), 0);
          const totalCredited = actualPaid + waived;
          
          const balance = Math.max(0, monthlyFee - totalCredited);
          
          if (balance > 0) {
            totalPending += balance;
            
            // Check if overdue
            const baseDateStr = student.classStartingDate || student.admissionDate;
            if (baseDateStr) {
              const baseDate = new Date(baseDateStr);
              if (!isNaN(baseDate.getTime())) {
                const daysSinceJoined = (today.getTime() - baseDate.getTime()) / (1000 * 3600 * 24);
                if (daysSinceJoined >= 28) {
                  const dueDay = baseDate.getDate();
                  const currentMonthDueDate = new Date(currYear, currMonthIdx, dueDay);
                  const diffTime = currentMonthDueDate.getTime() - today.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  
                  if (diffDays < 0) {
                    totalOverdue += balance;
                  }
                }
              }
            }
          }
        });

        // 4. Update Pending/Overdue UI
        if (pendingFeesEl && pendingTitleEl) {
          if (totalOverdue > 0) {
            pendingTitleEl.textContent = 'Overdue Fees';
            pendingFeesEl.textContent = formatter.format(totalOverdue);
          } else {
            pendingTitleEl.textContent = 'Pending Fees';
            pendingFeesEl.textContent = formatter.format(totalPending);
          }
        }

        
        // 5. Month Collection
        const txQ = query(collection(db, "transactions")); 
        const txSnap = await getDocs(txQ);
        let collectedThisMonth = 0;
        
        txSnap.forEach(doc => {
          const t = doc.data();
          if (t.type === 'income' && t.date && t.date.startsWith(currentMonth)) {
            collectedThisMonth += (t.amount || 0);
          }
        });
        
        if (monthCollectionEl) monthCollectionEl.textContent = formatter.format(collectedThisMonth);

        // 6. Recent Progress Reports
        const reportsQ = query(collection(db, "progress_reports"));
        const reportsSnap = await getDocs(reportsQ);
        let allReports = [];
        reportsSnap.forEach(doc => {
          allReports.push({ id: doc.id, ...doc.data() });
        });
        
        window.allDashboardReports = allReports; // store globally for the modal

        const recentActivitiesList = document.getElementById('recentActivitiesList');
        if (recentActivitiesList) {
          // Sort by creation or month (assume they have reportMonth)
          allReports.sort((a, b) => {
            const dateA = a.createdAt ? a.createdAt.toMillis() : (a.reportMonth || '');
            const dateB = b.createdAt ? b.createdAt.toMillis() : (b.reportMonth || '');
            if (dateA === dateB) return 0;
            return dateA < dateB ? 1 : -1;
          });
          
          const recentReports = allReports.slice(0, 4);
          
          if (recentReports.length === 0) {
            recentActivitiesList.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--color-text-secondary); grid-column: 1 / -1;">No recent reports found.</div>';
          } else {
            recentActivitiesList.innerHTML = recentReports.map(report => {
              const date = new Date(report.reportMonth + '-01');
              const monthStr = date.toLocaleString('default', { month: 'long', year: 'numeric' }) || report.reportMonth;
              return `
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
                  <a href="#" class="view-report-btn" data-id="${report.id}" style="color: #0d9488; text-decoration: none; font-weight: 500; display: inline-flex; align-items: center; gap: 0.25rem;">
                    View Report <i data-lucide="arrow-right" style="width: 16px; height: 16px;"></i>
                  </a>
                </div>
              `;
            }).join('');
            if (window.lucide) lucide.createIcons();
          }
        }
} catch (error) {
        console.error("Error loading dashboard data:", error);
        if (activeStudentsEl) activeStudentsEl.textContent = 'Error';
        if (activeTutorsEl) activeTutorsEl.textContent = 'Error';
        if (monthCollectionEl) monthCollectionEl.textContent = 'Error';
        if (pendingFeesEl) pendingFeesEl.textContent = 'Error';
      }
    }
  });

  // Setup Report Modal Logic
  setTimeout(() => {
    const modal = document.getElementById('reportModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    const printableReport = document.getElementById('printableReport');
    const dataGrid = document.getElementById('recentActivitiesList');
    
    if (dataGrid && modal) {
      dataGrid.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.view-report-btn');
        if (viewBtn) {
          e.preventDefault();
          const reportId = viewBtn.getAttribute('data-id');
          const report = (window.allDashboardReports || []).find(r => r.id === reportId);
          if (report) {
            window.currentReportStudent = report.studentName || 'Student';
            
            if(document.getElementById('vStudentName')) document.getElementById('vStudentName').innerText = report.studentName || '-';
            if(document.getElementById('vCourse')) document.getElementById('vCourse').innerText = report.courseName || report.course || '-';
            if(document.getElementById('vMentor')) document.getElementById('vMentor').innerText = report.tutorName || '-';
            if(document.getElementById('vReportMonth')) document.getElementById('vReportMonth').innerText = report.reportMonth || '-';
            if(document.getElementById('vClassesConducted')) document.getElementById('vClassesConducted').innerText = report.classesConducted || '0';
            if(document.getElementById('vClassesAttended')) document.getElementById('vClassesAttended').innerText = report.classesAttended || '0';
            
            let pct = 0;
            if (report.classesConducted > 0) {
              pct = Math.round((report.classesAttended / report.classesConducted) * 100);
            }
            if(document.getElementById('vAttendancePct')) document.getElementById('vAttendancePct').innerText = pct + '%';
            
            const setRow = (id, val) => {
              if (document.getElementById(id)) document.getElementById(id).innerText = val || '-';
            };
            
            setRow('vLiveClassRemark', report.liveClassPerf);
            setRow('vLessonProgressRemark', report.lessonProgress);
            setRow('vRevisionRemark', report.revisionHomework);
            setRow('vActivitiesRemark', report.classActivities);
            
            const topicsList = document.getElementById('vTopicsList');
            if (topicsList) {
              const topics = report.topicsCovered || '-';
              const splitTopics = topics.split('\n').filter(t => t.trim() !== '');
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
              pdf.addImage(imgData, 'PNG', margin, margin - yOffset, contentWidth, contentHeight);
              yOffset += (pageHeight - margin * 2);
              remainingHeight -= (pageHeight - margin * 2);
              isFirstPage = false;
            }
            pdf.save(`Progress_Report_${window.currentReportStudent}.pdf`);
          } catch (error) {
            console.error('PDF generation failed:', error);
            alert('Failed to generate PDF.');
          } finally {
            downloadPdfBtn.disabled = false;
            downloadPdfBtn.innerHTML = '<i data-lucide="download"></i> Download PDF';
            if (window.lucide) lucide.createIcons();
          }
        });
      }
    }
  }, 500);

});