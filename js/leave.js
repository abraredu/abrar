import { toast } from './toast.js';
import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, addDoc, setDoc, deleteDoc, doc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

function initLeavePage() {
  const leaveForm = document.getElementById('leaveForm');
  const leaveFormTitle = document.getElementById('leaveFormTitle');
  const editLeaveIdInput = document.getElementById('editLeaveId');
  const cancelEditLeaveBtn = document.getElementById('cancelEditLeaveBtn');
  const saveLeaveBtn = document.getElementById('saveLeaveBtn');

  const studentSearchInput = document.getElementById('studentSearchInput');
  const studentDropdownList = document.getElementById('studentDropdownList');
  const selectedStudentIdInput = document.getElementById('selectedStudentId');
  const selectedStudentBadge = document.getElementById('selectedStudentBadge');
  const selectedStudentText = document.getElementById('selectedStudentText');
  const clearSelectedStudentBtn = document.getElementById('clearSelectedStudentBtn');

  const leaveFromDate = document.getElementById('leaveFromDate');
  const leaveToDate = document.getElementById('leaveToDate');
  const leaveReason = document.getElementById('leaveReason');

  const tableSearchInput = document.getElementById('tableSearchInput');
  const statusFilter = document.getElementById('statusFilter');
  const leavesTableBody = document.getElementById('leavesTableBody');

  const overdueAlertCount = document.getElementById('overdueAlertCount');
  const overdueAlertList = document.getElementById('overdueAlertList');
  const twoDayAlertCount = document.getElementById('twoDayAlertCount');
  const twoDayAlertList = document.getElementById('twoDayAlertList');

  let allStudents = [];
  let allLeaves = [];

  function getLocalTodayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function parseDateMs(dateStr) {
    if (!dateStr) return NaN;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return NaN;
    return new Date(y, m - 1, d).getTime();
  }

  function getLeaveDays(fromStr, toStr) {
    const f = parseDateMs(fromStr);
    const t = parseDateMs(toStr);
    if (isNaN(f) || isNaN(t) || t < f) return 0;
    return Math.round((t - f) / 86400000) + 1;
  }

  function getLeaveStatusInfo(leave) {
    if (leave.status === 'returned') {
      return {
        key: 'returned',
        label: 'Returned',
        detail: '',
        badgeStyle: 'background: #f1f5f9; color: #475569;'
      };
    }

    const todayStr = getLocalTodayStr();
    const todayMs = parseDateMs(todayStr);
    const toMs = parseDateMs(leave.toDate);
    const fromMs = parseDateMs(leave.fromDate);

    if (!isNaN(toMs)) {
      const diffDays = Math.round((toMs - todayMs) / 86400000);
      if (diffDays < 0) {
        const overdueBy = Math.abs(diffDays);
        return {
          key: 'overdue',
          label: `Overdue (${overdueBy}d)`,
          detail: `Overdue by ${overdueBy} day${overdueBy === 1 ? '' : 's'} (Ended ${leave.toDate})`,
          badgeStyle: 'background: #fee2e2; color: #dc2626;'
        };
      }
      if (diffDays >= 0 && diffDays <= 2) {
        const msg = diffDays === 0 ? 'Ends Today' : `${diffDays} day${diffDays === 1 ? '' : 's'} left`;
        return {
          key: 'two_days',
          label: msg,
          detail: `${msg} (Ends ${leave.toDate})`,
          badgeStyle: 'background: #fef3c7; color: #b45309;'
        };
      }
    }

    if (!isNaN(fromMs) && fromMs > todayMs) {
      return {
        key: 'upcoming',
        label: 'Upcoming',
        detail: '',
        badgeStyle: 'background: #e0f2fe; color: #0369a1;'
      };
    }

    return {
      key: 'active',
      label: 'Active Leave',
      detail: '',
      badgeStyle: 'background: #dcfce7; color: #15803d;'
    };
  }

  const todayDefault = getLocalTodayStr();
  if (leaveFromDate) leaveFromDate.value = todayDefault;
  if (leaveToDate) leaveToDate.value = todayDefault;

  async function loadLeaveData() {
    if (leavesTableBody) {
      leavesTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading...</td></tr>';
    }
    try {
      const [studentsSnap, leavesSnap] = await Promise.all([
        getDocs(query(collection(db, 'students'), where('status', '==', 'active'))),
        getDocs(collection(db, 'studentLeaves'))
      ]);

      allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      allStudents.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      allLeaves = leavesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      allLeaves.sort((a, b) => (b.fromDate || '').localeCompare(a.fromDate || ''));

      renderAlertsAndStats();
      renderLeavesTable();
    } catch (err) {
      console.error('Error loading leave data:', err);
      if (leavesTableBody) {
        leavesTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--color-danger);">Error: ${err.message}</td></tr>`;
      }
    }
  }

  function renderStudentDropdown(filterText = '') {
    if (!studentDropdownList) return;
    const term = filterText.trim().toLowerCase();
    const matches = allStudents.filter(s => {
      const name = (s.name || '').toLowerCase();
      const sid = (s.studentId || '').toLowerCase();
      return !term || name.includes(term) || sid.includes(term);
    });

    if (matches.length === 0) {
      studentDropdownList.innerHTML = '<div style="padding: 0.75rem; font-size: 0.85rem; color: #64748b; text-align: center;">No matching students found.</div>';
    } else {
      studentDropdownList.innerHTML = matches.slice(0, 60).map(s => `
        <div class="leave-student-opt" data-id="${s.id}" style="padding: 0.55rem 0.85rem; cursor: pointer; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 600; font-size: 0.85rem; color: #0f172a;">${s.name || '-'}</span>
          <span style="font-size: 0.75rem; color: #64748b;">${s.studentId || ''}</span>
        </div>
      `).join('');
    }
    studentDropdownList.style.display = 'block';
  }

  function selectStudent(studentDocId) {
    const st = allStudents.find(s => s.id === studentDocId);
    if (!st) return;
    selectedStudentIdInput.value = st.id;
    selectedStudentText.textContent = `${st.name || '-'} (${st.studentId || ''})`;
    selectedStudentBadge.style.display = 'flex';
    studentSearchInput.style.display = 'none';
    studentDropdownList.style.display = 'none';
  }

  function clearSelectedStudent() {
    selectedStudentIdInput.value = '';
    selectedStudentBadge.style.display = 'none';
    studentSearchInput.style.display = 'block';
    studentSearchInput.value = '';
  }

  function resetLeaveForm() {
    editLeaveIdInput.value = '';
    leaveFormTitle.textContent = 'Add Student Leave';
    saveLeaveBtn.textContent = 'Save Leave';
    cancelEditLeaveBtn.style.display = 'none';
    clearSelectedStudent();
    const today = getLocalTodayStr();
    leaveFromDate.value = today;
    leaveToDate.value = today;
    leaveReason.value = '';
  }

  function startEditLeave(leaveId) {
    const leave = allLeaves.find(l => l.id === leaveId);
    if (!leave) return;
    editLeaveIdInput.value = leave.id;
    leaveFormTitle.textContent = 'Edit Student Leave';
    saveLeaveBtn.textContent = 'Update Leave';
    cancelEditLeaveBtn.style.display = 'inline-flex';

    if (allStudents.some(s => s.id === leave.studentDocId)) {
      selectStudent(leave.studentDocId);
    } else {
      selectedStudentIdInput.value = leave.studentDocId || '';
      selectedStudentText.textContent = `${leave.studentName || '-'} (${leave.studentCode || ''})`;
      selectedStudentBadge.style.display = 'flex';
      studentSearchInput.style.display = 'none';
    }

    leaveFromDate.value = leave.fromDate || '';
    leaveToDate.value = leave.toDate || '';
    leaveReason.value = leave.reason || '';
    leaveForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderAlertsAndStats() {
    let activeCount = 0;
    const overdueItems = [];
    const twoDayItems = [];

    allLeaves.forEach(leave => {
      const info = getLeaveStatusInfo(leave);
      if (info.key === 'overdue') {
        overdueItems.push({ leave, info });
      } else if (info.key === 'two_days') {
        twoDayItems.push({ leave, info });
        activeCount++;
      } else if (info.key === 'active') {
        activeCount++;
      }
    });

    document.getElementById('statTotalLeaves').textContent = allLeaves.length;
    document.getElementById('statActiveLeaves').textContent = activeCount;
    document.getElementById('statTwoDayLeaves').textContent = twoDayItems.length;
    document.getElementById('statOverdueLeaves').textContent = overdueItems.length;

    if (overdueAlertCount) overdueAlertCount.textContent = overdueItems.length;
    if (overdueItems.length > 0) {
      overdueAlertList.innerHTML = overdueItems.map(({ leave, info }) => `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; background: #fef2f2; border: 1px solid #fecaca; padding: 0.55rem 0.75rem; border-radius: 8px; font-size: 0.85rem;">
          <div>
            <strong style="color: #991b1b;">${leave.studentName || '-'}</strong>
            <span style="color: #64748b;">(${leave.studentCode || ''})</span><br>
            <span style="color: #dc2626; font-size: 0.78rem; font-weight: 600;">${info.detail}</span>
          </div>
          <div style="display: flex; gap: 0.4rem;">
            <button type="button" class="btn btn-outline alert-edit-btn" data-id="${leave.id}" style="padding: 0.2rem 0.55rem; font-size: 0.75rem;">Edit</button>
            <button type="button" class="btn btn-primary alert-return-btn" data-id="${leave.id}" style="padding: 0.2rem 0.55rem; font-size: 0.75rem;">Mark Returned</button>
          </div>
        </div>
      `).join('');
    } else {
      overdueAlertList.innerHTML = '<div style="text-align: center; color: #94a3b8; font-size: 0.85rem; padding: 0.75rem 0;">No overdue leaves.</div>';
    }

    if (twoDayAlertCount) twoDayAlertCount.textContent = twoDayItems.length;
    if (twoDayItems.length > 0) {
      twoDayAlertList.innerHTML = twoDayItems.map(({ leave, info }) => `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.55rem 0.75rem; border-radius: 8px; font-size: 0.85rem;">
          <div>
            <strong style="color: #0f172a;">${leave.studentName || '-'}</strong>
            <span style="color: #64748b;">(${leave.studentCode || ''})</span><br>
            <span style="color: #0284c7; font-size: 0.78rem; font-weight: 600;">${info.detail}</span>
          </div>
          <div style="display: flex; gap: 0.4rem;">
            <button type="button" class="btn btn-outline alert-edit-btn" data-id="${leave.id}" style="padding: 0.2rem 0.55rem; font-size: 0.75rem;">Edit</button>
            <button type="button" class="btn btn-primary alert-return-btn" data-id="${leave.id}" style="padding: 0.2rem 0.55rem; font-size: 0.75rem;">Mark Returned</button>
          </div>
        </div>
      `).join('');
    } else {
      twoDayAlertList.innerHTML = '<div style="text-align: center; color: #94a3b8; font-size: 0.85rem; padding: 0.75rem 0;">No leaves ending within 2 days.</div>';
    }
  }

  function renderLeavesTable() {
    const term = (tableSearchInput ? tableSearchInput.value : '').trim().toLowerCase();
    const filterVal = statusFilter ? statusFilter.value : 'all';

    const rows = allLeaves.filter(leave => {
      const info = getLeaveStatusInfo(leave);
      if (filterVal !== 'all' && info.key !== filterVal) return false;
      if (term) {
        const sName = (leave.studentName || '').toLowerCase();
        const sCode = (leave.studentCode || '').toLowerCase();
        const reason = (leave.reason || '').toLowerCase();
        if (!sName.includes(term) && !sCode.includes(term) && !reason.includes(term)) return false;
      }
      return true;
    }).map(leave => {
      const info = getLeaveStatusInfo(leave);
      const days = getLeaveDays(leave.fromDate, leave.toDate);
      const isReturned = leave.status === 'returned';

      return `
        <tr style="border-bottom: 1px solid var(--color-border);">
          <td style="padding: 0.75rem;">
            <div style="font-weight: 600;">${leave.studentName || '-'}</div>
            <div style="font-size: 0.75rem; color: var(--color-text-secondary);">${leave.studentCode || ''}</div>
          </td>
          <td style="padding: 0.75rem;">${leave.fromDate || '-'}</td>
          <td style="padding: 0.75rem;">${leave.toDate || '-'}</td>
          <td style="padding: 0.75rem;">${days > 0 ? `${days} day${days === 1 ? '' : 's'}` : '-'}</td>
          <td style="padding: 0.75rem;">
            <span style="padding: 0.25rem 0.6rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; ${info.badgeStyle}">${info.label}</span>
          </td>
          <td style="padding: 0.75rem; font-size: 0.85rem; color: #475569;">${leave.reason || '-'}</td>
          <td style="padding: 0.75rem;">
            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
              <button type="button" class="btn btn-outline edit-leave-btn" data-id="${leave.id}" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">Edit</button>
              <button type="button" class="btn btn-outline toggle-return-btn" data-id="${leave.id}" data-status="${isReturned ? 'active' : 'returned'}" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; color: ${isReturned ? '#0284c7' : '#15803d'}; border-color: ${isReturned ? '#bae6fd' : '#bbf7d0'};">
                ${isReturned ? 'Reopen' : 'Returned'}
              </button>
              <button type="button" class="btn btn-outline delete-leave-btn" data-id="${leave.id}" style="padding: 0.25rem 0.55rem; font-size: 0.75rem; color: #dc2626; border-color: #fecaca;">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    leavesTableBody.innerHTML = rows || '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #64748b;">No leave records found.</td></tr>';
  }

  async function toggleReturnStatus(leaveId, newStatus) {
    try {
      await setDoc(doc(db, 'studentLeaves', leaveId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast.success(newStatus === 'returned' ? 'Marked as returned.' : 'Leave reopened.');
      await loadLeaveData();
    } catch (err) {
      console.error('Failed to update status:', err);
      toast.error('Failed to update status: ' + err.message);
    }
  }

  async function deleteLeaveRecord(leaveId) {
    if (!confirm('Delete this leave record?')) return;
    try {
      await deleteDoc(doc(db, 'studentLeaves', leaveId));
      toast.success('Leave record deleted.');
      if (editLeaveIdInput.value === leaveId) resetLeaveForm();
      await loadLeaveData();
    } catch (err) {
      console.error('Failed to delete leave:', err);
      toast.error('Failed to delete leave: ' + err.message);
    }
  }

  // Event Listeners
  if (studentSearchInput) {
    studentSearchInput.addEventListener('focus', () => renderStudentDropdown(studentSearchInput.value));
    studentSearchInput.addEventListener('input', () => renderStudentDropdown(studentSearchInput.value));
  }

  if (studentDropdownList) {
    studentDropdownList.addEventListener('click', (e) => {
      const opt = e.target.closest('.leave-student-opt');
      if (opt) selectStudent(opt.getAttribute('data-id'));
    });
  }

  document.addEventListener('click', (e) => {
    if (studentDropdownList && studentSearchInput && !studentDropdownList.contains(e.target) && e.target !== studentSearchInput) {
      studentDropdownList.style.display = 'none';
    }
  });

  if (clearSelectedStudentBtn) {
    clearSelectedStudentBtn.addEventListener('click', () => {
      clearSelectedStudent();
      renderStudentDropdown('');
      studentSearchInput.focus();
    });
  }

  if (cancelEditLeaveBtn) {
    cancelEditLeaveBtn.addEventListener('click', resetLeaveForm);
  }

  if (leaveForm) {
    leaveForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const studentDocId = selectedStudentIdInput.value;
      const fromDate = leaveFromDate.value;
      const toDate = leaveToDate.value;
      const reason = leaveReason.value.trim();
      const editId = editLeaveIdInput.value;

      if (!studentDocId) {
        toast.error('Please select a student.');
        return;
      }
      if (!fromDate || !toDate) {
        toast.error('Please select both From and To dates.');
        return;
      }
      if (toDate < fromDate) {
        toast.error('To Date cannot be earlier than From Date.');
        return;
      }

      const st = allStudents.find(s => s.id === studentDocId);
      const existingLeave = editId ? allLeaves.find(l => l.id === editId) : null;

      saveLeaveBtn.disabled = true;
      saveLeaveBtn.textContent = editId ? 'Updating...' : 'Saving...';

      try {
        const payload = {
          studentDocId,
          studentName: st ? (st.name || '-') : (existingLeave?.studentName || '-'),
          studentCode: st ? (st.studentId || '') : (existingLeave?.studentCode || ''),
          fromDate,
          toDate,
          reason,
          status: existingLeave ? (existingLeave.status || 'active') : 'active',
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser ? auth.currentUser.uid : 'system'
        };

        if (editId) {
          await setDoc(doc(db, 'studentLeaves', editId), payload, { merge: true });
          toast.success('Leave updated!');
        } else {
          payload.createdAt = serverTimestamp();
          payload.createdBy = auth.currentUser ? auth.currentUser.uid : 'system';
          await addDoc(collection(db, 'studentLeaves'), payload);
          toast.success('Leave saved!');
        }

        resetLeaveForm();
        await loadLeaveData();
      } catch (err) {
        console.error('Error saving leave:', err);
        toast.error('Failed to save leave: ' + err.message);
      } finally {
        saveLeaveBtn.disabled = false;
        saveLeaveBtn.textContent = editLeaveIdInput.value ? 'Update Leave' : 'Save Leave';
      }
    });
  }

  if (tableSearchInput) tableSearchInput.addEventListener('input', renderLeavesTable);
  if (statusFilter) statusFilter.addEventListener('change', renderLeavesTable);

  if (leavesTableBody) {
    leavesTableBody.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.edit-leave-btn');
      if (editBtn) return startEditLeave(editBtn.getAttribute('data-id'));

      const toggleBtn = e.target.closest('.toggle-return-btn');
      if (toggleBtn) return toggleReturnStatus(toggleBtn.getAttribute('data-id'), toggleBtn.getAttribute('data-status'));

      const delBtn = e.target.closest('.delete-leave-btn');
      if (delBtn) return deleteLeaveRecord(delBtn.getAttribute('data-id'));
    });
  }

  const alertsContainer = document.getElementById('leaveAlertsContainer');
  if (alertsContainer) {
    alertsContainer.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.alert-edit-btn');
      if (editBtn) return startEditLeave(editBtn.getAttribute('data-id'));

      const retBtn = e.target.closest('.alert-return-btn');
      if (retBtn) return toggleReturnStatus(retBtn.getAttribute('data-id'), 'returned');
    });
  }

  onAuthStateChanged(auth, (user) => {
    if (user) {
      loadLeaveData();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLeavePage);
} else {
  initLeavePage();
}
