// js/manage.js
import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('courseManageForm');
  const tbody = document.getElementById('courseTableBody');
  
  if (!form || !tbody) return;

  let addCourseDivisions = [];
  let editCourseDivisions = [];
  let currentDivisionsMode = null; // 'add' or 'edit'

  const updateDivisionsPreview = (mode) => {
    const divs = mode === 'add' ? addCourseDivisions : editCourseDivisions;
    const previewEl = document.getElementById(mode === 'add' ? 'divisionsListPreview' : 'editDivisionsPreview');
    if (divs.length > 0) {
      previewEl.innerHTML = divs.map(d => `<span style="background: #e6f4ea; color: var(--color-primary); border: 1px solid rgba(8,122,66,0.2); padding: 4px 10px; border-radius: 99px; font-weight: 500; font-size: 0.75rem; margin-right: 6px; display: inline-block; margin-bottom: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">${d}</span>`).join('') + ` <span style="color: var(--color-text-secondary); cursor: pointer; text-decoration: underline; font-size: 0.75rem; margin-left: 4px; transition: color var(--transition-fast);" class="edit-divs-link" data-mode="${mode}" onmouseover="this.style.color='var(--color-primary)'" onmouseout="this.style.color='var(--color-text-secondary)'">Modify</span>`;
    } else {
      previewEl.innerHTML = '<span style="color: #94a3b8; font-style: italic;">Enabled (0 divisions)</span> <span style="color: var(--color-primary); cursor: pointer; font-weight: 500; font-size: 0.75rem; margin-left: 4px;" class="edit-divs-link" data-mode="${mode}">+ Add</span>';
    }
  };

  const renderDivisionsList = () => {
    const listEl = document.getElementById('divisionsList');
    listEl.innerHTML = '';
    const divs = currentDivisionsMode === 'add' ? addCourseDivisions : editCourseDivisions;
    
    if (divs.length === 0) {
      listEl.innerHTML = '<li style="padding: 1rem; text-align: center; color: #94a3b8; font-size: 0.875rem;">No divisions added yet.</li>';
      return;
    }

    divs.forEach((div, index) => {
      const li = document.createElement('li');
      li.style.cssText = 'padding: 0.75rem 1rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-border); background: #f8fafc; margin-bottom: 4px; border-radius: var(--radius-sm);';
      li.innerHTML = `
        <span style="font-weight: 500; color: #1e293b;">${div}</span>
        <div style="display: flex; gap: 0.5rem;">
          <button type="button" class="edit-div-btn" data-index="${index}" style="background: #e0f2fe; border: none; color: #0284c7; cursor: pointer; padding: 0.4rem; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"><i data-lucide="edit-2" style="width: 14px; height: 14px;"></i></button>
          <button type="button" class="remove-div-btn" data-index="${index}" style="background: #fee2e2; border: none; color: #ef4444; cursor: pointer; padding: 0.4rem; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"><i data-lucide="x" style="width: 14px; height: 14px;"></i></button>
        </div>
      `;
      listEl.appendChild(li);
    });
    if (window.lucide) lucide.createIcons();
  };

  const openDivisionsModal = (mode) => {
    currentDivisionsMode = mode;
    renderDivisionsList();
    document.getElementById('divisionsModal').style.display = 'flex';
  };

  document.getElementById('hasDivisionsToggle').addEventListener('change', (e) => {
    if (e.target.checked) {
      addCourseDivisions = [];
      openDivisionsModal('add');
    } else {
      addCourseDivisions = [];
      document.getElementById('divisionsListPreview').innerHTML = 'Disabled';
    }
  });

  document.getElementById('editHasDivisionsToggle').addEventListener('change', (e) => {
    if (e.target.checked) {
      if (editCourseDivisions.length === 0) editCourseDivisions = [];
      openDivisionsModal('edit');
    } else {
      editCourseDivisions = [];
      document.getElementById('editDivisionsPreview').innerHTML = '';
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('edit-divs-link')) {
      openDivisionsModal(e.target.getAttribute('data-mode'));
    }
    
    const removeBtn = e.target.closest('.remove-div-btn');
    if (removeBtn) {
      const index = parseInt(removeBtn.getAttribute('data-index'));
      if (currentDivisionsMode === 'add') {
        addCourseDivisions.splice(index, 1);
      } else {
        editCourseDivisions.splice(index, 1);
      }
      renderDivisionsList();
      return;
    }

    const editDivBtn = e.target.closest('.edit-div-btn');
    if (editDivBtn) {
      const index = parseInt(editDivBtn.getAttribute('data-index'));
      const activeDivs = currentDivisionsMode === 'add' ? addCourseDivisions : editCourseDivisions;
      const currentVal = activeDivs[index];
      const newVal = prompt("Edit division name:", currentVal);
      if (newVal !== null && newVal.trim() !== "") {
        activeDivs[index] = newVal.trim();
        renderDivisionsList();
      }
    }
  });

  document.getElementById('addDivisionBtn').addEventListener('click', () => {
    const input = document.getElementById('newDivisionInput');
    const val = input.value.trim();
    if (val) {
      if (currentDivisionsMode === 'add') {
        if (!addCourseDivisions.includes(val)) addCourseDivisions.push(val);
      } else {
        if (!editCourseDivisions.includes(val)) editCourseDivisions.push(val);
      }
      input.value = '';
      renderDivisionsList();
    }
  });

  document.getElementById('doneDivisionsBtn').addEventListener('click', () => {
    document.getElementById('divisionsModal').style.display = 'none';
    if (currentDivisionsMode) {
      updateDivisionsPreview(currentDivisionsMode);
    }
  });

  const loadCourses = async () => {
    try {
      const q = query(collection(db, "managed_courses"), orderBy("serialNo"));
      const snapshot = await getDocs(q);
      
      tbody.innerHTML = '';
      
      if (snapshot.empty) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;">No courses found.</td></tr>';
        return;
      }

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #f1f5f9';
        
        tr.innerHTML = `
          <td style="padding: 1rem 1.5rem; color: #475569; font-weight: 500;">${data.serialNo || '-'}</td>
          <td style="padding: 1rem 1.5rem; font-weight: 500; color: #0f172a;">${data.courseName || '-'}</td>
          <td style="padding: 1rem 1.5rem; color: #475569;">${data.divisions || '-'}</td>
          <td style="padding: 1rem 1.5rem; display: flex; gap: 0.5rem; align-items: center;">
            <button class="edit-btn" data-id="${docSnap.id}" data-name="${data.courseName || ''}" data-divs="${data.divisions || ''}" data-serial="${data.serialNo || ''}" style="background: none; border: none; color: #3b82f6; cursor: pointer; padding: 0;" title="Edit">
              <i data-lucide="edit-2" style="width: 18px; height: 18px;"></i>
            </button>
            <button class="delete-btn" data-id="${docSnap.id}" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 0;" title="Delete">
              <i data-lucide="trash-2" style="width: 18px; height: 18px;"></i>
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
      
      if (window.lucide) {
        lucide.createIcons();
      }
    } catch (err) {
      console.error("Error loading courses:", err);
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: #ef4444;">Failed to load courses.</td></tr>';
    }
  };

  await loadCourses();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    
    try {
      btn.innerHTML = 'Saving...';
      btn.disabled = true;

      const courseData = {
        courseName: document.getElementById('courseName').value,
        divisions: document.getElementById('hasDivisionsToggle').checked ? addCourseDivisions.join(', ') : '',
        serialNo: document.getElementById('serialNo').value,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "managed_courses"), courseData);
      
      form.reset();
      addCourseDivisions = [];
      document.getElementById('divisionsListPreview').innerHTML = 'Disabled';
      await loadCourses();
    } catch (err) {
      console.error("Error saving course:", err);
      alert("Failed to save course.");
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
      if (window.lucide) {
        lucide.createIcons();
      }
    }
  });

  tbody.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
      if (confirm('Are you sure you want to delete this course?')) {
        try {
          await deleteDoc(doc(db, "managed_courses", deleteBtn.getAttribute('data-id')));
          await loadCourses();
        } catch (err) {
          console.error("Error deleting course:", err);
          alert("Failed to delete course.");
        }
      }
      return;
    }

    const editBtn = e.target.closest('.edit-btn');
    if (editBtn) {
      document.getElementById('editCourseId').value = editBtn.getAttribute('data-id');
      document.getElementById('editCourseName').value = editBtn.getAttribute('data-name');
      document.getElementById('editSerialNo').value = editBtn.getAttribute('data-serial');
      
      const divs = editBtn.getAttribute('data-divs');
      if (divs && divs.trim() !== '') {
        editCourseDivisions = divs.split(',').map(d => d.trim()).filter(d => d);
        document.getElementById('editHasDivisionsToggle').checked = true;
        updateDivisionsPreview('edit');
      } else {
        editCourseDivisions = [];
        document.getElementById('editHasDivisionsToggle').checked = false;
        document.getElementById('editDivisionsPreview').innerHTML = '';
      }
      
      document.getElementById('editCourseModal').style.display = 'flex';
    }
  });

  document.getElementById('closeEditModalBtn').addEventListener('click', () => {
    document.getElementById('editCourseModal').style.display = 'none';
  });

  document.getElementById('editCourseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveEditCourseBtn');
    const originalText = btn.innerHTML;
    
    try {
      btn.innerHTML = 'Saving...';
      btn.disabled = true;

      const courseId = document.getElementById('editCourseId').value;
      const courseData = {
        courseName: document.getElementById('editCourseName').value,
        divisions: document.getElementById('editHasDivisionsToggle').checked ? editCourseDivisions.join(', ') : '',
        serialNo: document.getElementById('editSerialNo').value
      };

      await updateDoc(doc(db, "managed_courses", courseId), courseData);
      
      document.getElementById('editCourseModal').style.display = 'none';
      await loadCourses();
    } catch (err) {
      console.error("Error updating course:", err);
      alert("Failed to update course.");
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
      if (window.lucide) {
        lucide.createIcons();
      }
    }
  });

});
