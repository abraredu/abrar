// js/assessments.js
import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('assessmentsTableBody');
  const statTotal = document.getElementById('statTotal');
  const statWarning = document.getElementById('statWarning');
  const statDanger = document.getElementById('statDanger');
  
  if (!tbody) return;
  
  const auth = getAuth();
  
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        // Pre-fetch classes for level and time
        const classesSnapshot = await getDocs(collection(db, "classes"));
        const classesData = {};
        classesSnapshot.forEach(doc => {
          classesData[doc.id] = doc.data();
        });

        // Pre-fetch tutors for name mapping
        const tutorsSnapshot = await getDocs(collection(db, "tutors"));
        const tutorsData = {};
        tutorsSnapshot.forEach(doc => {
          tutorsData[doc.id] = doc.data();
        });

        // Fetch students (only active)
        const q = query(collection(db, "students"), where("status", "==", "active"));
        const snapshot = await getDocs(q);
        
        let allStudents = [];
        const now = new Date();
        const WARNING_DAYS = 15; // Show warning if assessment is due in 15 days
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          let startDateObj = null;
          
          if (data.classStartingDate) {
            startDateObj = new Date(data.classStartingDate);
          } else if (data.admissionDate) {
            startDateObj = new Date(data.admissionDate);
          }
          
          let nextAssessmentDate = null;
          let daysLeft = 0;
          let progressPercent = 0;
          let statusCategory = 'safe';
          
          if (startDateObj && !isNaN(startDateObj.getTime())) {
            // Find next assessment date (every 3 months from start date)
            // 4 assessments a year
            const monthsDiff = (now.getFullYear() - startDateObj.getFullYear()) * 12 + (now.getMonth() - startDateObj.getMonth());
            const periodsPassed = Math.floor(Math.max(0, monthsDiff) / 3);
            
            nextAssessmentDate = new Date(startDateObj);
            nextAssessmentDate.setMonth(nextAssessmentDate.getMonth() + ((periodsPassed + 1) * 3));
            
            const prevAssessmentDate = new Date(startDateObj);
            prevAssessmentDate.setMonth(prevAssessmentDate.getMonth() + (periodsPassed * 3));
            
            const totalPeriodDuration = nextAssessmentDate.getTime() - prevAssessmentDate.getTime();
            const timePassed = now.getTime() - prevAssessmentDate.getTime();
            
            progressPercent = Math.min(100, Math.max(0, (timePassed / totalPeriodDuration) * 100));
            
            const msLeft = nextAssessmentDate.getTime() - now.getTime();
            daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
            
            if (daysLeft < 0) {
              statusCategory = 'danger';
              progressPercent = 100;
            } else if (daysLeft <= WARNING_DAYS) {
              statusCategory = 'warning';
            } else {
              statusCategory = 'safe';
            }
          }

          allStudents.push({ 
            id: doc.id, 
            ...data, 
            nextAssessmentDate, 
            daysLeft, 
            progressPercent, 
            statusCategory 
          });
        });

        const searchInput = document.getElementById('searchInput');
        const sortFilter = document.getElementById('sortFilter');
        const statusFilter = document.getElementById('statusFilter');
        
        const renderTable = (students) => {
          let total = students.length;
          let warningCount = 0;
          let dangerCount = 0;
          
          tbody.innerHTML = '';
          
          if (students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No students found.</td></tr>';
            statTotal.textContent = 0;
            statWarning.textContent = 0;
            statDanger.textContent = 0;
            return;
          }

          students.forEach((data) => {
            if (data.statusCategory === 'warning') warningCount++;
            if (data.statusCategory === 'danger') dangerCount++;
            
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #f1f5f9';
            tr.style.transition = 'background-color 0.2s';
            tr.onmouseenter = () => tr.style.backgroundColor = '#f8fafc';
            tr.onmouseleave = () => tr.style.backgroundColor = 'transparent';
            
            // Determine Level and Tutors
            let levelStrs = [];
            let tutorNames = [];

            if (data.courses && Array.isArray(data.courses) && data.courses.length > 0) {
               data.courses.forEach(courseName => {
                  let str = courseName;
                  if (data.level) str += ` (Lvl: ${data.level})`;
                  levelStrs.push(`<div style="margin-bottom: 4px;">${str}</div>`);
                  
                  let tId = (data.courseTutors && data.courseTutors[courseName]) ? data.courseTutors[courseName] : null;
                  let tName = tId || '-';
                  if (tId && tutorsData[tId]) tName = tutorsData[tId].name || tId;
                  tutorNames.push(`<div style="margin-bottom: 4px;">${tName}</div>`);
               });
            } else {
               let singleLevelStr = data.course || data.courseType || '-';
               if (data.level && singleLevelStr !== '-') {
                  singleLevelStr += ` (Lvl: ${data.level})`;
               } else if (data.courseType === 'madrasa_individual') {
                  singleLevelStr = data.level ? `One-to-One (Lvl: ${data.level})` : 'One-to-One';
               } else if (data.courseType === 'quran_recitation') {
                  singleLevelStr = data.level ? `Qur'an (Lvl: ${data.level})` : 'Qur\'an';
               } else if (data.courseType === 'madrasa_group') {
                  singleLevelStr = data.level ? `Group Tuition (${data.level})` : 'Group Tuition';
               }
               
               if (data.classId && classesData[data.classId]) {
                  const cls = classesData[data.classId];
                  singleLevelStr = cls.className || cls.level || 'Group Tuition';
               }
               levelStrs.push(`<div>${singleLevelStr}</div>`);

               let activeTutorId = data.tutorId;
               if (!activeTutorId && data.courseTutors && Object.keys(data.courseTutors).length > 0) {
                  activeTutorId = Object.values(data.courseTutors)[0];
               }
               let singleTutorName = activeTutorId || '-';
               if (activeTutorId && tutorsData[activeTutorId]) {
                  singleTutorName = tutorsData[activeTutorId].name || activeTutorId;
               }
               tutorNames.push(`<div>${singleTutorName}</div>`);
            }

            let levelStr = levelStrs.join('');
            let tutorName = tutorNames.join('');
            
            // Format Dates and Timer
            let timerHtml = `<div style="color: #64748b; font-size: 0.875rem;">No Starting Date</div>`;
            let statusBadge = `<span class="status-badge" style="background:#f1f5f9;color:#64748b;">N/A</span>`;
            
            if (data.nextAssessmentDate) {
              const formattedNextDate = data.nextAssessmentDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
              let countdownText = `Due in ${data.daysLeft} days (${formattedNextDate})`;
              
              if (data.daysLeft === 0) countdownText = `Due today (${formattedNextDate})`;
              else if (data.daysLeft < 0) countdownText = `Overdue by ${Math.abs(data.daysLeft)} days (${formattedNextDate})`;
              
              timerHtml = `
                <div style="font-size: 0.875rem; font-weight: 500; color: #334155;">${countdownText}</div>
                <div class="timer-container">
                  <div class="timer-bar ${data.statusCategory}" style="width: ${data.progressPercent}%"></div>
                </div>
              `;
              
              if (data.statusCategory === 'safe') statusBadge = `<span class="status-badge status-safe">On Track</span>`;
              else if (data.statusCategory === 'warning') statusBadge = `<span class="status-badge status-warning">Due Soon</span>`;
              else if (data.statusCategory === 'danger') statusBadge = `<span class="status-badge status-danger" style="animation: pulse 2s infinite;">Overdue</span>`;
            }

            tr.innerHTML = `
              <td style="padding: 1rem 1.5rem; font-weight: 500; color: #0f172a;">
                <div style="display:flex; flex-direction:column;">
                  <span>${data.name || '-'}</span>
                  <span style="font-size:0.75rem; color:#64748b;">ID: ${data.studentId || '-'}</span>
                </div>
              </td>
              <td style="padding: 1rem 1.5rem; color: #475569;">${levelStr}</td>
              <td style="padding: 1rem 1.5rem; color: #475569;">${tutorName}</td>
              <td style="padding: 1rem 1.5rem; color: #475569;">${data.classStartingDate || data.admissionDate || '-'}</td>
              <td style="padding: 1rem 1.5rem;">${timerHtml}</td>
              <td style="padding: 1rem 1.5rem;">${statusBadge}</td>
              <td style="padding: 1rem 1.5rem;">
                <a href="../reports/progress.html?studentId=${data.id}" class="btn btn-outline" style="padding: 0.25rem 0.75rem; font-size: 0.75rem;">
                  Add / View Report
                </a>
              </td>
            `;
            tbody.appendChild(tr);
          });
          
          if(statTotal) statTotal.textContent = total;
          if(statWarning) statWarning.textContent = warningCount;
          if(statDanger) statDanger.textContent = dangerCount;
          lucide.createIcons();
        };

        const filterAndSortData = () => {
          const searchTerm = (searchInput ? searchInput.value : '').toLowerCase();
          const sortVal = sortFilter ? sortFilter.value : 'due_date_asc';
          const statusVal = statusFilter ? statusFilter.value : '';

          let filtered = allStudents.filter(student => {
            const matchesSearch = !searchTerm || 
              (student.name && student.name.toLowerCase().includes(searchTerm)) || 
              (student.studentId && student.studentId.toLowerCase().includes(searchTerm));
            
            const matchesStatus = !statusVal || student.statusCategory === statusVal;

            return matchesSearch && matchesStatus;
          });

          filtered.sort((a, b) => {
            if (sortVal === 'due_date_asc') {
              if (a.daysLeft === undefined) return 1;
              if (b.daysLeft === undefined) return -1;
              return a.daysLeft - b.daysLeft;
            } else if (sortVal === 'due_date_desc') {
              if (a.daysLeft === undefined) return 1;
              if (b.daysLeft === undefined) return -1;
              return b.daysLeft - a.daysLeft;
            } else if (sortVal === 'name_asc') {
              const nameA = (a.name || '').toLowerCase();
              const nameB = (b.name || '').toLowerCase();
              return nameA.localeCompare(nameB);
            }
            return 0;
          });

          renderTable(filtered);
        };

        if (searchInput) searchInput.addEventListener('input', filterAndSortData);
        if (sortFilter) sortFilter.addEventListener('change', filterAndSortData);
        if (statusFilter) statusFilter.addEventListener('change', filterAndSortData);

        // Add pulse animation keyframes dynamically
        const style = document.createElement('style');
        style.innerHTML = `
          @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
            70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
            100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
          }
        `;
        document.head.appendChild(style);

        filterAndSortData();
        
      } catch (error) {
        console.error("Error fetching students: ", error);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #ef4444;">Error loading assessments: ${error.message}</td></tr>`;
      }
    }
  });
});
