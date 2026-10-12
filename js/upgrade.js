// js/upgrade.js
import { db, auth } from './firebase-config.js';
import { collection, getDocs, doc, updateDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { toast } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements - Navigation & Tabs
  const courseTabsWrapper = document.getElementById('courseTabsWrapper');
  const divisionTabsContainer = document.getElementById('divisionTabsContainer');
  const divisionTabsWrapper = document.getElementById('divisionTabsWrapper');
  const divisionSectionTitle = document.getElementById('divisionSectionTitle');
  const activeDivisionInfo = document.getElementById('activeDivisionInfo');
  const levelPillsWrapper = document.getElementById('levelPillsWrapper');

  // Filter summary & Reset
  const filterSummaryChip = document.getElementById('filterSummaryChip');
  const filterSummaryText = document.getElementById('filterSummaryText');
  const resetAllFiltersBtn = document.getElementById('resetAllFiltersBtn');
  const activeFilterBadge = document.getElementById('activeFilterBadge');
  const filterNameDisplay = document.getElementById('filterNameDisplay');
  const clearLevelFilterBtn = document.getElementById('clearLevelFilterBtn');

  // Search & Candidates Grid
  const searchInput = document.getElementById('searchInput');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const candidatesGrid = document.getElementById('candidatesGrid');
  const candidateCountDisplay = document.getElementById('candidateCountDisplay');
  const refreshBtn = document.getElementById('refreshBtn');

  // Floating Bulk Bar & Quick Actions
  const openBulkModalBtn = document.getElementById('openBulkModalBtn');
  const selectedCountBadge = document.getElementById('selectedCountBadge');
  const quickUpgradeSelectedBtn = document.getElementById('quickUpgradeSelectedBtn');
  const quickSelectedCount = document.getElementById('quickSelectedCount');

  const floatingBulkBar = document.getElementById('floatingBulkBar');
  const floatingSelectedCount = document.getElementById('floatingSelectedCount');
  const floatingUpgradeBtn = document.getElementById('floatingUpgradeBtn');
  const floatingUpgradeBtnText = document.getElementById('floatingUpgradeBtnText');
  const floatingCancelBtn = document.getElementById('floatingCancelBtn');

  // Confirmation Modal
  const confirmUpgradeModal = document.getElementById('confirmUpgradeModal');
  const confirmModalTitle = document.getElementById('confirmModalTitle');
  const confirmModalBody = document.getElementById('confirmModalBody');
  const cancelConfirmModalBtn = document.getElementById('cancelConfirmModalBtn');
  const executeUpgradeBtn = document.getElementById('executeUpgradeBtn');

  // State
  let allStudents = [];
  let allCourses = [];
  let selectedStudentIds = new Set();
  let activeCourseId = 'all';     // 'all' or course.id or 'other'
  let activeDivision = 'all';     // 'all' or specific division name
  let activeLevel = 'all';        // 'all' or specific class level
  let searchQuery = '';
  let pendingUpgradeAction = null;

  // Standard Class Levels
  const standardLevels = [
    '1st Class',
    '2nd Class',
    '3rd Class',
    '4th Class',
    '5th Class',
    '6th Class',
    '7th Class',
    '8th Class',
    '9th Class',
    '10th Class'
  ];

  // Helper to normalize level string and infer from division
  function normalizeLevel(level, division) {
    let raw = level;
    // If level is not set, or is 'Unassigned', and division is present
    if ((!raw || raw.trim() === '' || raw.trim().toLowerCase() === 'unassigned') && division && division.trim()) {
      raw = division.trim();
    }
    if (!raw || raw.trim() === '') return 'Unassigned';
    const trimmed = raw.trim();
    const lower = trimmed.toLowerCase();

    // Check specific class strings
    if (trimmed === '1' || lower === 'class 1' || lower === '1st class' || lower === 'class-1') return '1st Class';
    if (trimmed === '2' || lower === 'class 2' || lower === '2nd class' || lower === 'class-2') return '2nd Class';
    if (trimmed === '3' || lower === 'class 3' || lower === '3rd class' || lower === 'class-3') return '3rd Class';
    if (trimmed === '4' || lower === 'class 4' || lower === '4th class' || lower === 'class-4') return '4th Class';
    if (trimmed === '5' || lower === 'class 5' || lower === '5th class' || lower === 'class-5') return '5th Class';
    if (trimmed === '6' || lower === 'class 6' || lower === '6th class' || lower === 'class-6') return '6th Class';
    if (trimmed === '7' || lower === 'class 7' || lower === '7th class' || lower === 'class-7') return '7th Class';
    if (trimmed === '8' || lower === 'class 8' || lower === '8th class' || lower === 'class-8') return '8th Class';
    if (trimmed === '9' || lower === 'class 9' || lower === '9th class' || lower === 'class-9') return '9th Class';
    if (trimmed === '10' || lower === 'class 10' || lower === '10th class' || lower === 'class-10') return '10th Class';

    // Regex check for numbers inside string: e.g. "Batch 1", "Class 2", "Div 3"
    const numMatch = lower.match(/\b([1-9]|10)\b/);
    if (numMatch) {
      const n = parseInt(numMatch[1], 10);
      if (n >= 1 && n <= 10) {
        return standardLevels[n - 1];
      }
    }

    // If student has a division assigned (e.g. "Division A"), they are active in curriculum
    if (division && division.trim() && division.trim().toLowerCase() !== 'default div') {
      return '1st Class';
    }

    return trimmed;
  }

  // Helper to get next logical class level
  function getNextLogicalLevel(currentLevel) {
    const norm = normalizeLevel(currentLevel);
    const index = standardLevels.indexOf(norm);
    if (index !== -1 && index + 1 < standardLevels.length) {
      return standardLevels[index + 1];
    }
    if (norm === 'Unassigned') return '1st Class';
    return '2nd Class';
  }

  // Get next logical division when a student is upgraded
  function getNextLogicalDivision(student, courseObj) {
    const currentDiv = (student.division || '').trim();
    if (!currentDiv || currentDiv === 'Default Div') return '';

    const divs = courseObj ? getCourseEnteredDivisions(courseObj) : [];
    
    // 1. If course has configured divisions list, advance to the next index
    const idx = divs.findIndex(d => d.toLowerCase() === currentDiv.toLowerCase());
    if (idx !== -1 && idx + 1 < divs.length) {
      return divs[idx + 1];
    }

    // 2. If division has an incrementable number (e.g. "Class 1" -> "Class 2", "Batch 1" -> "Batch 2")
    const match = currentDiv.match(/^(.*?)(\d+)(.*?)$/);
    if (match) {
      const prefix = match[1];
      const num = parseInt(match[2], 10);
      const suffix = match[3];
      const nextCandidate = `${prefix}${num + 1}${suffix}`;
      const found = divs.find(d => d.toLowerCase() === nextCandidate.toLowerCase());
      return found || nextCandidate;
    }

    return currentDiv;
  }

  // Check if a student matches a course
  function studentMatchesCourse(student, course) {
    if (!course) return true;
    const sCourse = (student.course || '').trim().toLowerCase();
    const sCourseType = (student.courseType || '').trim().toLowerCase();
    const cName = (course.courseName || '').trim().toLowerCase();
    const cSerial = (course.serialNo || '').trim().toLowerCase();

    return sCourse === cName || sCourse === cSerial ||
           sCourseType === cName || sCourseType === cSerial ||
           student.courseId === course.id;
  }

  // Identify student's course object
  function getStudentCourse(student) {
    return allCourses.find(c => studentMatchesCourse(student, c)) || null;
  }

  // Get list of divisions entered for a course
  function getCourseEnteredDivisions(course) {
    if (!course) return [];
    const divs = [];
    if (course.divisions && typeof course.divisions === 'string' && course.divisions.trim()) {
      course.divisions.split(',').forEach(d => {
        const trimmed = d.trim();
        if (trimmed && !divs.includes(trimmed)) divs.push(trimmed);
      });
    }
    // Also include any division present in students of this course
    allStudents.forEach(s => {
      if (studentMatchesCourse(s, course) && s.division && s.division.trim()) {
        const divTrimmed = s.division.trim();
        if (!divs.includes(divTrimmed)) divs.push(divTrimmed);
      }
    });
    return divs;
  }

  // Load Data
  async function loadData() {
    try {
      courseTabsWrapper.innerHTML = '<div style="padding: 0.5rem 1rem; color: #64748b; font-size: 0.875rem;">Loading entered courses...</div>';
      candidatesGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: white; border-radius: var(--radius-lg); border: 1px solid var(--color-border); color: #64748b;">Loading candidate students...</div>';

      // 1. Fetch Managed Courses
      try {
        const coursesSnap = await getDocs(query(collection(db, "managed_courses"), orderBy("serialNo")));
        allCourses = [];
        coursesSnap.forEach(docSnap => {
          allCourses.push({ id: docSnap.id, ...docSnap.data() });
        });
      } catch (cErr) {
        // Fallback without orderBy
        const coursesSnap = await getDocs(collection(db, "managed_courses"));
        allCourses = [];
        coursesSnap.forEach(docSnap => {
          allCourses.push({ id: docSnap.id, ...docSnap.data() });
        });
      }

      // 2. Fetch Students
      let studentsSnap;
      try {
        const q = query(collection(db, "students"), orderBy("name"));
        studentsSnap = await getDocs(q);
      } catch (err) {
        studentsSnap = await getDocs(collection(db, "students"));
      }

      allStudents = [];
      studentsSnap.forEach(docSnap => {
        const data = docSnap.data();
        allStudents.push({
          id: docSnap.id,
          ...data,
          level: normalizeLevel(data.level, data.division)
        });
      });

      // Render UI
      renderCourseTabs();
      renderDivisionTabs();
      renderLevelPills();
      renderCandidates();
      updateFilterSummaryUI();

    } catch (err) {
      console.error("Error loading upgrade data:", err);
      toast("Error loading data: " + err.message, "error");
    }
  }

  // 1. Render Primary Course Tabs
  function renderCourseTabs() {
    courseTabsWrapper.innerHTML = '';

    // "All Courses" tab
    const allCoursesBtn = document.createElement('button');
    allCoursesBtn.type = 'button';
    allCoursesBtn.className = `course-tab-btn ${activeCourseId === 'all' ? 'active' : ''}`;
    allCoursesBtn.innerHTML = `
      <i data-lucide="layers" style="width: 16px; height: 16px;"></i>
      <span>All Courses</span>
      <span class="tab-badge">${allStudents.length}</span>
    `;
    allCoursesBtn.addEventListener('click', () => {
      activeCourseId = 'all';
      activeDivision = 'all';
      renderCourseTabs();
      renderDivisionTabs();
      renderLevelPills();
      renderCandidates();
      updateFilterSummaryUI();
    });
    courseTabsWrapper.appendChild(allCoursesBtn);

    // Each entered course tab
    allCourses.forEach(course => {
      const count = allStudents.filter(s => studentMatchesCourse(s, course)).length;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `course-tab-btn ${activeCourseId === course.id ? 'active' : ''}`;
      
      const label = course.serialNo 
        ? `${course.serialNo} • ${course.courseName}` 
        : course.courseName;

      btn.innerHTML = `
        <i data-lucide="book-open" style="width: 15px; height: 15px;"></i>
        <span>${label}</span>
        <span class="tab-badge">${count}</span>
      `;

      btn.addEventListener('click', () => {
        activeCourseId = course.id;
        activeDivision = 'all';
        renderCourseTabs();
        renderDivisionTabs();
        renderLevelPills();
        renderCandidates();
        updateFilterSummaryUI();
      });

      courseTabsWrapper.appendChild(btn);
    });

    // Check for students without an entered managed course
    const otherStudentsCount = allStudents.filter(s => !getStudentCourse(s)).length;
    if (otherStudentsCount > 0) {
      const otherBtn = document.createElement('button');
      otherBtn.type = 'button';
      otherBtn.className = `course-tab-btn ${activeCourseId === 'other' ? 'active' : ''}`;
      otherBtn.innerHTML = `
        <i data-lucide="help-circle" style="width: 15px; height: 15px;"></i>
        <span>Other / Unassigned</span>
        <span class="tab-badge">${otherStudentsCount}</span>
      `;
      otherBtn.addEventListener('click', () => {
        activeCourseId = 'other';
        activeDivision = 'all';
        renderCourseTabs();
        renderDivisionTabs();
        renderLevelPills();
        renderCandidates();
        updateFilterSummaryUI();
      });
      courseTabsWrapper.appendChild(otherBtn);
    }

    if (window.lucide) lucide.createIcons();
  }

  // 2. Render Secondary Division Tabs (Per Division for the Active Course)
  function renderDivisionTabs() {
    divisionTabsWrapper.innerHTML = '';

    // Determine relevant students for current course selection
    let courseStudents = allStudents;
    let selectedCourse = null;

    if (activeCourseId === 'all') {
      divisionSectionTitle.textContent = 'All Available Divisions:';
      activeDivisionInfo.textContent = activeDivision === 'all' ? 'Showing all divisions' : `Filtered: ${activeDivision}`;
    } else if (activeCourseId === 'other') {
      courseStudents = allStudents.filter(s => !getStudentCourse(s));
      divisionSectionTitle.textContent = 'Unassigned Course Divisions:';
      activeDivisionInfo.textContent = activeDivision === 'all' ? 'All Divisions' : `Filtered: ${activeDivision}`;
    } else {
      selectedCourse = allCourses.find(c => c.id === activeCourseId);
      courseStudents = allStudents.filter(s => studentMatchesCourse(s, selectedCourse));
      divisionSectionTitle.textContent = `${selectedCourse ? selectedCourse.courseName : 'Course'} Divisions:`;
      activeDivisionInfo.textContent = activeDivision === 'all' ? 'All Divisions' : `Filtered: ${activeDivision}`;
    }

    // Collect divisions list
    let divisions = [];
    if (selectedCourse) {
      divisions = getCourseEnteredDivisions(selectedCourse);
    } else if (activeCourseId === 'other') {
      const set = new Set();
      courseStudents.forEach(s => {
        if (s.division && s.division.trim()) set.add(s.division.trim());
      });
      divisions = Array.from(set);
    } else {
      // All Courses: collect union of divisions
      const set = new Set();
      allCourses.forEach(c => {
        getCourseEnteredDivisions(c).forEach(d => set.add(d));
      });
      allStudents.forEach(s => {
        if (s.division && s.division.trim()) set.add(s.division.trim());
      });
      divisions = Array.from(set);
    }

    // "All Divisions" tab
    const allDivBtn = document.createElement('button');
    allDivBtn.type = 'button';
    allDivBtn.className = `division-tab-btn ${activeDivision === 'all' ? 'active' : ''}`;
    allDivBtn.innerHTML = `
      <span>All Divisions</span>
      <span class="tab-badge">${courseStudents.length}</span>
    `;
    allDivBtn.addEventListener('click', () => {
      activeDivision = 'all';
      renderDivisionTabs();
      renderLevelPills();
      renderCandidates();
      updateFilterSummaryUI();
    });
    divisionTabsWrapper.appendChild(allDivBtn);

    if (divisions.length === 0) {
      // If course has no specific divisions, show a default tag
      const defaultDivBtn = document.createElement('button');
      defaultDivBtn.type = 'button';
      defaultDivBtn.className = `division-tab-btn ${activeDivision === 'Default' ? 'active' : ''}`;
      defaultDivBtn.innerHTML = `
        <span>General / Default</span>
        <span class="tab-badge">${courseStudents.length}</span>
      `;
      defaultDivBtn.addEventListener('click', () => {
        activeDivision = activeDivision === 'Default' ? 'all' : 'Default';
        renderDivisionTabs();
        renderLevelPills();
        renderCandidates();
        updateFilterSummaryUI();
      });
      divisionTabsWrapper.appendChild(defaultDivBtn);
    } else {
      divisions.forEach(divName => {
        const count = courseStudents.filter(s => (s.division || '').trim().toLowerCase() === divName.toLowerCase()).length;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `division-tab-btn ${activeDivision.toLowerCase() === divName.toLowerCase() ? 'active' : ''}`;
        btn.innerHTML = `
          <span>${divName}</span>
          <span class="tab-badge">${count}</span>
        `;
        btn.addEventListener('click', () => {
          activeDivision = activeDivision.toLowerCase() === divName.toLowerCase() ? 'all' : divName;
          renderDivisionTabs();
          renderLevelPills();
          renderCandidates();
          updateFilterSummaryUI();
        });
        divisionTabsWrapper.appendChild(btn);
      });
    }

    if (window.lucide) lucide.createIcons();
  }

  // 3. Render Class Level Pills
  function renderLevelPills() {
    levelPillsWrapper.innerHTML = '';

    // Candidates in current course & division
    const baseCandidates = allStudents.filter(student => {
      if (activeCourseId === 'other') {
        if (getStudentCourse(student)) return false;
      } else if (activeCourseId !== 'all') {
        const course = allCourses.find(c => c.id === activeCourseId);
        if (!studentMatchesCourse(student, course)) return false;
      }

      if (activeDivision !== 'all') {
        if (activeDivision === 'Default') {
          if (student.division && student.division.trim() !== '') return false;
        } else {
          if ((student.division || '').trim().toLowerCase() !== activeDivision.toLowerCase()) return false;
        }
      }

      return true;
    });

    // "All Levels" pill
    const allLevelsPill = document.createElement('button');
    allLevelsPill.type = 'button';
    allLevelsPill.className = `level-pill-btn ${activeLevel === 'all' ? 'active' : ''}`;
    allLevelsPill.innerHTML = `
      <span>All Levels</span>
      <span class="tab-badge">${baseCandidates.length}</span>
    `;
    allLevelsPill.addEventListener('click', () => {
      activeLevel = 'all';
      renderLevelPills();
      renderCandidates();
      updateFilterSummaryUI();
    });
    levelPillsWrapper.appendChild(allLevelsPill);

    // List of levels to display: standardLevels (1st to 5th or any with students) + Unassigned
    const levelsToDisplay = standardLevels.slice(0, 5);
    baseCandidates.forEach(s => {
      const lvl = s.level || 'Unassigned';
      if (!levelsToDisplay.includes(lvl) && lvl !== 'Unassigned') {
        levelsToDisplay.push(lvl);
      }
    });
    levelsToDisplay.push('Unassigned');

    levelsToDisplay.forEach(lvl => {
      const count = baseCandidates.filter(s => (s.level || 'Unassigned') === lvl).length;
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `level-pill-btn ${activeLevel === lvl ? 'active' : ''}`;
      pill.innerHTML = `
        <span>${lvl}</span>
        <span class="tab-badge">${count}</span>
      `;
      pill.addEventListener('click', () => {
        activeLevel = activeLevel === lvl ? 'all' : lvl;
        renderLevelPills();
        renderCandidates();
        updateFilterSummaryUI();
      });
      levelPillsWrapper.appendChild(pill);
    });

    if (window.lucide) lucide.createIcons();
  }

  // Filter candidates based on active course, division, level, and search text
  function getFilteredCandidates() {
    return allStudents.filter(student => {
      // Course filter
      if (activeCourseId === 'other') {
        if (getStudentCourse(student)) return false;
      } else if (activeCourseId !== 'all') {
        const course = allCourses.find(c => c.id === activeCourseId);
        if (!studentMatchesCourse(student, course)) return false;
      }

      // Division filter
      if (activeDivision !== 'all') {
        if (activeDivision === 'Default') {
          if (student.division && student.division.trim() !== '') return false;
        } else {
          if ((student.division || '').trim().toLowerCase() !== activeDivision.toLowerCase()) return false;
        }
      }

      // Level filter
      if (activeLevel !== 'all') {
        const sLvl = student.level || 'Unassigned';
        if (sLvl !== activeLevel) return false;
      }

      // Search query
      if (searchQuery) {
        const name = (student.name || '').toLowerCase();
        const id = (student.studentId || student.admNo || '').toLowerCase();
        const phone = (student.phone || '').toLowerCase();
        const parent = (student.parentName || student.fatherName || '').toLowerCase();
        if (!name.includes(searchQuery) && !id.includes(searchQuery) && !phone.includes(searchQuery) && !parent.includes(searchQuery)) {
          return false;
        }
      }

      return true;
    });
  }

  // 4. Render Candidates List as Modern Cards
  function renderCandidates() {
    const candidates = getFilteredCandidates();
    candidateCountDisplay.textContent = candidates.length;
    candidatesGrid.innerHTML = '';

    if (candidates.length === 0) {
      candidatesGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3.5rem 1.5rem; background: white; border-radius: var(--radius-lg); border: 1px dashed var(--color-border);">
          <div style="width: 52px; height: 52px; border-radius: 50%; background: #f1f5f9; color: #94a3b8; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
            <i data-lucide="users" style="width: 26px; height: 26px;"></i>
          </div>
          <h3 style="font-size: 1.15rem; font-weight: 600; color: #1e293b; margin-bottom: 0.35rem;">No candidates found in this view</h3>
          <p style="color: #64748b; font-size: 0.875rem; margin-bottom: 1.25rem;">Try selecting a different division, class level, or clear your search query.</p>
          <button id="emptyStateResetBtn" class="btn btn-outline" style="font-size: 0.85rem; padding: 0.45rem 1rem; background: white;">
            <i data-lucide="rotate-ccw" style="width: 14px; height: 14px;"></i> Reset All Filters
          </button>
        </div>
      `;
      const resetBtn = document.getElementById('emptyStateResetBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', resetAllFilters);
      }
      if (window.lucide) lucide.createIcons();
      updateBulkActionBar();
      return;
    }

    candidates.forEach(student => {
      const isSelected = selectedStudentIds.has(student.id);
      const studentName = student.name || 'Unnamed Student';
      const studentId = student.studentId || student.admNo || 'ID-N/A';
      
      const courseObj = getStudentCourse(student);
      const courseName = courseObj ? courseObj.courseName : (student.course || student.courseType || 'General Course');
      const currentLevel = student.level || '1st Class';
      const currentDiv = student.division || 'Default Div';

      // Available divisions for this student's course
      const availableDivs = courseObj ? getCourseEnteredDivisions(courseObj) : ['Division A', 'Division B'];
      if (!availableDivs.includes(currentDiv) && currentDiv !== 'Default Div') {
        availableDivs.push(currentDiv);
      }

      // Recommended next level
      const recommendedNextLevel = getNextLogicalLevel(currentLevel);
      const recommendedNextDivision = getNextLogicalDivision(student, courseObj);

      const card = document.createElement('div');
      card.className = `candidate-card ${isSelected ? 'selected' : ''}`;
      card.dataset.id = student.id;

      card.innerHTML = `
        <div>
          <!-- Top Row: Checkbox, Avatar, Name & Current Level -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; margin-bottom: 0.85rem;">
            <div style="display: flex; gap: 0.75rem; align-items: center;">
              <input type="checkbox" class="candidate-checkbox" data-id="${student.id}" ${isSelected ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--color-primary);">
              <div style="width: 44px; height: 44px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-weight: 600; color: #475569; overflow: hidden; flex-shrink: 0; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                ${student.photoUrl 
                  ? `<img src="${student.photoUrl}" alt="${studentName}" style="width: 100%; height: 100%; object-fit: cover;">` 
                  : studentName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style="font-weight: 600; font-size: 0.95rem; color: #0f172a; line-height: 1.25;">${studentName}</div>
                <div style="font-size: 0.75rem; color: #64748b; font-family: monospace; margin-top: 1px;">${studentId}</div>
              </div>
            </div>
            
            <span style="background: ${currentLevel === 'Unassigned' ? '#fef3c7' : '#e6f4ea'}; color: ${currentLevel === 'Unassigned' ? '#92400e' : 'var(--color-primary)'}; padding: 0.25rem 0.65rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; white-space: nowrap; border: 1px solid rgba(8,122,66,0.15);">
              ${currentLevel}
            </span>
          </div>

          <!-- Student Course & Division Info Pill -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: var(--radius-md); padding: 0.75rem; font-size: 0.8125rem; margin-bottom: 0.85rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
              <span style="color: #64748b; font-size: 0.75rem; font-weight: 500;">Course Track:</span>
              <span style="font-weight: 600; color: #1e293b; max-width: 160px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${courseName}">${courseName}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #64748b; font-size: 0.75rem; font-weight: 500;">Active Division:</span>
              <strong style="color: #0f172a; background: #ffffff; padding: 0.15rem 0.5rem; border-radius: 4px; border: 1px solid var(--color-border); font-size: 0.75rem;">
                ${currentDiv}
              </strong>
            </div>
          </div>
        </div>

        <!-- Direct 1-Click Upgrade Action -->
        <div style="border-top: 1px solid #f1f5f9; padding-top: 0.85rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
          <div>
            <div style="font-size: 0.725rem; color: #64748b; font-weight: 500;">Next Promotion:</div>
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--color-primary); display: flex; align-items: center; gap: 0.35rem;">
              <i data-lucide="arrow-right" style="width: 13px; height: 13px;"></i>
              <span>${recommendedNextLevel}</span>
              ${recommendedNextDivision && recommendedNextDivision !== currentDiv ? `<span style="font-size: 0.725rem; color: #0369a1; background: #e0f2fe; padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: 600;">(${recommendedNextDivision})</span>` : ''}
            </div>
          </div>

          <button class="btn btn-primary single-upgrade-btn" data-id="${student.id}" data-target-level="${recommendedNextLevel}" data-target-division="${recommendedNextDivision || currentDiv}" style="padding: 0.5rem 1rem; font-size: 0.825rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.4rem; box-shadow: 0 1px 3px rgba(8,122,66,0.2); white-space: nowrap;">
            <i data-lucide="trending-up" style="width: 15px; height: 15px;"></i> Upgrade to ${recommendedNextLevel}
          </button>
        </div>
      `;

      candidatesGrid.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
    updateBulkActionBar();
  }

  // Update Summary Pill UI
  function updateFilterSummaryUI() {
    const parts = [];
    if (activeCourseId !== 'all') {
      const course = allCourses.find(c => c.id === activeCourseId);
      parts.push(`Course: ${course ? course.courseName : 'Other'}`);
    }
    if (activeDivision !== 'all') {
      parts.push(`Div: ${activeDivision}`);
    }
    if (activeLevel !== 'all') {
      parts.push(`Level: ${activeLevel}`);
    }
    if (searchQuery) {
      parts.push(`Search: "${searchQuery}"`);
    }

    if (parts.length > 0) {
      filterSummaryChip.style.display = 'inline-flex';
      filterSummaryText.textContent = parts.join(' | ');
      activeFilterBadge.style.display = 'inline-flex';
      filterNameDisplay.textContent = parts.join(', ');
    } else {
      filterSummaryChip.style.display = 'none';
      activeFilterBadge.style.display = 'none';
    }
  }

  // Reset all filters
  function resetAllFilters() {
    activeCourseId = 'all';
    activeDivision = 'all';
    activeLevel = 'all';
    searchQuery = '';
    searchInput.value = '';
    renderCourseTabs();
    renderDivisionTabs();
    renderLevelPills();
    renderCandidates();
    updateFilterSummaryUI();
  }

  // Update Bulk Bar visibility & counts
  function updateBulkActionBar() {
    const count = selectedStudentIds.size;
    if (count > 0) {
      floatingBulkBar.style.display = 'flex';
      openBulkModalBtn.style.display = 'inline-flex';
      quickUpgradeSelectedBtn.style.display = 'inline-flex';
      floatingSelectedCount.textContent = count;
      selectedCountBadge.textContent = count;
      quickSelectedCount.textContent = count;

      const selectedStudents = allStudents.filter(s => selectedStudentIds.has(s.id));
      if (selectedStudents.length === 1) {
        const s = selectedStudents[0];
        const nextLvl = getNextLogicalLevel(s.level);
        const nextDiv = getNextLogicalDivision(s, getStudentCourse(s));
        floatingUpgradeBtnText.textContent = `Upgrade to ${nextLvl}${nextDiv && nextDiv !== s.division ? ' (' + nextDiv + ')' : ''}`;
      } else {
        const nextLevels = new Set(selectedStudents.map(s => getNextLogicalLevel(s.level)));
        if (nextLevels.size === 1) {
          floatingUpgradeBtnText.textContent = `Upgrade Selected to ${Array.from(nextLevels)[0]}`;
        } else {
          floatingUpgradeBtnText.textContent = `Upgrade Selected to Next Level`;
        }
      }
    } else {
      floatingBulkBar.style.display = 'none';
      openBulkModalBtn.style.display = 'none';
      quickUpgradeSelectedBtn.style.display = 'none';
      selectAllCheckbox.checked = false;
    }
  }

  // Checkbox interactions
  candidatesGrid.addEventListener('change', (e) => {
    if (e.target.classList.contains('candidate-checkbox')) {
      const id = e.target.getAttribute('data-id');
      const card = e.target.closest('.candidate-card');
      if (e.target.checked) {
        selectedStudentIds.add(id);
        if (card) card.classList.add('selected');
      } else {
        selectedStudentIds.delete(id);
        if (card) card.classList.remove('selected');
      }
      updateBulkActionBar();
    }
  });

  // Select All Checkbox
  selectAllCheckbox.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    const candidates = getFilteredCandidates();
    candidates.forEach(s => {
      if (isChecked) {
        selectedStudentIds.add(s.id);
      } else {
        selectedStudentIds.delete(s.id);
      }
    });
    renderCandidates();
  });

  // Single Upgrade Button Click
  candidatesGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.single-upgrade-btn');
    if (!btn) return;

    const studentId = btn.getAttribute('data-id');
    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;

    const courseObj = getStudentCourse(student);
    const targetLevel = btn.getAttribute('data-target-level') || getNextLogicalLevel(student.level);
    const targetDivision = btn.getAttribute('data-target-division') || getNextLogicalDivision(student, courseObj) || student.division || null;

    openConfirmModal({
      type: 'single',
      promotions: [{
        id: student.id,
        name: student.name,
        currentLevel: student.level,
        currentDivision: student.division || 'Default Div',
        targetLevel: targetLevel,
        targetDivision: targetDivision
      }]
    });
  });

  // Floating Bulk Upgrade Button Click
  floatingUpgradeBtn.addEventListener('click', () => {
    const selectedStudents = allStudents.filter(s => selectedStudentIds.has(s.id));
    if (selectedStudents.length === 0) return;

    const promotions = selectedStudents.map(student => {
      const courseObj = getStudentCourse(student);
      const targetLevel = getNextLogicalLevel(student.level);
      const targetDivision = getNextLogicalDivision(student, courseObj) || student.division || null;
      return {
        id: student.id,
        name: student.name,
        currentLevel: student.level,
        currentDivision: student.division || 'Default Div',
        targetLevel: targetLevel,
        targetDivision: targetDivision
      };
    });

    openConfirmModal({
      type: 'bulk',
      promotions: promotions
    });
  });

  openBulkModalBtn.addEventListener('click', () => {
    floatingUpgradeBtn.click();
  });

  quickUpgradeSelectedBtn.addEventListener('click', () => {
    floatingUpgradeBtn.click();
  });

  floatingCancelBtn.addEventListener('click', () => {
    selectedStudentIds.clear();
    selectAllCheckbox.checked = false;
    renderCandidates();
  });

  // Open Confirmation Modal
  function openConfirmModal(details) {
    pendingUpgradeAction = details;
    const promotions = details.promotions || [];

    if (details.type === 'single') {
      const p = promotions[0];
      confirmModalTitle.textContent = `Upgrade Student: ${p.name}`;
      confirmModalBody.innerHTML = `
        <div style="margin-bottom: 0.85rem;">
          <span style="font-size: 0.8rem; color: #64748b; font-weight: 500;">Target Promotion:</span>
          <div style="font-size: 1.15rem; font-weight: 700; color: var(--color-primary); margin-top: 2px; display: flex; align-items: center; gap: 0.5rem;">
            <span>${p.targetLevel}</span>
            ${p.targetDivision && p.targetDivision !== p.currentDivision ? `<span style="font-size: 0.8rem; color: #0284c7; background: #e0f2fe; padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 600;">(${p.targetDivision})</span>` : ''}
          </div>
        </div>
        <div style="background: white; border: 1px solid var(--color-border); border-radius: 6px; padding: 0.75rem; font-size: 0.825rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.35rem;">
            <span style="color: #64748b;">Current Class:</span>
            <strong style="color: #1e293b;">${p.currentLevel}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Current Division:</span>
            <strong style="color: #1e293b;">${p.currentDivision}</strong>
          </div>
        </div>
      `;
    } else {
      confirmModalTitle.textContent = `Bulk Upgrade ${promotions.length} Candidates`;
      confirmModalBody.innerHTML = `
        <div style="margin-bottom: 0.75rem;">
          <span style="font-size: 0.85rem; color: #475569; font-weight: 600;">Candidates upgrading to next class & division:</span>
        </div>
        <div style="max-height: 180px; overflow-y: auto; background: white; border: 1px solid var(--color-border); border-radius: 6px; padding: 0.5rem; font-size: 0.8rem;">
          ${promotions.map(p => `
            <div style="padding: 0.35rem 0; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
              <span style="font-weight: 600; color: #1e293b;">${p.name}</span>
              <span style="color: var(--color-primary); font-weight: 500; font-size: 0.775rem;">
                ${p.currentLevel} &rarr; <strong>${p.targetLevel}</strong>
                ${p.targetDivision && p.targetDivision !== p.currentDivision ? `<span style="color: #0284c7; font-weight: 600;">(${p.targetDivision})</span>` : ''}
              </span>
            </div>
          `).join('')}
        </div>
      `;
    }

    confirmUpgradeModal.style.display = 'flex';
  }

  cancelConfirmModalBtn.addEventListener('click', () => {
    confirmUpgradeModal.style.display = 'none';
    pendingUpgradeAction = null;
  });

  // Execute Upgrade in Firestore
  executeUpgradeBtn.addEventListener('click', async () => {
    if (!pendingUpgradeAction) return;

    executeUpgradeBtn.disabled = true;
    executeUpgradeBtn.textContent = 'Upgrading...';

    const promotions = pendingUpgradeAction.promotions || [];

    try {
      let successCount = 0;
      for (const item of promotions) {
        const studentRef = doc(db, "students", item.id);
        const updateData = {
          level: item.targetLevel,
          lastUpgradedAt: serverTimestamp()
        };
        if (item.targetDivision && item.targetDivision !== 'Default Div') {
          updateData.division = item.targetDivision;
        }

        await updateDoc(studentRef, updateData);
        successCount++;
      }

      toast(`Successfully upgraded ${successCount} ${successCount === 1 ? 'student' : 'students'} to next level!`, 'success');
      
      confirmUpgradeModal.style.display = 'none';
      pendingUpgradeAction = null;
      selectedStudentIds.clear();
      selectAllCheckbox.checked = false;

      // Reload fresh data
      await loadData();

    } catch (err) {
      console.error("Upgrade error:", err);
      toast("Failed to complete upgrade: " + err.message, "error");
    } finally {
      executeUpgradeBtn.disabled = false;
      executeUpgradeBtn.textContent = 'Confirm & Upgrade';
    }
  });

  // Search Input Event
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderCandidates();
    updateFilterSummaryUI();
  });

  // Reset and Clear buttons
  resetAllFiltersBtn.addEventListener('click', resetAllFilters);
  clearLevelFilterBtn.addEventListener('click', resetAllFilters);

  refreshBtn.addEventListener('click', async () => {
    toast("Refreshing candidate records...", "info");
    await loadData();
  });

  // Auth Guard & Init
  onAuthStateChanged(auth, (user) => {
    if (user) {
      loadData();
    } else {
      window.location.href = '../index.html';
    }
  });
});
