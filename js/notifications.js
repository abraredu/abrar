// js/notifications.js
import { db } from './firebase-config.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { loadManagedCourses, valueMatchesCourse, legacyLabel, escapeHtml } from './course-types.js';

document.addEventListener('DOMContentLoaded', async () => {
  const upcomingTableBody = document.getElementById('upcomingTableBody');
  const overdueTableBody = document.getElementById('overdueTableBody');
  const statUpcoming = document.getElementById('statUpcoming');
  const statOverdue = document.getElementById('statOverdue');
  const filterBar = document.getElementById('courseFilterBar');
  
  if (!upcomingTableBody || !overdueTableBody) return;

  const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

  let allUpcoming = [];
  let allOverdue = [];
  let currentFilter = 'all';
  let allCourses = [];

  // Resolve a student's course key: managed course id, or raw type if no course matches
  function resolveCourseKey(data) {
    const course = allCourses.find(c =>
      data.courseId === c.id ||
      [data.courseType, data.course].some(v => valueMatchesCourse(v, c) || valueMatchesCourse(legacyLabel(v), c))
    );
    return course ? course.id : (data.courseType || data.course || 'other');
  }

  // Build filter tabs from Manage Courses (+ any unmatched types present in data)
  function renderFilterTabs() {
    if (!filterBar) return;
    const tabs = allCourses.map(c => ({ key: c.id, label: c.courseName || c.serialNo || 'Course' }));
    const extraKeys = new Set([...allUpcoming, ...allOverdue].map(s => s.courseKey).filter(k => !tabs.some(t => t.key === k)));
    extraKeys.forEach(k => tabs.push({ key: k, label: k === 'other' ? 'Other' : legacyLabel(k) }));

    const baseStyle = 'padding: 0.5rem 1.5rem; border: none; border-radius: var(--radius-pill); font-weight: 500; font-size: 0.875rem; cursor: pointer; transition: all var(--transition-fast);';
    const styleFor = key => key === currentFilter
      ? `${baseStyle} background: var(--color-sidebar-active); color: var(--color-primary);`
      : `${baseStyle} background: transparent; color: var(--color-text-secondary);`;

    filterBar.innerHTML = [{ key: 'all', label: 'All' }, ...tabs].map(t =>
      `<button class="filter-btn ${t.key === currentFilter ? 'active' : ''}" data-filter="${escapeHtml(t.key)}" style="${styleFor(t.key)}">${escapeHtml(t.label)}</button>`
    ).join('');
  }

  async function loadNotifications() {
    try {
      try {
        allCourses = await loadManagedCourses();
      } catch (err) {
        console.error('Error loading courses:', err);
      }
      const q = query(collection(db, "students"), where("status", "==", "active"));
      const snapshot = await getDocs(q);
      
      // Fetch recent payments to check if already paid
      const now = new Date();
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      
      const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
      const currMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
      
      const p1 = getDocs(query(collection(db, "payments"), where("billingMonth", "==", prevMonthStr)));
      const p2 = getDocs(query(collection(db, "payments"), where("billingMonth", "==", currMonthStr)));
      const p3 = getDocs(query(collection(db, "payments"), where("billingMonth", "==", nextMonthStr)));
      
      const [snap1, snap2, snap3] = await Promise.all([p1, p2, p3]);
      const allPayments = [];
      snap1.forEach(doc => allPayments.push(doc.data()));
      snap2.forEach(doc => allPayments.push(doc.data()));
      snap3.forEach(doc => allPayments.push(doc.data()));

      allUpcoming = [];
      allOverdue = [];
      
      const today = new Date();
      today.setHours(0, 0, 0, 0); 
      
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      snapshot.forEach(doc => {
        const data = doc.data();
        
        const baseDateStr = data.classStartingDate || data.admissionDate;
        if (!baseDateStr) return; 
        
        const baseDate = new Date(baseDateStr);
        if (isNaN(baseDate.getTime())) return; 
        
        // Normalize joined date to midnight
        const joinedDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());

        const dueDay = baseDate.getDate();
        let currentMonthDueDate = new Date(currentYear, currentMonth, dueDay);
        
        // If the calculated due date is the same as or before the joined date,
        // it means the first month hasn't completed yet. The next payment is next month.
        if (currentMonthDueDate.getTime() <= joinedDate.getTime()) {
            currentMonthDueDate = new Date(currentYear, currentMonth + 1, dueDay);
        }

        // Fee accounting starts from December 2026 cycle (Nov-Dec)
        const FEE_START_MONTH = '2026-12';
        let dueYearStr = currentMonthDueDate.getFullYear();
        let dueMonthIdx = currentMonthDueDate.getMonth() + 1;
        let targetBillingMonth = `${dueYearStr}-${String(dueMonthIdx).padStart(2, '0')}`;
        if (targetBillingMonth < FEE_START_MONTH) {
          currentMonthDueDate = new Date(2026, 11, Math.min(dueDay, 31));
          dueYearStr = currentMonthDueDate.getFullYear();
          dueMonthIdx = currentMonthDueDate.getMonth() + 1;
          targetBillingMonth = `${dueYearStr}-${String(dueMonthIdx).padStart(2, '0')}`;
        }
        
        const diffTime = currentMonthDueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const monthlyFee = data.monthlyFee || 0;
        
        const studentPayments = allPayments.filter(p => p.studentId === doc.id && p.billingMonth === targetBillingMonth);
        const actualPaid = studentPayments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
        const waived = studentPayments.reduce((sum, p) => sum + (p.waivedAmount || 0), 0);
        const totalCredited = actualPaid + waived;
        
        const balance = Math.max(0, monthlyFee - totalCredited);
        
        // Only show notification if they still owe money for this month
        if (balance <= 0) return;
        
        const notifyData = {
          id: doc.id,
          name: data.name,
          phone: data.whatsapp || data.phone || '-',
          fee: balance, // show remaining balance instead of total fee
          courseType: data.courseType || '',
          courseKey: resolveCourseKey(data),
          dueDate: currentMonthDueDate,
          daysAway: diffDays
        };

        if (diffDays >= 0 && diffDays <= 3) {
          allUpcoming.push(notifyData);
        } 
        else if (diffDays < 0 && diffDays > -30) {
          allOverdue.push(notifyData);
        }
      });
      
      allUpcoming.sort((a, b) => a.daysAway - b.daysAway);
      allOverdue.sort((a, b) => a.daysAway - b.daysAway);
      
      renderFilterTabs();
      applyFilter();
      
    } catch (error) {
      console.error("Error loading notifications:", error);
      upcomingTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Error: ${error.message}</td></tr>`;
      overdueTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Error: ${error.message}</td></tr>`;
    }
  }
  
  function applyFilter() {
    let filteredUpcoming = allUpcoming;
    let filteredOverdue = allOverdue;

    if (currentFilter !== 'all') {
      filteredUpcoming = allUpcoming.filter(s => s.courseKey === currentFilter);
      filteredOverdue = allOverdue.filter(s => s.courseKey === currentFilter);
    }

    renderTable(upcomingTableBody, filteredUpcoming, 'upcoming');
    renderTable(overdueTableBody, filteredOverdue, 'overdue');
    
    statUpcoming.textContent = filteredUpcoming.length;
    statOverdue.textContent = filteredOverdue.length;
    const upPill = document.getElementById('upcomingCountPill');
    const ovPill = document.getElementById('overdueCountPill');
    if (upPill) upPill.textContent = filteredUpcoming.length;
    if (ovPill) ovPill.textContent = filteredOverdue.length;
  }

  function renderTable(container, dataList, type) {
    if (dataList.length === 0) {
      const msg = type === 'upcoming' ? 'No upcoming payments in the next 3 days.' : 'No overdue payments this month!';
      container.innerHTML = `<div style="text-align: center; padding: 2.5rem 1rem; color: #64748b; font-size: 0.875rem;">${msg}</div>`;
      return;
    }

    const dateOpts = { day: 'numeric', month: 'short', year: 'numeric' };
    container.innerHTML = dataList.map(item => {
      const formattedDate = item.dueDate.toLocaleDateString('en-IN', dateOpts);
      const upperName = item.name ? String(item.name).toUpperCase() : 'STUDENT';
      const initials = upperName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('') || 'S';

      let dateBadge = '';
      if (type === 'upcoming') {
        const text = item.daysAway === 0 ? 'Due Today' : `In ${item.daysAway} days`;
        dateBadge = `<span style="background: #e0f2fe; color: #0369a1; padding: 0.2rem 0.55rem; border-radius: 999px; font-size: 0.72rem; font-weight: 700;">${text}</span>`;
      } else {
        const text = `${Math.abs(item.daysAway)} days ago`;
        dateBadge = `<span style="background: #fee2e2; color: #dc2626; padding: 0.2rem 0.55rem; border-radius: 999px; font-size: 0.72rem; font-weight: 700;">${text}</span>`;
      }

      return `
        <div class="notify-card ${type === 'overdue' ? 'overdue' : ''}">
          <div class="notify-card-top">
            <div class="notify-student">
              <div class="notify-avatar">${initials}</div>
              <div style="min-width: 0;">
                <div class="notify-name" title="${upperName}">${upperName}</div>
                <div class="notify-phone">${item.phone}</div>
              </div>
            </div>
            <div class="notify-fee">${formatter.format(item.fee)}</div>
          </div>
          <div class="notify-card-bottom">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 0.78rem; font-weight: 600; color: #475569;">${formattedDate}</span>
              ${dateBadge}
            </div>
            <div style="display: flex; gap: 0.45rem;">
              <a href="../finance/fees.html" class="btn btn-primary" style="padding: 0.3rem 0.7rem; font-size: 0.74rem;">Collect</a>
              <a href="../students/student-view.html?id=${item.id}" class="btn btn-outline" style="padding: 0.3rem 0.7rem; font-size: 0.74rem;">View</a>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Filter Button Listeners (delegated, since tabs are rendered dynamically)
  if (filterBar) {
    filterBar.addEventListener('click', (e) => {
      const target = e.target.closest('.filter-btn');
      if (!target) return;
      currentFilter = target.getAttribute('data-filter');
      renderFilterTabs();
      applyFilter();
    });
  }

  loadNotifications();
});
