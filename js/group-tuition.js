// js/group-tuition.js
import { db } from './firebase-config.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
  const tbody = document.getElementById('groupTableBody');
  const tabsContainer = document.getElementById('classTabsContainer');
  let allStudents = [];
  let allClasses = [];
  
  if (!tbody || !tabsContainer) return;

  const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

  // Render Table Function
  function renderTable(filterClassId = 'all') {
    tbody.innerHTML = '';
    
    const filtered = filterClassId === 'all' 
      ? allStudents 
      : allStudents.filter(s => s.classId === filterClassId || s.level === filterClassId);
      
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="7" style="text-align: center; padding: 4rem 2rem; color: #64748b;">
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem;">
            <i data-lucide="inbox" style="width: 48px; height: 48px; color: #cbd5e1;"></i>
            <p style="font-size: 1.125rem; font-weight: 500; color: #334155;">No students found</p>
            <p style="font-size: 0.875rem;">No students are assigned to this class.</p>
          </div>
        </td></tr>
      `;
      lucide.createIcons();
      return;
    }

    filtered.forEach((data) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #f1f5f9';
      tr.style.transition = 'background-color 0.2s';
      tr.onmouseenter = () => tr.style.backgroundColor = '#f8fafc';
      tr.onmouseleave = () => tr.style.backgroundColor = 'transparent';
      
      const statusBadge = data.status === 'active' 
        ? `<span style="background: #dcfce7; color: #166534; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; display: inline-block;">Active</span>`
        : `<span style="background: #fee2e2; color: #991b1b; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; display: inline-block;">${data.status}</span>`;

      // Find class name
      let className = data.level || '-';
      if (data.classId) {
        const cls = allClasses.find(c => c.id === data.classId);
        if (cls) className = cls.className;
      }

      tr.innerHTML = `
        <td style="padding: 1rem 1.5rem;">
          <div style="font-weight: 500; color: #0f172a;">${data.name || '-'}</div>
          <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">${data.parentName || ''}</div>
        </td>
        <td style="padding: 1rem 1.5rem; color: #475569;">${data.studentId || '-'}</td>
        <td style="padding: 1rem 1.5rem; color: #475569;">${className}</td>
        <td style="padding: 1rem 1.5rem; color: #475569;">${data.tutorId || '-'}</td>
        <td style="padding: 1rem 1.5rem; color: #475569; font-weight: 500;">${data.monthlyFee ? formatter.format(data.monthlyFee) : '-'}</td>
        <td style="padding: 1rem 1.5rem;">${statusBadge}</td>
        <td style="padding: 1rem 1.5rem; text-align: right;">
          <a href="../students/student-view.html?id=${data.id}" style="display: inline-block; color: #64748b; padding: 0.25rem; border-radius: 0.25rem; transition: all 0.2s;" title="View" onmouseover="this.style.color='#0ea5e9'; this.style.backgroundColor='#e0f2fe';" onmouseout="this.style.color='#64748b'; this.style.backgroundColor='transparent';"><i data-lucide="eye" style="width: 18px; height: 18px;"></i></a>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
    lucide.createIcons();
  }

  // Load Classes for Tabs
  async function loadClasses() {
    try {
      const q = query(collection(db, "classes"), orderBy("createdAt", "asc"));
      const snapshot = await getDocs(q);
      
      snapshot.forEach(doc => {
        allClasses.push({ id: doc.id, ...doc.data() });
      });

      renderTabs();
    } catch (err) {
      console.error("Error fetching classes:", err);
    }
  }

  function renderTabs() {
    tabsContainer.innerHTML = '';
    
    const createTab = (id, label, isActive) => {
      const btn = document.createElement('button');
      btn.className = \`btn \${isActive ? 'btn-primary' : 'btn-outline'} tab-btn\`;
      btn.style.borderRadius = 'var(--radius-pill)';
      btn.style.padding = '0.5rem 1.25rem';
      btn.style.border = isActive ? 'none' : '1px solid var(--color-border)';
      btn.style.boxShadow = 'none';
      if (isActive) {
        btn.style.background = '#e6f4ea';
        btn.style.color = 'var(--color-primary)';
      }
      btn.textContent = label;
      btn.setAttribute('data-class-id', id);
      
      btn.addEventListener('click', () => {
        // Update active states
        tabsContainer.querySelectorAll('.tab-btn').forEach(t => {
          t.classList.remove('btn-primary');
          t.classList.add('btn-outline');
          t.style.background = 'transparent';
          t.style.color = '';
          t.style.border = '1px solid var(--color-border)';
        });
        btn.classList.remove('btn-outline');
        btn.classList.add('btn-primary');
        btn.style.background = '#e6f4ea';
        btn.style.color = 'var(--color-primary)';
        btn.style.border = 'none';
        
        renderTable(id);
      });
      return btn;
    };

    // "All Classes" tab
    tabsContainer.appendChild(createTab('all', 'All Classes', true));

    // Dynamic class tabs
    allClasses.forEach(cls => {
      tabsContainer.appendChild(createTab(cls.id, cls.className, false));
    });
  }

  // Load Students
  async function loadStudents() {
    try {
      const q = query(
        collection(db, "students"), 
        where("courseType", "==", "madrasa_group")
      );
      
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => allStudents.push({ id: doc.id, ...doc.data() }));
      
      allStudents.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      
      renderTable('all');
      
    } catch (error) {
      console.error("Error fetching students: ", error);
      tbody.innerHTML = \`<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #ef4444;">Error loading students: \${error.message}</td></tr>\`;
    }
  }

  // Initialize
  await loadClasses();
  await loadStudents();
});
