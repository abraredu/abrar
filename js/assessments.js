// js/assessments.js
import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
  const gridContainer = document.getElementById('assessmentsGrid');
  const divisionPillsBar = document.getElementById('divisionPillsBar');
  const statTotal = document.getElementById('statTotal');
  const statWarning = document.getElementById('statWarning');
  const statDanger = document.getElementById('statDanger');
  
  if (!gridContainer) return;
  
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
        
        const parseFlexibleDate = (raw) => {
          if (!raw) return null;
          const str = String(raw).trim();
          const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
          if (dmyMatch) {
            const day = parseInt(dmyMatch[1], 10);
            const month = parseInt(dmyMatch[2], 10) - 1;
            const year = parseInt(dmyMatch[3], 10);
            const d = new Date(year, month, day);
            return isNaN(d.getTime()) ? null : d;
          }
          const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
          if (ymdMatch) {
            const year = parseInt(ymdMatch[1], 10);
            const month = parseInt(ymdMatch[2], 10) - 1;
            const day = parseInt(ymdMatch[3], 10);
            const d = new Date(year, month, day);
            return isNaN(d.getTime()) ? null : d;
          }
          const fallback = new Date(str);
          return isNaN(fallback.getTime()) ? null : fallback;
        };

        snapshot.forEach((doc) => {
          const data = doc.data();
          let startDateObj = parseFlexibleDate(data.classStartingDate) || parseFlexibleDate(data.admissionDate);
          
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
        let activeDivision = 'all';

        const getStudentDivision = (s) => {
          if (s.division && String(s.division).trim()) return String(s.division).trim();
          if (s.level && String(s.level).trim()) {
            const lv = String(s.level).trim();
            return lv.toLowerCase().startsWith('class') ? lv : `Class ${lv}`;
          }
          if (s.classId && classesData[s.classId]) {
            return classesData[s.classId].className || classesData[s.classId].level || 'General';
          }
          return 'Unassigned';
        };

        const renderDivisionPills = () => {
          if (!divisionPillsBar) return;
          const counts = {};
          allStudents.forEach(s => {
            const div = getStudentDivision(s);
            counts[div] = (counts[div] || 0) + 1;
          });
          const divNames = Object.keys(counts).sort((a, b) => {
            if (a === 'Unassigned') return 1;
            if (b === 'Unassigned') return -1;
            return a.localeCompare(b, undefined, { numeric: true });
          });

          const pills = [
            `<button type="button" class="div-pill ${activeDivision === 'all' ? 'active' : ''}" data-div="all">All Divisions <span class="div-pill-count">${allStudents.length}</span></button>`
          ];
          divNames.forEach(d => {
            pills.push(`<button type="button" class="div-pill ${activeDivision === d ? 'active' : ''}" data-div="${d}">${d} <span class="div-pill-count">${counts[d]}</span></button>`);
          });
          divisionPillsBar.innerHTML = pills.join('');
        };

        if (divisionPillsBar) {
          divisionPillsBar.addEventListener('click', (e) => {
            const btn = e.target.closest('.div-pill');
            if (!btn) return;
            activeDivision = btn.getAttribute('data-div') || 'all';
            renderDivisionPills();
            filterAndSortData();
          });
        }
        
        const renderCards = (students) => {
          const total = students.length;
          let warningCount = 0;
          let dangerCount = 0;
          
          if (students.length === 0) {
            gridContainer.innerHTML = '<div style="text-align: center; padding: 3rem; color: #64748b; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0;">No students match the selected filters.</div>';
            if (statTotal) statTotal.textContent = 0;
            if (statWarning) statWarning.textContent = 0;
            if (statDanger) statDanger.textContent = 0;
            return;
          }

          // Group by division
          const groups = new Map();
          students.forEach(data => {
            if (data.statusCategory === 'warning') warningCount++;
            if (data.statusCategory === 'danger') dangerCount++;
            const divName = getStudentDivision(data);
            if (!groups.has(divName)) groups.set(divName, []);
            groups.get(divName).push(data);
          });

          const sortedDivs = Array.from(groups.keys()).sort((a, b) => {
            if (a === 'Unassigned') return 1;
            if (b === 'Unassigned') return -1;
            return a.localeCompare(b, undefined, { numeric: true });
          });

          const htmlParts = [];
          sortedDivs.forEach(divName => {
            const list = groups.get(divName);
            const cardsHtml = list.map(data => {
              let courseLabel = data.course || data.courseType || '-';
              if (data.courseType === 'madrasa_individual') courseLabel = 'Madrassa One-to-One';
              else if (data.courseType === 'quran_recitation') courseLabel = 'Tarteel (Qur\'an)';
              else if (data.courseType === 'madrasa_group') courseLabel = 'Madrassa Group';
              if (Array.isArray(data.courses) && data.courses.length > 0) courseLabel = data.courses.join(', ');

              let activeTutorId = data.tutorId;
              if (!activeTutorId && data.courseTutors && Object.keys(data.courseTutors).length > 0) {
                activeTutorId = Object.values(data.courseTutors)[0];
              }
              let tutorName = activeTutorId || '-';
              if (activeTutorId && tutorsData[activeTutorId]) {
                tutorName = tutorsData[activeTutorId].name || activeTutorId;
              }

              const upperName = data.name ? String(data.name).toUpperCase() : '-';
              const initials = upperName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('') || 'S';

              let stripeClass = 'na';
              let timerText = 'No Starting Date';
              let barWidth = 0;
              let barClass = 'safe';
              let statusBadge = `<span class="status-badge" style="background:#f1f5f9;color:#64748b;">N/A</span>`;

              if (data.nextAssessmentDate) {
                const formattedNextDate = data.nextAssessmentDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                if (data.daysLeft === 0) timerText = `Due today (${formattedNextDate})`;
                else if (data.daysLeft < 0) timerText = `Overdue by ${Math.abs(data.daysLeft)} days (${formattedNextDate})`;
                else timerText = `Due in ${data.daysLeft} days (${formattedNextDate})`;

                barWidth = Math.round(data.progressPercent);
                barClass = data.statusCategory;
                stripeClass = data.statusCategory;

                if (data.statusCategory === 'safe') statusBadge = `<span class="status-badge status-safe">On Track</span>`;
                else if (data.statusCategory === 'warning') statusBadge = `<span class="status-badge status-warning">Due Soon</span>`;
                else if (data.statusCategory === 'danger') statusBadge = `<span class="status-badge status-danger">Overdue</span>`;
              }

              return `
                <div class="assess-card">
                  <div class="assess-card-stripe ${stripeClass}"></div>
                  <div class="assess-card-top">
                    <div class="assess-student-wrap">
                      <div class="assess-avatar">${initials}</div>
                      <div style="min-width: 0;">
                        <div class="assess-name" title="${upperName}">${upperName}</div>
                        <div class="assess-id">${data.studentId || '-'}</div>
                      </div>
                    </div>
                    ${statusBadge}
                  </div>
                  <div class="assess-meta">
                    <div>
                      <div class="assess-meta-lbl">Course</div>
                      <div class="assess-meta-val" title="${courseLabel}">${courseLabel}</div>
                    </div>
                    <div>
                      <div class="assess-meta-lbl">Tutor</div>
                      <div class="assess-meta-val" title="${tutorName}">${tutorName}</div>
                    </div>
                    <div>
                      <div class="assess-meta-lbl">Start Date</div>
                      <div class="assess-meta-val">${data.classStartingDate || data.admissionDate || '-'}</div>
                    </div>
                    <div>
                      <div class="assess-meta-lbl">Division</div>
                      <div class="assess-meta-val">${divName}</div>
                    </div>
                  </div>
                  <div>
                    <div style="font-size: 0.8rem; font-weight: 600; color: #334155;">${timerText}</div>
                    <div class="timer-container">
                      <div class="timer-bar ${barClass}" style="width: ${barWidth}%"></div>
                    </div>
                  </div>
                  <div class="assess-footer">
                    <a href="../reports/progress.html?studentId=${data.id}" class="btn btn-outline" style="width: 100%; padding: 0.45rem 0.75rem; font-size: 0.8rem;">
                      Add / View Report
                    </a>
                  </div>
                </div>
              `;
            }).join('');

            htmlParts.push(`
              <section class="assess-div-group">
                <div class="assess-div-header">
                  <div class="assess-div-title">
                    <span>${divName}</span>
                    <span class="assess-div-badge">${list.length} Student${list.length === 1 ? '' : 's'}</span>
                  </div>
                </div>
                <div class="assess-grid">${cardsHtml}</div>
              </section>
            `);
          });

          gridContainer.innerHTML = htmlParts.join('');
          if (statTotal) statTotal.textContent = total;
          if (statWarning) statWarning.textContent = warningCount;
          if (statDanger) statDanger.textContent = dangerCount;
        };

        renderDivisionPills();

        const filterAndSortData = () => {
          const searchTerm = (searchInput ? searchInput.value : '').toLowerCase();
          const sortVal = sortFilter ? sortFilter.value : 'due_date_asc';
          const statusVal = statusFilter ? statusFilter.value : '';

          let filtered = allStudents.filter(student => {
            const matchesSearch = !searchTerm || 
              (student.name && student.name.toLowerCase().includes(searchTerm)) || 
              (student.studentId && student.studentId.toLowerCase().includes(searchTerm));
            
            const matchesStatus = !statusVal || student.statusCategory === statusVal;
            const matchesDivision = activeDivision === 'all' || getStudentDivision(student) === activeDivision;

            return matchesSearch && matchesStatus && matchesDivision;
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

          renderCards(filtered);
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
        gridContainer.innerHTML = `<div style="text-align: center; padding: 2rem; color: #ef4444; background: #fff; border-radius: 16px;">Error loading assessments: ${error.message}</div>`;
      }
    }
  });
});
