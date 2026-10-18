// js/admission.js
import { db, auth } from './firebase-config.js';
import { collection, getDocs, doc, updateDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { toast } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('admissionsTableBody');
  const statTotal = document.getElementById('statTotal');
  const statPending = document.getElementById('statPending');
  const statAccepted = document.getElementById('statAccepted');
  const statToday = document.getElementById('statToday');
  const searchInput = document.getElementById('searchInput');
  const courseFilter = document.getElementById('courseFilter');
  const statusTabs = document.getElementById('admissionStatusTabs');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const bulkAcceptBtn = document.getElementById('bulkAcceptBtn');

  if (!tbody) return;

  let allStudents = [];
  let currentStatusFilter = '';

  function getTodayDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function resolveStudentStatus(data) {
    if (data.admissionStatus) {
      return data.admissionStatus.toLowerCase();
    }
    // Backward compatibility: If admissionDate is set and non-empty, consider accepted
    if (data.admissionDate && data.admissionDate.trim() !== '' && data.admissionDate !== '-') {
      return 'accepted';
    }
    return 'pending';
  }

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        // Load Courses for Filter
        try {
          const coursesQ = query(collection(db, "managed_courses"));
          const coursesSnap = await getDocs(coursesQ);
          coursesSnap.forEach(cdoc => {
            const cdata = cdoc.data();
            const option = document.createElement('option');
            option.value = cdata.courseName;
            option.textContent = cdata.courseName;
            courseFilter.appendChild(option);
          });
        } catch (cErr) {
          console.warn("Could not load managed courses:", cErr);
        }

        // Load Students
        let snapshot;
        try {
          const q = query(collection(db, "students"), orderBy("createdAt", "desc"));
          snapshot = await getDocs(q);
        } catch (e) {
          // Fallback if orderBy without index fails
          snapshot = await getDocs(collection(db, "students"));
        }

        allStudents = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          allStudents.push({
            id: docSnap.id,
            ...data,
            admissionStatus: resolveStudentStatus(data)
          });
        });

        setupEvents();
        renderTable();

      } catch (err) {
        console.error("Error loading admissions:", err);
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 2rem; color: #ef4444;">Failed to load data: ${err.message}</td></tr>`;
      }
    }
  });

  function updateStats() {
    const todayStr = getTodayDateString();
    let total = allStudents.length;
    let pending = 0;
    let accepted = 0;
    let todayCount = 0;

    allStudents.forEach(s => {
      const status = resolveStudentStatus(s);
      if (status === 'accepted') {
        accepted++;
        if (s.admissionDate === todayStr) {
          todayCount++;
        }
      } else {
        pending++;
      }
    });

    if (statTotal) statTotal.textContent = total;
    if (statPending) statPending.textContent = pending;
    if (statAccepted) statAccepted.textContent = accepted;
    if (statToday) statToday.textContent = todayCount;
  }

  function getFilteredStudents() {
    const term = (searchInput ? searchInput.value : '').toLowerCase().trim();
    const course = courseFilter ? courseFilter.value : '';
    const status = currentStatusFilter;

    return allStudents.filter(student => {
      const studentStatus = resolveStudentStatus(student);
      const matchesSearch = !term ||
        (student.name && student.name.toLowerCase().includes(term)) ||
        (student.studentId && student.studentId.toLowerCase().includes(term)) ||
        (student.phone && student.phone.toLowerCase().includes(term)) ||
        (student.parentName && student.parentName.toLowerCase().includes(term)) ||
        (student.place && student.place.toLowerCase().includes(term));

      const matchesCourse = !course || student.course === course || student.courseType === course;
      const matchesStatus = !status || studentStatus === status;

      return matchesSearch && matchesCourse && matchesStatus;
    });
  }

  function renderTable() {
    updateStats();
    const filtered = getFilteredStudents();

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 2.5rem; color: #64748b;">No students found matching current filters.</td></tr>`;
      if (bulkAcceptBtn) bulkAcceptBtn.style.display = 'none';
      return;
    }

    tbody.innerHTML = '';

    filtered.forEach(student => {
      const status = resolveStudentStatus(student);
      const tr = document.createElement('tr');
      tr.id = `row-${student.id}`;
      tr.style.borderBottom = '1px solid #f1f5f9';
      tr.style.transition = 'background-color 0.15s ease';
      tr.onmouseenter = () => tr.style.backgroundColor = '#f8fafc';
      tr.onmouseleave = () => tr.style.backgroundColor = 'transparent';

      const contactHtml = `
        <div style="font-size: 0.875rem; color: #1e293b;">${student.phone || '-'}</div>
        ${student.whatsapp && student.whatsapp !== student.phone ? `<div style="font-size: 0.75rem; color: #087A42; font-weight: 500;">WA: ${student.whatsapp}</div>` : ''}
      `;

      const courseDisplay = student.course || student.courseType || '-';
      const levelDisplay = student.level ? `<span style="font-size: 0.75rem; color: #64748b;"> (${student.level})</span>` : '';

      // Status pill & Action UI
      let statusHtml = '';
      if (status === 'accepted') {
        statusHtml = `
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <span class="badge" style="background-color: #dcfce7; color: #15803d; padding: 0.35rem 0.7rem; border-radius: 9999px; font-weight: 600; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 0.35rem;">
              <i data-lucide="check-circle-2" style="width: 14px; height: 14px;"></i> Accepted
            </span>
            <button class="btn-status-toggle" data-id="${student.id}" data-action="pending" style="background: none; border: 1px solid #cbd5e1; color: #64748b; font-size: 0.75rem; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer; transition: all 0.2s;" title="Revert to Pending">
              Make Pending
            </button>
          </div>
        `;
      } else {
        statusHtml = `
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <span class="badge" style="background-color: #fef3c7; color: #b45309; padding: 0.35rem 0.7rem; border-radius: 9999px; font-weight: 600; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 0.35rem;">
              <i data-lucide="clock" style="width: 14px; height: 14px;"></i> Pending
            </span>
            <button class="btn btn-sm btn-status-toggle" data-id="${student.id}" data-action="accept" style="background-color: var(--color-primary); color: white; border: none; font-size: 0.75rem; font-weight: 600; padding: 0.35rem 0.7rem; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem;" title="Accept admission and save today's date">
              <i data-lucide="check" style="width: 13px; height: 13px;"></i> Accept
            </button>
          </div>
        `;
      }

      // Admission Date display & inline quick edit
      const admissionDateDisplay = student.admissionDate ? `
        <div style="display: flex; align-items: center; gap: 0.4rem;">
          <span style="font-weight: 500; color: #0f172a;">${student.admissionDate}</span>
          <input type="date" class="date-edit-input" data-id="${student.id}" value="${student.admissionDate}" style="display: none; padding: 0.2rem 0.4rem; font-size: 0.8rem; border: 1px solid var(--color-border); border-radius: 4px;">
          <button class="btn-toggle-date" data-id="${student.id}" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 2px;" title="Edit Date">
            <i data-lucide="calendar" style="width: 14px; height: 14px;"></i>
          </button>
        </div>
      ` : `
        <div style="display: flex; align-items: center; gap: 0.4rem;">
          <span style="color: #94a3b8; font-style: italic; font-size: 0.8125rem;">Auto on Accept</span>
          <input type="date" class="date-edit-input" data-id="${student.id}" style="display: none; padding: 0.2rem 0.4rem; font-size: 0.8rem; border: 1px solid var(--color-border); border-radius: 4px;">
          <button class="btn-toggle-date" data-id="${student.id}" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 2px;" title="Set Date Manually">
            <i data-lucide="calendar-plus" style="width: 14px; height: 14px;"></i>
          </button>
        </div>
      `;

      // Left Status display & interactive date selection
      let leftStatusHtml = '';
      if (student.leftDate && student.leftDate.trim() !== '' && student.leftDate !== '-') {
        leftStatusHtml = `
          <div class="left-status-box" data-id="${student.id}" style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
            <div class="left-status-display" style="display: flex; align-items: center; gap: 0.35rem;">
              <span class="badge" style="background-color: #fee2e2; color: #b91c1c; padding: 0.35rem 0.65rem; border-radius: 9999px; font-weight: 600; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 0.35rem; border: 1px solid #fecaca;">
                <i data-lucide="user-x" style="width: 13px; height: 13px;"></i> Left: ${student.leftDate}
              </span>
              <button type="button" class="btn-toggle-left-date" data-id="${student.id}" style="background: none; border: none; color: #64748b; cursor: pointer; padding: 2px; display: inline-flex; align-items: center;" title="Edit Left Date">
                <i data-lucide="calendar" style="width: 14px; height: 14px;"></i>
              </button>
              <button type="button" class="btn-clear-left-date" data-id="${student.id}" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 2px; display: inline-flex; align-items: center;" title="Remove Left Status">
                <i data-lucide="x" style="width: 14px; height: 14px;"></i>
              </button>
            </div>
            <div class="left-edit-wrap" style="display: none; align-items: center; gap: 0.3rem;">
              <input type="date" class="left-date-input" data-id="${student.id}" value="${student.leftDate}" style="padding: 0.2rem 0.4rem; font-size: 0.8rem; border: 1px solid #fda4af; border-radius: 4px; outline: none; background: #fff;">
              <button type="button" class="btn-save-left-input" data-id="${student.id}" style="background: #10b981; color: white; border: none; border-radius: 4px; padding: 0.25rem 0.45rem; cursor: pointer; display: inline-flex; align-items: center;" title="Save Left Date">
                <i data-lucide="check" style="width: 12px; height: 12px;"></i>
              </button>
              <button type="button" class="btn-cancel-left-edit" data-id="${student.id}" style="background: #f1f5f9; color: #64748b; border: none; border-radius: 4px; padding: 0.25rem 0.45rem; cursor: pointer; display: inline-flex; align-items: center;" title="Cancel">
                <i data-lucide="x" style="width: 12px; height: 12px;"></i>
              </button>
            </div>
          </div>
        `;
      } else {
        leftStatusHtml = `
          <div class="left-status-box" data-id="${student.id}" style="display: flex; align-items: center; gap: 0.4rem;">
            <button type="button" class="btn btn-sm btn-mark-left" data-id="${student.id}" style="background-color: #fff1f2; color: #e11d48; border: 1px solid #fecdd3; font-size: 0.75rem; font-weight: 600; padding: 0.35rem 0.7rem; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; transition: all 0.2s;" title="Click to select Left date">
              <i data-lucide="calendar-plus" style="width: 13px; height: 13px;"></i> Left
            </button>
            <div class="left-input-wrap" style="display: none; align-items: center; gap: 0.3rem;">
              <input type="date" class="left-date-input" data-id="${student.id}" value="${getTodayDateString()}" style="padding: 0.2rem 0.4rem; font-size: 0.8rem; border: 1px solid #fda4af; border-radius: 4px; outline: none; background: #fff;">
              <button type="button" class="btn-save-left-input" data-id="${student.id}" style="background: #10b981; color: white; border: none; border-radius: 4px; padding: 0.25rem 0.45rem; cursor: pointer; display: inline-flex; align-items: center;" title="Save Left Date">
                <i data-lucide="check" style="width: 12px; height: 12px;"></i>
              </button>
              <button type="button" class="btn-cancel-left-input" data-id="${student.id}" style="background: #f1f5f9; color: #64748b; border: none; border-radius: 4px; padding: 0.25rem 0.45rem; cursor: pointer; display: inline-flex; align-items: center;" title="Cancel">
                <i data-lucide="x" style="width: 12px; height: 12px;"></i>
              </button>
            </div>
          </div>
        `;
      }

      tr.innerHTML = `
        <td style="padding: 1rem 1.25rem;"><input type="checkbox" class="row-checkbox" value="${student.id}" data-status="${status}"></td>
        <td style="padding: 1rem 1.25rem; color: #475569; font-weight: 500;">${student.studentId || '-'}</td>
        <td style="padding: 1rem 1.25rem;">
          <div style="font-weight: 600; color: #0f172a;">${student.name || '-'}</div>
          ${student.place ? `<div style="font-size: 0.75rem; color: #64748b;">${student.place}</div>` : ''}
        </td>
        <td style="padding: 1rem 1.25rem; color: #475569;">${student.parentName || student.fatherName || '-'}</td>
        <td style="padding: 1rem 1.25rem;">${contactHtml}</td>
        <td style="padding: 1rem 1.25rem; color: #475569;">${courseDisplay}${levelDisplay}</td>
        <td style="padding: 1rem 1.25rem;">${statusHtml}</td>
        <td style="padding: 1rem 1.25rem;">${admissionDateDisplay}</td>
        <td style="padding: 1rem 1.25rem;">${leftStatusHtml}</td>
        <td style="padding: 1rem 1.25rem; display: flex; gap: 0.5rem; align-items: center;">
          <a href="student-view.html?id=${student.id}" style="color: #64748b;" title="View Student"><i data-lucide="eye" style="width: 18px; height: 18px;"></i></a>
          <a href="edit-student.html?id=${student.id}" style="color: #64748b;" title="Edit Student"><i data-lucide="edit" style="width: 18px; height: 18px;"></i></a>
        </td>
      `;

      tbody.appendChild(tr);
    });

    if (window.lucide) {
      lucide.createIcons();
    }

    updateBulkButtonVisibility();
  }

  function updateBulkButtonVisibility() {
    const checked = document.querySelectorAll('.row-checkbox:checked');
    if (bulkAcceptBtn) {
      if (checked.length > 0) {
        bulkAcceptBtn.style.display = 'inline-flex';
        bulkAcceptBtn.innerHTML = `<i data-lucide="check-check" style="width: 16px; height: 16px;"></i> Accept Selected (${checked.length})`;
        if (window.lucide) lucide.createIcons();
      } else {
        bulkAcceptBtn.style.display = 'none';
      }
    }
  }

  // Handle Accept / Pending status action
  async function handleStatusChange(studentId, newStatus) {
    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;

    try {
      const todayStr = getTodayDateString();
      const updates = {
        admissionStatus: newStatus,
        updatedAt: serverTimestamp()
      };

      if (newStatus === 'accepted') {
        // Automatically store today's date if no admission date exists or if updating
        if (!student.admissionDate || student.admissionDate.trim() === '' || student.admissionDate === '-') {
          updates.admissionDate = todayStr;
          student.admissionDate = todayStr;
        }
        student.admissionStatus = 'accepted';
      } else {
        student.admissionStatus = 'pending';
      }

      await updateDoc(doc(db, "students", studentId), updates);

      if (newStatus === 'accepted') {
        toast(`Student ${student.name || ''} accepted! Admission date: ${student.admissionDate}`, 'success');
      } else {
        toast(`Student ${student.name || ''} marked as Pending.`, 'info');
      }

      renderTable();

    } catch (error) {
      console.error("Error updating admission status:", error);
      toast('Failed to update admission status: ' + error.message, 'error');
    }
  }

  // Handle Inline Date Change
  async function handleDateChange(studentId, newDate) {
    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;

    try {
      await updateDoc(doc(db, "students", studentId), {
        admissionDate: newDate,
        admissionStatus: newDate ? 'accepted' : student.admissionStatus,
        updatedAt: serverTimestamp()
      });

      student.admissionDate = newDate;
      if (newDate) student.admissionStatus = 'accepted';

      toast(`Admission date updated to ${newDate}`, 'success');
      renderTable();
    } catch (error) {
      console.error("Error updating date:", error);
      toast('Failed to update date: ' + error.message, 'error');
    }
  }

  // Handle Left Date Change
  async function handleLeftDateChange(studentId, newDate) {
    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;

    try {
      const updates = {
        leftDate: newDate ? newDate : null,
        leftStatus: newDate ? 'left' : null,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, "students", studentId), updates);

      student.leftDate = newDate ? newDate : null;
      student.leftStatus = newDate ? 'left' : null;

      if (newDate) {
        toast(`Left date updated to ${newDate} for ${student.name || 'student'}`, 'success');
      } else {
        toast(`Left status removed for ${student.name || 'student'}`, 'info');
      }

      renderTable();
    } catch (error) {
      console.error("Error updating left date:", error);
      toast('Failed to update left status: ' + error.message, 'error');
    }
  }

  function setupEvents() {
    // Search input
    if (searchInput) {
      searchInput.addEventListener('input', () => renderTable());
    }

    // Course filter
    if (courseFilter) {
      courseFilter.addEventListener('change', () => renderTable());
    }

    // Status tabs
    if (statusTabs) {
      const buttons = statusTabs.querySelectorAll('.filter-tab');
      buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          buttons.forEach(b => {
            b.classList.remove('btn-primary', 'active');
            b.classList.add('btn-outline');
          });
          const target = e.currentTarget;
          target.classList.remove('btn-outline');
          target.classList.add('btn-primary', 'active');
          currentStatusFilter = target.getAttribute('data-status');
          renderTable();
        });
      });
    }

    // Select all checkbox
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        document.querySelectorAll('.row-checkbox').forEach(cb => {
          cb.checked = isChecked;
        });
        updateBulkButtonVisibility();
      });
    }

    // Table delegated actions
    tbody.addEventListener('click', async (e) => {
      // Toggle / Accept button
      const toggleBtn = e.target.closest('.btn-status-toggle');
      if (toggleBtn) {
        const studentId = toggleBtn.getAttribute('data-id');
        const action = toggleBtn.getAttribute('data-action');
        toggleBtn.disabled = true;
        toggleBtn.textContent = 'Updating...';
        await handleStatusChange(studentId, action === 'accept' ? 'accepted' : 'pending');
        return;
      }

      // Toggle Date Input button
      const dateToggleBtn = e.target.closest('.btn-toggle-date');
      if (dateToggleBtn) {
        const studentId = dateToggleBtn.getAttribute('data-id');
        const row = document.getElementById(`row-${studentId}`);
        if (row) {
          const dateInput = row.querySelector('.date-edit-input');
          if (dateInput) {
            if (dateInput.style.display === 'none') {
              dateInput.style.display = 'inline-block';
              dateInput.focus();
            } else {
              dateInput.style.display = 'none';
            }
          }
        }
        return;
      }

      // Mark Left button clicked (open date selection)
      const markLeftBtn = e.target.closest('.btn-mark-left');
      if (markLeftBtn) {
        const box = markLeftBtn.closest('.left-status-box');
        if (box) {
          const inputWrap = box.querySelector('.left-input-wrap');
          const dateInput = box.querySelector('.left-date-input');
          markLeftBtn.style.display = 'none';
          if (inputWrap) inputWrap.style.display = 'inline-flex';
          if (dateInput) {
            try {
              dateInput.showPicker();
            } catch (err) {
              dateInput.focus();
            }
          }
        }
        return;
      }

      // Cancel Left input button clicked
      const cancelLeftInputBtn = e.target.closest('.btn-cancel-left-input');
      if (cancelLeftInputBtn) {
        const box = cancelLeftInputBtn.closest('.left-status-box');
        if (box) {
          const inputWrap = box.querySelector('.left-input-wrap');
          const markLeftBtn = box.querySelector('.btn-mark-left');
          if (inputWrap) inputWrap.style.display = 'none';
          if (markLeftBtn) markLeftBtn.style.display = 'inline-flex';
        }
        return;
      }

      // Toggle Left Date edit button clicked
      const toggleLeftDateBtn = e.target.closest('.btn-toggle-left-date');
      if (toggleLeftDateBtn) {
        const box = toggleLeftDateBtn.closest('.left-status-box');
        if (box) {
          const displayWrap = box.querySelector('.left-status-display');
          const editWrap = box.querySelector('.left-edit-wrap');
          const dateInput = box.querySelector('.left-date-input');
          if (displayWrap) displayWrap.style.display = 'none';
          if (editWrap) editWrap.style.display = 'inline-flex';
          if (dateInput) {
            try {
              dateInput.showPicker();
            } catch (err) {
              dateInput.focus();
            }
          }
        }
        return;
      }

      // Cancel Left Date edit button clicked
      const cancelLeftEditBtn = e.target.closest('.btn-cancel-left-edit');
      if (cancelLeftEditBtn) {
        const box = cancelLeftEditBtn.closest('.left-status-box');
        if (box) {
          const displayWrap = box.querySelector('.left-status-display');
          const editWrap = box.querySelector('.left-edit-wrap');
          if (editWrap) editWrap.style.display = 'none';
          if (displayWrap) displayWrap.style.display = 'inline-flex';
        }
        return;
      }

      // Save Left Date button clicked
      const saveLeftBtn = e.target.closest('.btn-save-left-input');
      if (saveLeftBtn) {
        const studentId = saveLeftBtn.getAttribute('data-id');
        const box = saveLeftBtn.closest('.left-status-box');
        const dateInput = box ? box.querySelector('.left-date-input') : null;
        const newDate = dateInput ? dateInput.value : '';
        if (newDate) {
          saveLeftBtn.disabled = true;
          await handleLeftDateChange(studentId, newDate);
        } else {
          toast('Please choose a valid date', 'warning');
        }
        return;
      }

      // Clear / Revert Left status button clicked
      const clearLeftBtn = e.target.closest('.btn-clear-left-date');
      if (clearLeftBtn) {
        const studentId = clearLeftBtn.getAttribute('data-id');
        const student = allStudents.find(s => s.id === studentId);
        if (confirm(`Remove Left status for ${student?.name || 'this student'}?`)) {
          clearLeftBtn.disabled = true;
          await handleLeftDateChange(studentId, null);
        }
        return;
      }

      // Checkbox click
      if (e.target.classList.contains('row-checkbox')) {
        updateBulkButtonVisibility();
      }
    });

    // Date edit on change
    tbody.addEventListener('change', async (e) => {
      if (e.target.classList.contains('date-edit-input')) {
        const studentId = e.target.getAttribute('data-id');
        const newDate = e.target.value;
        if (newDate) {
          await handleDateChange(studentId, newDate);
        }
      } else if (e.target.classList.contains('left-date-input')) {
        const studentId = e.target.getAttribute('data-id');
        const newDate = e.target.value;
        if (newDate) {
          await handleLeftDateChange(studentId, newDate);
        }
      }
    });

    // Date edit on Enter key press
    tbody.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' && e.target.classList.contains('left-date-input')) {
        e.preventDefault();
        const studentId = e.target.getAttribute('data-id');
        const newDate = e.target.value;
        if (newDate) {
          await handleLeftDateChange(studentId, newDate);
        }
      }
    });

    // Bulk Accept Button
    if (bulkAcceptBtn) {
      bulkAcceptBtn.addEventListener('click', async () => {
        const selected = Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => cb.value);
        if (selected.length === 0) return;

        if (!confirm(`Accept admissions for ${selected.length} student(s) and set admission date to today?`)) {
          return;
        }

        bulkAcceptBtn.disabled = true;
        bulkAcceptBtn.textContent = 'Processing...';

        try {
          const todayStr = getTodayDateString();
          for (const studentId of selected) {
            const student = allStudents.find(s => s.id === studentId);
            const dateToSet = (student && student.admissionDate && student.admissionDate !== '-') ? student.admissionDate : todayStr;
            await updateDoc(doc(db, "students", studentId), {
              admissionStatus: 'accepted',
              admissionDate: dateToSet,
              updatedAt: serverTimestamp()
            });
            if (student) {
              student.admissionStatus = 'accepted';
              student.admissionDate = dateToSet;
            }
          }

          toast(`Successfully accepted ${selected.length} students!`, 'success');
          if (selectAllCheckbox) selectAllCheckbox.checked = false;
          renderTable();

        } catch (err) {
          console.error("Bulk accept error:", err);
          toast('Bulk accept failed: ' + err.message, 'error');
        } finally {
          bulkAcceptBtn.disabled = false;
          updateBulkButtonVisibility();
        }
      });
    }
  }
});
