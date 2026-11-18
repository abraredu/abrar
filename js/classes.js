import { db } from './firebase-config.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
  const tabsContainer = document.getElementById('courseTabsContainer');
  const contentArea = document.getElementById('courseContentArea');
  const noCoursesMsg = document.getElementById('noCoursesMessage');
  
  const statTotal = document.getElementById('statTotalStudents');
  const statActive = document.getElementById('statActiveStudents');
  const tbody = document.getElementById('courseStudentsTableBody');
  const divisionTabsContainer = document.getElementById('divisionTabsContainer');

  if (!tabsContainer || !contentArea) return;

  let courses = [];
  let currentCourse = null;
  let currentStudents = [];
  let currentDivision = 'all';

  // Load all managed courses
  const loadCourses = async () => {
    try {
      const q = query(collection(db, "managed_courses"), orderBy("serialNo"));
      const snapshot = await getDocs(q);
      
      courses = [];
      snapshot.forEach(doc => {
        courses.push({ id: doc.id, ...doc.data() });
      });

      renderTabs();
    } catch (err) {
      console.error("Error loading courses:", err);
      tabsContainer.innerHTML = '<div style="color: red; padding: 1rem;">Failed to load courses.</div>';
    }
  };

  const renderTabs = () => {
    if (courses.length === 0) {
      tabsContainer.style.display = 'none';
      contentArea.style.display = 'none';
      noCoursesMsg.style.display = 'block';
      return;
    }

    tabsContainer.style.display = 'flex';
    noCoursesMsg.style.display = 'none';
    tabsContainer.innerHTML = '';

    courses.forEach((course, index) => {
      const btn = document.createElement('button');
      btn.className = `btn tab-btn`;
      btn.style.cssText = `border: none; border-radius: var(--radius-md); padding: 0.5rem 1.25rem; white-space: nowrap; transition: all 0.2s;`;
      
      if ((!currentCourse && index === 0) || (currentCourse && currentCourse.id === course.id)) {
        btn.style.background = '#e6f4ea';
        btn.style.color = 'var(--color-primary)';
        btn.style.fontWeight = '600';
        currentCourse = course;
      } else {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--color-text-secondary)';
        btn.onmouseover = () => btn.style.background = '#f1f5f9';
        btn.onmouseout = () => btn.style.background = 'transparent';
      }

      btn.textContent = `${course.serialNo} - ${course.courseName}`;
      btn.addEventListener('click', () => {
        currentCourse = course;
        currentDivision = 'all'; // reset division on course change
        renderTabs(); // re-render to update active styling
        loadCourseData(course);
      });

      tabsContainer.appendChild(btn);
    });

    if (currentCourse) {
      loadCourseData(currentCourse);
    }
  };

  const loadCourseData = async (course) => {
    contentArea.style.display = 'block';
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 3rem; color: #64748b;"><div style="display: flex; flex-direction: column; align-items: center; gap: 1rem;"><i data-lucide="loader-2" style="animation: spin 1s linear infinite; width: 32px; height: 32px; color: var(--color-primary);"></i><p>Loading analytics...</p></div></td></tr>`;
    if (window.lucide) lucide.createIcons();

    // Setup Divisions Filter if course has divisions
    let divs = [];
    if (course.divisions && course.divisions.trim() !== '') {
      divs = course.divisions.split(',').map(d => d.trim()).filter(d => d);
    }

    if (divs.length > 0) {
      divisionTabsContainer.style.display = 'flex';
      renderDivisionTabs(divs);
    } else {
      divisionTabsContainer.style.display = 'none';
      divisionTabsContainer.innerHTML = '';
      currentDivision = 'all';
    }

    // Fetch students for this course
    // Fetch students for this course
    try {
      const q = query(collection(db, "students"));
      const snapshot = await getDocs(q);
      
      const rawSerial = (course.serialNo || '').trim().toUpperCase();
      const coursePrefix = rawSerial.replace(/\d+$/, ''); // e.g. "AMO"
      const matchName = (course.courseName || '').toLowerCase().trim();
      const matchSerial = rawSerial.toLowerCase();
      
      currentStudents = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const sId = String(data.studentId || data.admNo || '').trim().toUpperCase();
        const c1 = String(data.course || '').toLowerCase().trim();
        const c2 = String(data.courseType || '').toLowerCase().trim();
        const c3 = data.courseId || '';
        const cArr = Array.isArray(data.courses) ? data.courses.map(c => String(c).toLowerCase().trim()) : [];
        
        // 1. Check if student's ID starts with the course prefix (e.g. AMO001 starts with AMO)
        let isMatch = Boolean(coursePrefix && sId.startsWith(coursePrefix));

        // 2. Check courseName, serial, courseId, courses array
        const checkMatch = (val) => {
           if (!val) return false;
           const v = String(val).toLowerCase().trim();
           if (v === matchName || v === matchSerial) return true;
           if (matchName && (v.includes(matchName) || matchName.includes(v))) return true;
           // Normalize: remove spaces, underscores, dashes, and duplicate letters like 'ss'
           const normV = v.replace(/[\s_-]/g, '').replace(/ss/g, 's');
           const normName = matchName.replace(/[\s_-]/g, '').replace(/ss/g, 's');
           if (normV === normName || normV.includes(normName) || normName.includes(normV)) return true;
           return false;
        };

        if (!isMatch) {
          isMatch = checkMatch(c1) || checkMatch(c2) || c3 === course.id || cArr.some(checkMatch);
        }

        // 3. Known mappings for legacy types
        if (!isMatch) {
          if ((coursePrefix === 'AMO' || matchName.includes('individual') || matchName.includes('one-to-one')) &&
              (c2.includes('madrasa_individual') || c2.includes('individual') || c1.includes('individual'))) {
            isMatch = true;
          } else if ((coursePrefix === 'AMG' || matchName.includes('group')) &&
              (c2.includes('madrasa_group') || c2.includes('group') || c1.includes('group'))) {
            isMatch = true;
          } else if ((coursePrefix === 'AQO' || coursePrefix === 'AT' || matchName.includes('quran') || matchName.includes('recitation') || matchName.includes('tarteel')) &&
              (sId.startsWith('AQO') || sId.startsWith('AT') ||
               c2.includes('quran_recitation') || c2.includes('recitation') || c2.includes('quran') || c2.includes('tarteel') ||
               c1.includes('recitation') || c1.includes('quran') || c1.includes('tarteel') ||
               cArr.some(v => v.includes('quran_recitation') || v.includes('recitation') || v.includes('quran') || v.includes('tarteel')))) {
            isMatch = true;
          }
        }

        if (!isMatch && data.courseTutors && data.courseTutors[course.courseName]) {
           isMatch = true;
        }

        if (isMatch) {
          currentStudents.push({ id: docSnap.id, ...data });
        }
      });

      renderStudentsTable();
    } catch (err) {
      console.error("Error loading students:", err);
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: red;">Error loading data.</td></tr>`;
    }
  };

  const renderDivisionTabs = (divs) => {
    divisionTabsContainer.innerHTML = '';
    
    const allDivs = ['all', ...divs];
    
    allDivs.forEach(div => {
      const btn = document.createElement('button');
      btn.className = 'tab-btn';
      
      const isSelected = currentDivision === div;
      
      if (isSelected) {
        btn.style.cssText = 'padding: 0.4rem 1.25rem; border: 1px solid var(--color-primary); background: #e6f4ea; color: var(--color-primary); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; border-radius: 99px; cursor: pointer; transition: all 0.2s; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem;';
        btn.innerHTML = `<div style="width: 6px; height: 6px; border-radius: 50%; background: var(--color-primary);"></div> ${div === 'all' ? 'ALL' : div}`;
      } else {
        btn.style.cssText = 'padding: 0.4rem 1.25rem; border: 1px solid var(--color-border); background: #ffffff; color: #64748b; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; border-radius: 99px; cursor: pointer; transition: all 0.2s; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem;';
        btn.innerHTML = `<div style="width: 6px; height: 6px; border-radius: 50%; background: #94a3b8;"></div> ${div === 'all' ? 'ALL' : div}`;
        btn.onmouseover = () => { btn.style.borderColor = '#cbd5e1'; btn.style.color = '#475569'; };
        btn.onmouseout = () => { btn.style.borderColor = 'var(--color-border)'; btn.style.color = '#64748b'; };
      }
      
      btn.addEventListener('click', () => {
        currentDivision = div;
        renderDivisionTabs(divs);
        renderStudentsTable();
      });
      
      divisionTabsContainer.appendChild(btn);
    });
  };

  const renderStudentsTable = () => {
    const filterDiv = currentDivision;
    
    let filteredStudents = currentStudents;
    if (filterDiv !== 'all') {
      const fd = filterDiv.toLowerCase().trim();
      const numOnly = fd.replace(/[^0-9]/g, '');
      filteredStudents = currentStudents.filter(s => {
        const sDiv = String(s.division || s.batch || '').toLowerCase().trim();
        const sLevel = String(s.level || '').toLowerCase().trim();
        const sLevelNum = sLevel.replace(/[^0-9]/g, '');
        return sDiv === fd || sLevel === fd || (numOnly && sLevelNum === numOnly) || sDiv.includes(fd) || sLevel.includes(fd);
      });
    }

    // Update Stats
    statTotal.textContent = filteredStudents.length;
    statActive.textContent = filteredStudents.filter(s => s.status !== 'inactive').length;

    if (filteredStudents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 3rem; color: #64748b;">No students found for this course.</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    filteredStudents.forEach(student => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--color-border)';
      
      const statusColor = student.status === 'inactive' ? '#ef4444' : '#10b981';
      const statusText = student.status === 'inactive' ? 'Inactive' : 'Active';

      // Format division/level display
      let divDisplay = student.division || '';
      if (!divDisplay && student.level) {
        const lvlStr = String(student.level).trim();
        divDisplay = lvlStr.toLowerCase().startsWith('class') ? lvlStr : `Class ${lvlStr}`;
      }
      if (!divDisplay && student.batch) {
        divDisplay = student.batch;
      }
      if (!divDisplay) {
        divDisplay = '-';
      }

      tr.innerHTML = `
        <td style="padding: 1rem 1.5rem; font-weight: 500; color: #0f172a;">${student.name ? String(student.name).toUpperCase() : '-'}</td>
        <td style="padding: 1rem 1.5rem; color: #475569;">${student.studentId || student.admNo || '-'}</td>
        <td style="padding: 1rem 1.5rem; color: #475569;">
          <span style="background: #f1f5f9; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 500;">${divDisplay}</span>
        </td>
        <td style="padding: 1rem 1.5rem;">
          <span style="color: ${statusColor}; font-size: 0.875rem; font-weight: 500; display: flex; align-items: center; gap: 0.25rem;">
            <div style="width: 6px; height: 6px; border-radius: 50%; background: ${statusColor};"></div>
            ${statusText}
          </span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  };

  loadCourses();
});
