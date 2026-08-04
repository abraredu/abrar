import { toast } from './toast.js';
// js/classes.js
import { db } from './firebase-config.js';
import { collection, getDocs, query, where, orderBy, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
  const tbody = document.getElementById('classesTableBody');
  const tableHeader = document.getElementById('tableHeader');
  const tableTitle = document.getElementById('tableTitle');
  const tableDesc = document.getElementById('tableDesc');
  const addClassBtn = document.getElementById('addClassBtn');
  const groupClassTabsContainer = document.getElementById('groupClassTabsContainer');
  
  const statTitleTotal = document.getElementById('statTitleTotal');
  const statTitleActive = document.getElementById('statTitleActive');
  const statTotal = document.getElementById('statTotalClasses');
  const statActive = document.getElementById('statActiveClasses');
  const statIconTotal = document.getElementById('statIconTotal');
  const statIconActive = document.getElementById('statIconActive');

  const tabBtns = document.querySelectorAll('.tab-btn');
  let currentTab = 'group';
  let currentSubTab = 'all'; // For group tuition ('all' or classId)

  // Modal elements
  const classModal = document.getElementById('classModal');
  const classForm = document.getElementById('classForm');
  const modalTitle = document.getElementById('modalTitle');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const saveClassBtn = document.getElementById('saveClassBtn');
  const classTutorSelect = document.getElementById('classTutor');

  if (!tbody) return;

  let allClasses = [];

  // Header configs
  const headers = {
    group: `
      <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
        <th style="padding: 1rem 1.5rem; font-weight: 600; color: #475569; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Class Name</th>
        <th style="padding: 1rem 1.5rem; font-weight: 600; color: #475569; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Level</th>
        <th style="padding: 1rem 1.5rem; font-weight: 600; color: #475569; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Tutor</th>
        <th style="padding: 1rem 1.5rem; font-weight: 600; color: #475569; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Schedule</th>
        <th style="padding: 1rem 1.5rem; font-weight: 600; color: #475569; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Default Fee</th>
        <th style="padding: 1rem 1.5rem; font-weight: 600; color: #475569; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Status</th>
        <th style="padding: 1rem 1.5rem; font-weight: 600; color: #475569; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; text-align: right;">Actions</th>
      </tr>
    `,
    students: `
      <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
        <th style="padding: 1rem 1.5rem; font-weight: 600; color: #475569; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Student</th>
        <th style="padding: 1rem 1.5rem; font-weight: 600; color: #475569; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">ID</th>
        <th style="padding: 1rem 1.5rem; font-weight: 600; color: #475569; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Phone</th>
        <th style="padding: 1rem 1.5rem; font-weight: 600; color: #475569; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Tutor</th>
        <th style="padding: 1rem 1.5rem; font-weight: 600; color: #475569; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Monthly Fee</th>
        <th style="padding: 1rem 1.5rem; font-weight: 600; color: #475569; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Status</th>
        <th style="padding: 1rem 1.5rem; font-weight: 600; color: #475569; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; text-align: right;">Actions</th>
      </tr>
    `
  };

  const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

  let tutorsData = {};
  // Load tutors for the dropdown
  async function loadTutors() {
    try {
      const q = query(collection(db, "tutors"));
      const snapshot = await getDocs(q);
      tutorsData = {};
      
      if(classTutorSelect) {
        classTutorSelect.innerHTML = '<option value="">Select Tutor</option>';
      }
      
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        tutorsData[docSnap.id] = data; // store for resolving names later
        
        if (classTutorSelect) {
          const isMadrasaGroup = Array.isArray(data.tutorType) ? data.tutorType.includes('madrasa_group') : data.tutorType === 'madrasa_group';
          if (isMadrasaGroup && data.status === 'active') {
            const option = document.createElement('option');
            option.value = docSnap.id;
            option.textContent = `${data.name} (${data.tutorId})`;
            classTutorSelect.appendChild(option);
          }
        }
      });
    } catch (error) {
      console.error("Error loading tutors:", error);
    }
  }

  // Pre-fetch classes for tabs and dropdown
  async function fetchAllClasses() {
    try {
      const q = query(collection(db, "classes"), orderBy("createdAt", "asc"));
      const snapshot = await getDocs(q);
      allClasses = [];
      snapshot.forEach(doc => {
        allClasses.push({ id: doc.id, ...doc.data() });
      });
    } catch (err) {
      console.error("Error pre-fetching classes:", err);
    }
  }

  // Render Secondary Tabs (for Group Tuition)
  function renderGroupSecondaryTabs() {
    if(!groupClassTabsContainer) return;
    
    groupClassTabsContainer.style.display = 'flex';
    groupClassTabsContainer.innerHTML = '';
    
    const createTab = (id, label, isActive) => {
      const btn = document.createElement('button');
      btn.className = 'tab';
      btn.style.padding = '0.75rem 1rem';
      btn.style.cursor = 'pointer';
      btn.style.fontWeight = '500';
      btn.style.whiteSpace = 'nowrap';
      btn.style.borderBottom = '2px solid transparent';
      btn.style.background = 'none';
      btn.style.border = 'none';
      btn.style.borderBottom = isActive ? '2px solid var(--color-primary)' : '2px solid transparent';
      btn.style.color = isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)';
      btn.textContent = label;
      
      btn.addEventListener('mouseenter', () => { if(!isActive) btn.style.color = 'var(--color-text-primary)'; });
      btn.addEventListener('mouseleave', () => { if(!isActive) btn.style.color = 'var(--color-text-secondary)'; });

      btn.addEventListener('click', () => {
        currentSubTab = id;
        renderGroupSecondaryTabs(); // re-render to update active state
        loadTabData();
      });
      return btn;
    };

    groupClassTabsContainer.appendChild(createTab('all', 'Manage Classes', currentSubTab === 'all'));
    
    allClasses.forEach(cls => {
      groupClassTabsContainer.appendChild(createTab(cls.id, cls.className, currentSubTab === cls.id));
    });
  }

  // Handle Main Tab Switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      tabBtns.forEach(b => {
        b.classList.remove('btn-primary', 'active');
        b.classList.add('btn-outline');
        b.style.background = 'transparent';
        b.style.color = '';
        b.style.boxShadow = '';
      });
      
      const target = e.currentTarget;
      target.classList.remove('btn-outline');
      target.classList.add('btn-primary', 'active');
      target.style.background = '#e6f4ea';
      target.style.color = 'var(--color-primary)';
      target.style.boxShadow = 'none';

      currentTab = target.getAttribute('data-tab');
      currentSubTab = 'all'; // reset secondary tab
      loadTabData();
    });
  });

  async function loadTabData() {
    tbody.innerHTML = `
      <tr><td colspan="7" style="text-align: center; padding: 3rem; color: #64748b;">
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem;">
          <i data-lucide="loader-2" style="animation: spin 1s linear infinite; width: 32px; height: 32px; color: var(--color-primary);"></i>
          <p style="font-weight: 500;">Loading...</p>
        </div>
      </td></tr>
    `;
    lucide.createIcons();

    if (currentTab === 'group') {
      if(groupClassTabsContainer) groupClassTabsContainer.style.display = 'flex';
      renderGroupSecondaryTabs();

      if (currentSubTab === 'all') {
        tableTitle.textContent = "Manage Group Tuition";
        tableDesc.textContent = "Create and manage batches, assign tutors, and set schedules.";
        statTitleTotal.textContent = "Total Classes";
        statTitleActive.textContent = "Active Classes";
        statIconTotal.setAttribute('data-lucide', 'library');
        tableHeader.innerHTML = headers.group;
        addClassBtn.style.display = 'inline-flex';
        await loadGroupClasses();
      } else {
        const cls = allClasses.find(c => c.id === currentSubTab);
        tableTitle.textContent = cls ? `Students in ${cls.className}` : 'Group Students';
        tableDesc.textContent = "View and manage students assigned to this class.";
        statTitleTotal.textContent = "Total Students";
        statTitleActive.textContent = "Active Students";
        statIconTotal.setAttribute('data-lucide', 'users');
        tableHeader.innerHTML = headers.students;
        addClassBtn.style.display = 'none';
        await loadGroupStudents(currentSubTab);
      }
    } else {
      if(groupClassTabsContainer) groupClassTabsContainer.style.display = 'none';
      if (currentTab === 'one-to-one') {
        tableTitle.textContent = "Manage One-to-One";
        tableDesc.textContent = "View and manage students enrolled in One-to-One sessions.";
        statTitleTotal.textContent = "Total Students";
        statTitleActive.textContent = "Active Students";
        statIconTotal.setAttribute('data-lucide', 'users');
        tableHeader.innerHTML = headers.students;
        addClassBtn.style.display = 'none';
        await loadStudents('madrasa_individual');
      } else if (currentTab === 'quran') {
        tableTitle.textContent = "Manage Qur'an Recitation";
        tableDesc.textContent = "View and manage students enrolled in Qur'an Recitation sessions.";
        statTitleTotal.textContent = "Total Students";
        statTitleActive.textContent = "Active Students";
        statIconTotal.setAttribute('data-lucide', 'users');
        tableHeader.innerHTML = headers.students;
        addClassBtn.style.display = 'none';
        await loadStudents('quran_recitation');
      }
    }
    lucide.createIcons();
  }

  // Load Group Classes (Overview table)
  async function loadGroupClasses() {
    try {
      // Re-fetch to ensure freshness on load
      const q = query(collection(db, "classes"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      
      tbody.innerHTML = '';
      let total = 0;
      let active = 0;

      if (snapshot.empty) {
        renderEmptyState('No classes found', 'Get started by creating a new group tuition class.');
        updateStats(0, 0);
        return;
      }

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        total++;
        if (data.status === 'active') active++;

        let tutorName = data.tutorId || '-';
        if (data.tutorId && tutorsData[data.tutorId]) {
          tutorName = tutorsData[data.tutorId].name || data.tutorId;
        }

        const tr = createRow(data.status);
        tr.innerHTML = `
          <td style="padding: 1rem 1.5rem; font-weight: 500; color: #0f172a;">${data.className || '-'}</td>
          <td style="padding: 1rem 1.5rem; color: #475569;">${data.level || '-'}</td>
          <td style="padding: 1rem 1.5rem; color: #475569;">${tutorName}</td>
          <td style="padding: 1rem 1.5rem; color: #475569;">${data.schedule || '-'}</td>
          <td style="padding: 1rem 1.5rem; color: #475569; font-weight: 500;">${data.defaultMonthlyFee ? formatter.format(data.defaultMonthlyFee) : '-'}</td>
          <td style="padding: 1rem 1.5rem;">${getStatusBadge(data.status)}</td>
          <td style="padding: 1rem 1.5rem; text-align: right;">
            <button class="btn-edit" data-id="${docSnap.id}" style="background:none; border:none; color: #64748b; margin-right: 0.75rem; cursor:pointer; padding: 0.25rem; border-radius: 0.25rem; transition: all 0.2s;" title="Edit" onmouseover="this.style.color='#0ea5e9'; this.style.backgroundColor='#e0f2fe';" onmouseout="this.style.color='#64748b'; this.style.backgroundColor='transparent';"><i data-lucide="edit" style="width: 18px; height: 18px;"></i></button>
            <button class="btn-delete" data-id="${docSnap.id}" style="background:none; border:none; color: #64748b; cursor:pointer; padding: 0.25rem; border-radius: 0.25rem; transition: all 0.2s;" title="Delete" onmouseover="this.style.color='#ef4444'; this.style.backgroundColor='#fee2e2';" onmouseout="this.style.color='#64748b'; this.style.backgroundColor='transparent';"><i data-lucide="trash" style="width: 18px; height: 18px;"></i></button>
          </td>
        `;
        tbody.appendChild(tr);

        tr.querySelector('.btn-edit').addEventListener('click', () => openModal(docSnap.id, data));
        tr.querySelector('.btn-delete').addEventListener('click', () => deleteClass(docSnap.id));
      });
      
      updateStats(total, active);
    } catch (error) {
      renderError(error);
    }
  }

  // Load Students in a specific class
  async function loadGroupStudents(classId) {
    try {
      const cls = allClasses.find(c => c.id === classId);
      const q = query(collection(db, "students"), where("courseType", "==", "madrasa_group"));
      const snapshot = await getDocs(q);
      
      tbody.innerHTML = '';
      let total = 0;
      let active = 0;
      const docs = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        let isMatch = false;
        if (data.classId === classId) {
          isMatch = true;
        } else if (data.level && cls) {
          const studentLevel = data.level.toLowerCase().trim();
          const cName = (cls.className || '').toLowerCase().trim();
          const cLevel = (cls.level || '').toLowerCase().trim();
          if (studentLevel === cName || studentLevel === cLevel) {
             isMatch = true;
          }
        }
        if (isMatch) {
          docs.push({ id: doc.id, ...data });
        }
      });

      if (docs.length === 0) {
        renderEmptyState('No students found', 'No students are assigned to this class.');
        updateStats(0, 0);
        return;
      }
      
      docs.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());

      docs.forEach((data) => {
        total++;
        if (data.status === 'active') active++;

        let tutorName = data.tutorId || '-';
        if (data.tutorId && tutorsData[data.tutorId]) {
          tutorName = tutorsData[data.tutorId].name || data.tutorId;
        }

        const tr = createRow(data.status);
        tr.innerHTML = `
          <td style="padding: 1rem 1.5rem;">
            <div style="font-weight: 500; color: #0f172a;">${data.name || '-'}</div>
            <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">${data.parentName || ''}</div>
          </td>
          <td style="padding: 1rem 1.5rem; color: #475569;">${data.studentId || '-'}</td>
          <td style="padding: 1rem 1.5rem; color: #475569;">${data.phone || '-'}</td>
          <td style="padding: 1rem 1.5rem; color: #475569;">${tutorName}</td>
          <td style="padding: 1rem 1.5rem; color: #475569; font-weight: 500;">${data.monthlyFee ? formatter.format(data.monthlyFee) : '-'}</td>
          <td style="padding: 1rem 1.5rem;">${getStatusBadge(data.status)}</td>
          <td style="padding: 1rem 1.5rem; text-align: right;">
            <a href="../students/student-view.html?id=${data.id}" style="display: inline-block; color: #64748b; padding: 0.25rem; border-radius: 0.25rem; transition: all 0.2s;" title="View" onmouseover="this.style.color='#0ea5e9'; this.style.backgroundColor='#e0f2fe';" onmouseout="this.style.color='#64748b'; this.style.backgroundColor='transparent';"><i data-lucide="eye" style="width: 18px; height: 18px;"></i></a>
          </td>
        `;
        tbody.appendChild(tr);
      });
      
      updateStats(total, active);
    } catch (error) {
      renderError(error);
    }
  }

  // Load Students (One-to-One / Quran)
  async function loadStudents(courseType) {
    try {
      const q = query(collection(db, "students"), where("courseType", "==", courseType));
      const snapshot = await getDocs(q);
      
      tbody.innerHTML = '';
      let total = 0;
      let active = 0;

      if (snapshot.empty) {
        renderEmptyState('No students found', 'No students are enrolled in this course yet.');
        updateStats(0, 0);
        return;
      }
      
      const docs = [];
      snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
      docs.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());

      docs.forEach((data) => {
        total++;
        if (data.status === 'active') active++;

        let tutorName = data.tutorId || '-';
        if (data.tutorId && tutorsData[data.tutorId]) {
          tutorName = tutorsData[data.tutorId].name || data.tutorId;
        }

        const tr = createRow(data.status);
        tr.innerHTML = `
          <td style="padding: 1rem 1.5rem;">
            <div style="font-weight: 500; color: #0f172a;">${data.name || '-'}</div>
            <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">${data.parentName || ''}</div>
          </td>
          <td style="padding: 1rem 1.5rem; color: #475569;">${data.studentId || '-'}</td>
          <td style="padding: 1rem 1.5rem; color: #475569;">${data.phone || '-'}</td>
          <td style="padding: 1rem 1.5rem; color: #475569;">${tutorName}</td>
          <td style="padding: 1rem 1.5rem; color: #475569; font-weight: 500;">${data.monthlyFee ? formatter.format(data.monthlyFee) : '-'}</td>
          <td style="padding: 1rem 1.5rem;">${getStatusBadge(data.status)}</td>
          <td style="padding: 1rem 1.5rem; text-align: right;">
            <a href="../students/student-view.html?id=${data.id}" style="display: inline-block; color: #64748b; padding: 0.25rem; border-radius: 0.25rem; transition: all 0.2s;" title="View" onmouseover="this.style.color='#0ea5e9'; this.style.backgroundColor='#e0f2fe';" onmouseout="this.style.color='#64748b'; this.style.backgroundColor='transparent';"><i data-lucide="eye" style="width: 18px; height: 18px;"></i></a>
          </td>
        `;
        tbody.appendChild(tr);
      });
      
      updateStats(total, active);
    } catch (error) {
      renderError(error);
    }
  }

  // Helpers
  function getStatusBadge(status) {
    return status === 'active' 
      ? `<span style="background: #dcfce7; color: #166534; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; display: inline-block;">Active</span>`
      : `<span style="background: #fee2e2; color: #991b1b; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; display: inline-block;">${status}</span>`;
  }

  function createRow() {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #f1f5f9';
    tr.style.transition = 'background-color 0.2s';
    tr.onmouseenter = () => tr.style.backgroundColor = '#f8fafc';
    tr.onmouseleave = () => tr.style.backgroundColor = 'transparent';
    return tr;
  }

  function renderEmptyState(title, desc) {
    tbody.innerHTML = `
      <tr><td colspan="7" style="text-align: center; padding: 4rem 2rem; color: #64748b;">
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem;">
          <i data-lucide="inbox" style="width: 48px; height: 48px; color: #cbd5e1;"></i>
          <p style="font-size: 1.125rem; font-weight: 500; color: #334155;">${title}</p>
          <p style="font-size: 0.875rem;">${desc}</p>
        </div>
      </td></tr>
    `;
    lucide.createIcons();
  }

  function renderError(error) {
    console.error("Error fetching data: ", error);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 3rem; color: #ef4444;">Error loading data: ${error.message}</td></tr>`;
  }

  function updateStats(total, active) {
    statTotal.textContent = total;
    statActive.textContent = active;
  }

  // Modal logic for Group Tuition Classes
  function openModal(id = null, data = null) {
    if(!classModal) return;
    document.getElementById('classId').value = id || '';
    document.getElementById('className').value = data ? data.className : '';
    document.getElementById('classLevel').value = data ? data.level : '';
    document.getElementById('classTutor').value = data ? data.tutorId : '';
    document.getElementById('schedule').value = data ? data.schedule : '';
    document.getElementById('defaultFee').value = data ? data.defaultMonthlyFee : '';
    document.getElementById('classStatus').value = data ? data.status : 'active';
    
    modalTitle.textContent = id ? 'Edit Class' : 'Add Class';
    classModal.style.display = 'flex';
  }

  function closeModal() {
    if(classModal) classModal.style.display = 'none';
    if(classForm) classForm.reset();
  }

  if(addClassBtn) addClassBtn.addEventListener('click', () => openModal());
  if(closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

  if(classForm) {
    classForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      saveClassBtn.disabled = true;
      saveClassBtn.textContent = 'Saving...';

      const id = document.getElementById('classId').value;
      const classData = {
        className: document.getElementById('className').value,
        level: document.getElementById('classLevel').value,
        tutorId: document.getElementById('classTutor').value,
        schedule: document.getElementById('schedule').value,
        defaultMonthlyFee: parseFloat(document.getElementById('defaultFee').value) || 0,
        status: document.getElementById('classStatus').value
      };

      try {
        if (id) {
          classData.updatedAt = serverTimestamp();
          await updateDoc(doc(db, "classes", id), classData);
        } else {
          classData.createdAt = serverTimestamp();
          await addDoc(collection(db, "classes"), classData);
        }
        closeModal();
        await fetchAllClasses(); // refresh tab list
        loadTabData(); // refresh active view
      } catch (error) {
        console.error("Error saving class:", error);
        toast.error("Error saving class: " + error.message);
      } finally {
        saveClassBtn.disabled = false;
        saveClassBtn.textContent = 'Save';
      }
    });
  }

  // Delete Group Tuition Class
  async function deleteClass(id) {
    if (confirm("Are you sure you want to delete this class?")) {
      try {
        await deleteDoc(doc(db, "classes", id));
        await fetchAllClasses(); // refresh tab list
        if(currentSubTab === id) currentSubTab = 'all'; // if they deleted active tab, reset
        loadTabData();
      } catch (error) {
        console.error("Error deleting class:", error);
        toast.error("Error deleting class: " + error.message);
      }
    }
  }

  // Initialize
  loadTutors();
  await fetchAllClasses();
  loadTabData();
});
