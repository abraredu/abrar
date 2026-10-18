import { toast } from './toast.js';
import { db, auth } from './firebase-config.js';
import { collection, getDocs, query, where, doc, runTransaction, serverTimestamp, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
  const monthSelector = document.getElementById('monthSelector');
  const headerDateSelector = document.getElementById('headerDateSelector');
  const cycleStartDatePicker = document.getElementById('cycleStartDatePicker');
  const holidayCheckbox = document.getElementById('holidayCheckbox');
  const searchInput = document.getElementById('unifiedSearchInput');
  const customDropdown = document.getElementById('customSearchDropdown');
  const detailsSection = document.getElementById('studentDetailsSection');
  
  let allStudents = [];
  let allTutors = [];
  let currentPayments = [];
  let currentSalaryPayments = [];
  let currentSalaryConfigs = [];
  let selectedStudent = null;
  let customCycleDate = null;

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  monthSelector.value = currentMonthStr;
  if (headerDateSelector) {
    headerDateSelector.value = `${currentMonthStr}-${String(now.getDate()).padStart(2, '0')}`;
  }

  const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

  // Modal elements
  const holidayModal = document.getElementById('holidayModal');
  const closeHolidayModalBtn = document.getElementById('closeHolidayModalBtn');
  const cancelHolidayBtn = document.getElementById('cancelHolidayBtn');
  const holidayForm = document.getElementById('holidayForm');

  if (closeHolidayModalBtn) {
    closeHolidayModalBtn.addEventListener('click', () => {
      if (holidayModal) holidayModal.style.display = 'none';
    });
  }
  if (cancelHolidayBtn) {
    cancelHolidayBtn.addEventListener('click', () => {
      if (holidayModal) holidayModal.style.display = 'none';
    });
  }
  if (holidayModal) {
    holidayModal.addEventListener('click', (e) => {
      if (e.target === holidayModal) {
        holidayModal.style.display = 'none';
      }
    });
  }

  async function loadInitialData() {
    try {
      const studentsQ = query(collection(db, "students"), where("status", "==", "active"));
      const snap = await getDocs(studentsQ);
      allStudents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const tutorsQ = query(collection(db, "tutors"), where("status", "==", "active"));
      const tSnap = await getDocs(tutorsQ);
      allTutors = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      await loadMonthData();
    } catch(e) {
      console.error(e);
      toast.error('Failed to load data');
    }
  }

  async function loadMonthData() {
    const selectedMonth = monthSelector.value;
    document.getElementById('detMonthLabel').textContent = selectedMonth;
    
    try {
      const paymentsQ = query(collection(db, "payments"), where("billingMonth", "==", selectedMonth));
      const paymentsSnap = await getDocs(paymentsQ);
      currentPayments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const salariesQ = query(collection(db, "salaryPayments"), where("month", "==", selectedMonth));
      const salariesSnap = await getDocs(salariesQ);
      currentSalaryPayments = salariesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const configsQ = query(collection(db, "tutorSalaryConfigs"), where("month", "==", selectedMonth));
      const configsSnap = await getDocs(configsQ);
      currentSalaryConfigs = configsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      if(selectedStudent) renderStudentDetails(selectedStudent);
    } catch(e) {
      console.error(e);
    }
  }

  // Month selector change
  monthSelector.addEventListener('change', async () => {
    if (customCycleDate) {
      const dayPart = customCycleDate.split('-')[2] || '01';
      const [newY, newM] = monthSelector.value.split('-');
      customCycleDate = `${newY}-${newM}-${dayPart}`;
    }
    if (headerDateSelector && customCycleDate) {
      headerDateSelector.value = customCycleDate;
    }
    if (cycleStartDatePicker && customCycleDate) {
      cycleStartDatePicker.value = customCycleDate;
    }
    await loadMonthData();
  });

  // Header date selector change
  if (headerDateSelector) {
    headerDateSelector.addEventListener('change', async (e) => {
      const chosenDate = e.target.value;
      if (!chosenDate) return;
      customCycleDate = chosenDate;
      const [y, m] = chosenDate.split('-');
      monthSelector.value = `${y}-${m}`;
      if (cycleStartDatePicker) cycleStartDatePicker.value = chosenDate;
      await loadMonthData();
    });
  }

  // Student details inline cycle date picker change
  if (cycleStartDatePicker) {
    cycleStartDatePicker.addEventListener('change', async (e) => {
      const chosenDate = e.target.value;
      if (!chosenDate) return;
      customCycleDate = chosenDate;
      const [y, m] = chosenDate.split('-');
      monthSelector.value = `${y}-${m}`;
      if (headerDateSelector) headerDateSelector.value = chosenDate;
      await loadMonthData();
    });
  }

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase().trim();
    if (!val) {
      customDropdown.style.display = 'none';
      selectedStudent = null;
      customCycleDate = null;
      detailsSection.style.display = 'none';
      return;
    }
    const matches = allStudents.filter(s => 
       s.name.toLowerCase().includes(val) || 
       (s.studentId && s.studentId.toLowerCase().includes(val))
    );
    
    customDropdown.innerHTML = '';
    if (matches.length > 0) {
       matches.forEach(s => {
          const li = document.createElement('li');
          li.style.padding = '0.75rem 1rem';
          li.style.cursor = 'pointer';
          li.style.borderBottom = '1px solid var(--color-border)';
          li.textContent = `${s.name} (${s.studentId})`;
          li.addEventListener('mouseenter', () => li.style.background = 'var(--color-sidebar-hover)');
          li.addEventListener('mouseleave', () => li.style.background = 'white');
          li.addEventListener('mousedown', () => { 
             searchInput.value = li.textContent;
             customDropdown.style.display = 'none';
             selectedStudent = s;
             customCycleDate = null; // reset to default student cycle
             detailsSection.style.display = 'block';
             renderStudentDetails(selectedStudent);
          });
          customDropdown.appendChild(li);
       });
       customDropdown.style.display = 'block';
    } else {
       const li = document.createElement('li');
       li.style.padding = '0.75rem 1rem';
       li.style.color = 'gray';
       li.textContent = 'No matches found';
       customDropdown.appendChild(li);
       customDropdown.style.display = 'block';
       selectedStudent = null;
       detailsSection.style.display = 'none';
    }
  });

  searchInput.addEventListener('focus', () => {
     if (searchInput.value.trim() && customDropdown.children.length > 0) {
        customDropdown.style.display = 'block';
     }
  });
  
  searchInput.addEventListener('blur', () => {
     customDropdown.style.display = 'none';
  });

  function getCycleDateString(student, yyyy_mm) {
    if (customCycleDate) return customCycleDate;
    const startDateStr = student.admissionDate || student.classStartingDate || student.classStartDate || null;
    let day = 1;
    if (startDateStr) {
       day = parseInt(startDateStr.split('-')[2]) || 1;
    }
    const [yearStr, monthStr] = yyyy_mm.split('-');
    return `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`;
  }

  function formatBillingCycle(student, yyyy_mm, overrideDateStr = null) {
    const cycleDateStr = overrideDateStr || getCycleDateString(student, yyyy_mm);
    const parts = cycleDateStr.split('-');
    const start = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const end = new Date(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]));
    const opts = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', opts)} - ${end.toLocaleDateString('en-US', opts)}`;
  }

  function renderStudentDetails(student) {
    const cycleDateStr = getCycleDateString(student, monthSelector.value);
    const cycleLabel = formatBillingCycle(student, monthSelector.value, cycleDateStr);
    document.getElementById('detMonthLabel').textContent = cycleLabel;
    
    if (document.getElementById('detStudentCycle')) {
      document.getElementById('detStudentCycle').textContent = `Fee Cycle: ${cycleLabel}`;
    }
    if (cycleStartDatePicker) {
      cycleStartDatePicker.value = cycleDateStr;
    }
    if (headerDateSelector) {
      headerDateSelector.value = cycleDateStr;
    }
    
    document.getElementById('detStudentName').textContent = student.name;
    document.getElementById('detStudentId').textContent = student.studentId;
    
    const monthlyFee = student.monthlyFee || 0;
    document.getElementById('detMonthlyFee').textContent = formatter.format(monthlyFee);
    document.getElementById('detExpected').textContent = formatter.format(monthlyFee);

    const studentPayments = currentPayments.filter(p => p.studentId === student.id);
    const actualPaid = studentPayments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
    const waived = studentPayments.reduce((sum, p) => sum + (p.waivedAmount || 0), 0);
    const totalCredited = actualPaid + waived;
    const outstanding = Math.max(0, monthlyFee - totalCredited);

    const detPaidDiv = document.getElementById('detPaid');
    const holidayPayment = studentPayments.find(p => p.isHoliday || p.isVacationLeave);

    if (holidayPayment) {
      const reasonBadge = holidayPayment.holidayReason ? `: ${holidayPayment.holidayReason}` : '';
      detPaidDiv.innerHTML = `
        <div style="display: flex; align-items: baseline; gap: 0.4rem; flex-wrap: wrap;">
          <span style="font-weight: 700; color: var(--color-success); font-size: 1.125rem;">${formatter.format(actualPaid)}</span>
          <span style="font-size: 0.725rem; font-weight: 600; color: #4338ca; background: #e0e7ff; padding: 2px 7px; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.25rem;">
            <i data-lucide="palmtree" style="width: 12px; height: 12px;"></i> Leave Base Fee${reasonBadge}
          </span>
        </div>
        ${waived > 0 ? `<div style="font-size: 0.725rem; color: #64748b; margin-top: 0.25rem; font-weight: normal;">Waived: ${formatter.format(waived)}</div>` : ''}
      `;
    } else if (waived > 0) {
      detPaidDiv.innerHTML = `
        <div style="font-weight: 700; color: var(--color-success); font-size: 1.125rem;">${formatter.format(actualPaid)}</div>
        <div style="font-size: 0.725rem; color: #64748b; margin-top: 0.25rem; font-weight: normal;">Waived: ${formatter.format(waived)}</div>
      `;
    } else {
      detPaidDiv.innerHTML = `<span style="font-weight: 700; color: var(--color-success); font-size: 1.125rem;">${formatter.format(actualPaid)}</span>`;
    }
    
    const outDiv = document.getElementById('detOutstanding');
    outDiv.textContent = formatter.format(outstanding);
    
    // Calculate overdue alert
    if (outstanding > 0) {
      const parts = cycleDateStr.split('-');
      const dueDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const redDate = new Date(dueDate);
      redDate.setMonth(redDate.getMonth() + 1);
      
      const yellowDate = new Date(dueDate);
      yellowDate.setDate(yellowDate.getDate() + 7);
      
      const badge = document.getElementById('overdueBadge');
      
      if (today > redDate) {
        outDiv.style.color = 'var(--color-danger)';
        if (badge) {
          badge.style.display = 'inline-block';
          badge.style.backgroundColor = 'var(--color-danger)';
          badge.textContent = 'Overdue';
        }
      } else if (today > yellowDate) {
        outDiv.style.color = 'var(--color-warning)';
        if (badge) {
          badge.style.display = 'inline-block';
          badge.style.backgroundColor = 'var(--color-warning)';
          badge.textContent = 'Warning';
        }
      } else {
        outDiv.style.color = 'var(--color-text-primary)';
        if (badge) badge.style.display = 'none';
      }
    } else {
      outDiv.style.color = 'var(--color-success)';
      const badge = document.getElementById('overdueBadge');
      if (badge) badge.style.display = 'none';
    }

    const acceptBtn = document.getElementById('acceptFeeBtn');

    function updateAcceptButtonUI() {
      if (holidayCheckbox && holidayCheckbox.checked) {
        acceptBtn.disabled = false;
        acceptBtn.textContent = 'Accept Fee (Holiday)';
        acceptBtn.style.backgroundColor = '#4338ca';
        acceptBtn.style.borderColor = '#4338ca';
        acceptBtn.onclick = () => openHolidayModal(student, outstanding, monthlyFee, cycleLabel);
      } else {
        acceptBtn.style.backgroundColor = '';
        acceptBtn.style.borderColor = '';
        if(outstanding <= 0) {
          acceptBtn.disabled = true;
          acceptBtn.textContent = holidayPayment ? 'Fully Paid (Leave Base Fee)' : 'Fully Paid';
          acceptBtn.onclick = null;
        } else {
          acceptBtn.disabled = false;
          acceptBtn.textContent = `Accept Outstanding Fee (${formatter.format(outstanding)})`;
          acceptBtn.onclick = () => processFee(student, outstanding, monthlyFee, cycleLabel);
        }
      }
    }

    updateAcceptButtonUI();
    if (holidayCheckbox) {
      holidayCheckbox.onchange = updateAcceptButtonUI;
    }

    const tbody = document.getElementById('tutorsListBody');
    tbody.innerHTML = '';
    
    let studentTutors = [];
    if (student.courseTutors) {
       for (const [courseName, tid] of Object.entries(student.courseTutors)) {
          const t = allTutors.find(t => t.id === tid);
          if (t && !studentTutors.some(existing => existing.id === t.id)) {
             t.assignedCourse = courseName;
             studentTutors.push(t);
          }
       }
    } else if (student.tutorIds && Array.isArray(student.tutorIds)) {
       student.tutorIds.forEach(tid => {
          const t = allTutors.find(t => t.id === tid);
          if (t) studentTutors.push(t);
       });
    } else if (student.tutorId) {
       const t = allTutors.find(t => t.id === student.tutorId);
       if (t) studentTutors.push(t);
    }
    
    if(studentTutors.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 1rem;">No tutors assigned to this student.</td></tr>';
      return;
    }

    const canPayTutor = outstanding <= 0;
    if (!canPayTutor) {
      const msgTr = document.createElement('tr');
      msgTr.innerHTML = '<td colspan="4" style="text-align: center; padding: 0.75rem; color: var(--color-danger); font-size: 0.875rem;">Student fee must be fully paid before you can set tutor salaries.</td>';
      tbody.appendChild(msgTr);
    }

    studentTutors.forEach(tutor => {
       const tutorPayments = currentSalaryPayments.filter(p => p.tutorId === tutor.id);
       const paidSoFar = tutorPayments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
       
       const existingConfig = currentSalaryConfigs.find(c => c.tutorId === tutor.id && c.studentId === student.id);
       const configAmount = existingConfig ? existingConfig.amount : 0;
       
       const courseLabel = tutor.assignedCourse ? `<br><small style="color:var(--color-primary);">${tutor.assignedCourse}</small>` : '';
       const tr = document.createElement('tr');
       
       let actionBtns = '';
       if (existingConfig) {
         actionBtns = `
           <button class="btn btn-primary set-salary-btn" data-tutor="${tutor.id}" data-config="${existingConfig.id}" style="padding: 0.25rem 0.75rem; font-size: 0.875rem;" ${!canPayTutor ? 'disabled title="Fee must be accepted first"' : ''}>Update</button>
           <button class="btn btn-outline unset-salary-btn" data-config="${existingConfig.id}" style="padding: 0.25rem 0.75rem; font-size: 0.875rem; border-color: var(--color-danger); color: var(--color-danger);" ${!canPayTutor ? 'disabled' : ''}>Unset</button>
         `;
       } else {
         actionBtns = `<button class="btn btn-outline set-salary-btn" data-tutor="${tutor.id}" style="padding: 0.25rem 0.75rem; font-size: 0.875rem;" ${!canPayTutor ? 'disabled title="Fee must be accepted first"' : ''}>Set Salary</button>`;
       }

       tr.innerHTML = `
         <td style="padding: 0.75rem;">${tutor.name} <br><small style="color:gray;">${tutor.tutorId}</small>${courseLabel}</td>
         <td style="padding: 0.75rem; color: var(--color-success);">${formatter.format(paidSoFar)}</td>
         <td style="padding: 0.75rem;"><input type="number" class="form-control salary-input" data-tutor="${tutor.id}" value="${configAmount}" min="0" step="0.01" style="width: 120px;" ${!canPayTutor ? 'disabled' : ''}></td>
         <td style="padding: 0.75rem; display: flex; gap: 0.5rem;">${actionBtns}</td>
       `;
       tbody.appendChild(tr);
    });
    
    document.querySelectorAll('.set-salary-btn').forEach(btn => {
       btn.addEventListener('click', (e) => {
          const tutorId = e.target.dataset.tutor;
          const configId = e.target.dataset.config;
          const input = document.querySelector(`.salary-input[data-tutor="${tutorId}"]`);
          const amt = parseFloat(input.value) || 0;
          if(amt <= 0) return toast.error("Enter valid amount");
          processSalary(tutorId, amt, e.target, student, configId);
       });
    });

    document.querySelectorAll('.unset-salary-btn').forEach(btn => {
       btn.addEventListener('click', async (e) => {
          const configId = e.target.dataset.config;
          e.target.disabled = true;
          e.target.textContent = '...';
          try {
            await deleteDoc(doc(db, 'tutorSalaryConfigs', configId));
            toast.success('Salary configuration unset');
            await loadMonthData();
          } catch(err) {
            console.error(err);
            toast.error('Failed to unset');
            e.target.disabled = false;
            e.target.textContent = 'Unset';
          }
       });
    });
    if (window.lucide) lucide.createIcons();
  }

  function openHolidayModal(student, outstanding, monthlyFee, cycleLabel) {
    if (!holidayModal) return;

    const todayStr = new Date().toISOString().split('T')[0];
    document.getElementById('holidayStudentName').textContent = `${student.name} (${student.studentId || '-'})`;
    document.getElementById('holidayFeeCycle').textContent = cycleLabel;
    
    const targetAmount = outstanding > 0 ? outstanding : monthlyFee;
    document.getElementById('holidayCurrentOutstanding').textContent = formatter.format(targetAmount);

    const priceInput = document.getElementById('holidayPriceInput');
    const reasonInput = document.getElementById('holidayReasonInput');
    const dateInput = document.getElementById('holidayDateInput');
    const waiveNote = document.getElementById('holidayWaiveNote');

    reasonInput.value = '';
    priceInput.value = '0';
    dateInput.value = todayStr;

    function updateWaiveNote() {
      const enteredPrice = parseFloat(priceInput.value) || 0;
      const waived = Math.max(0, targetAmount - enteredPrice);
      waiveNote.textContent = `Waived Amount: ${formatter.format(waived)} (Fee cycle will be marked fully settled)`;
    }

    priceInput.oninput = updateWaiveNote;
    updateWaiveNote();

    holidayModal.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
    setTimeout(() => reasonInput.focus(), 60);

    holidayForm.onsubmit = async (e) => {
      e.preventDefault();
      const reason = reasonInput.value.trim();
      if (!reason) {
        toast.error('Please enter a reason for the holiday');
        reasonInput.focus();
        return;
      }

      const price = parseFloat(priceInput.value);
      if (isNaN(price) || price < 0) {
        toast.error('Please enter a valid price/amount (0 or higher)');
        priceInput.focus();
        return;
      }

      const payDate = dateInput.value || todayStr;
      const payMethod = document.getElementById('holidayPaymentMethod')?.value || 'Cash';

      await processHolidayFee(student, price, targetAmount, reason, payDate, payMethod, cycleLabel);
      holidayModal.style.display = 'none';
    };
  }

  async function processHolidayFee(student, payAmount, expected, reason, payDate, payMethod, billingCycle) {
    const studentDocId = student.id;
    const submitBtn = document.getElementById('submitHolidayBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader" class="animate-spin" style="width: 15px; height: 15px;"></i> Processing...';
    if (window.lucide) lucide.createIcons();

    const billingMonth = monthSelector.value;
    const waivedAmount = Math.max(0, expected - payAmount);

    try {
      const counterRef = doc(db, 'counters', 'receipts');
      await runTransaction(db, async (tx) => {
        const counterDoc = await tx.get(counterRef);
        let newCount = 1;
        if (counterDoc.exists()) {
          newCount = (counterDoc.data().count || 0) + 1;
          tx.update(counterRef, { count: newCount });
        } else {
          tx.set(counterRef, { count: newCount });
        }
        const receiptNumber = `ABR-RCP-${newCount.toString().padStart(6, '0')}`;
        
        const paymentRef = doc(collection(db, 'payments'));
        const transRef = doc(collection(db, 'transactions'));

        tx.set(paymentRef, {
          receiptNumber,
          studentId: studentDocId,
          billingMonth,
          billingCycle,
          expectedAmount: expected,
          paidAmount: payAmount,
          waivedAmount: waivedAmount,
          isVacationLeave: true,
          isHoliday: true,
          holidayReason: reason,
          paymentMethod: payMethod,
          paymentDate: payDate,
          transactionId: transRef.id,
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser ? auth.currentUser.uid : 'system'
        });

        tx.set(transRef, {
          date: payDate,
          type: 'income',
          category: 'Student Fee',
          description: payAmount > 0 
            ? `Holiday fee for ${student.name} (${billingCycle}) - ${reason}`
            : `Holiday fee (Waived) for ${student.name} (${billingCycle}) - ${reason}`,
          amount: payAmount,
          studentId: studentDocId,
          paymentId: paymentRef.id,
          referenceNumber: receiptNumber,
          isHoliday: true,
          holidayReason: reason,
          createdBy: auth.currentUser ? auth.currentUser.uid : 'system',
          createdAt: serverTimestamp()
        });
      });

      if (holidayCheckbox) holidayCheckbox.checked = false;

      toast.success(`Holiday fee of ${formatter.format(payAmount)} recorded! Reason: ${reason}`);
      await loadMonthData();
    } catch(e) {
      console.error(e);
      toast.error('Failed to record holiday fee: ' + e.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="check" style="width: 15px; height: 15px;"></i> Submit & Save Fee';
      if (window.lucide) lucide.createIcons();
    }
  }

  async function processFee(student, payAmount, expected, billingCycleParam) {
    const studentDocId = student.id;
    const btn = document.getElementById('acceptFeeBtn');
    btn.disabled = true;
    btn.textContent = 'Processing...';
    
    const billingMonth = monthSelector.value;
    const cycleDateStr = getCycleDateString(student, billingMonth);
    const billingCycle = billingCycleParam || formatBillingCycle(student, billingMonth, cycleDateStr);
    const payDate = new Date().toISOString().split('T')[0];
    
    try {
      const counterRef = doc(db, 'counters', 'receipts');
      await runTransaction(db, async (tx) => {
        const counterDoc = await tx.get(counterRef);
        let newCount = 1;
        if (counterDoc.exists()) {
          newCount = (counterDoc.data().count || 0) + 1;
          tx.update(counterRef, { count: newCount });
        } else {
          tx.set(counterRef, { count: newCount });
        }
        const receiptNumber = `ABR-RCP-${newCount.toString().padStart(6, '0')}`;
        
        const paymentRef = doc(collection(db, 'payments'));
        const transRef = doc(collection(db, 'transactions'));

        tx.set(paymentRef, {
          receiptNumber, studentId: studentDocId, billingMonth, billingCycle,
          expectedAmount: expected, paidAmount: payAmount, waivedAmount: 0,
          isVacationLeave: false, isHoliday: false, paymentMethod: 'Cash', paymentDate: payDate,
          transactionId: transRef.id,
          createdAt: serverTimestamp(), createdBy: auth.currentUser ? auth.currentUser.uid : 'system'
        });

        tx.set(transRef, {
          date: payDate, type: 'income', category: 'Student Fee',
          description: `Fee payment for ${student.name} (${billingCycle})`, amount: payAmount,
          studentId: studentDocId, paymentId: paymentRef.id, referenceNumber: receiptNumber,
          createdBy: auth.currentUser ? auth.currentUser.uid : 'system', createdAt: serverTimestamp()
        });
      });
      toast.success('Fee accepted successfully!');
      await loadMonthData();
    } catch(e) {
      console.error(e);
      toast.error('Failed to accept fee');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Accept Outstanding Fee';
    }
  }

  async function processSalary(tutorDocId, amount, btnEl, student, configId) {
    btnEl.disabled = true;
    btnEl.textContent = 'Saving...';
    const month = monthSelector.value;
    const cycleDateStr = getCycleDateString(student, month);
    const billingCycle = formatBillingCycle(student, month, cycleDateStr);
    
    try {
      const docRef = configId ? doc(db, 'tutorSalaryConfigs', configId) : doc(collection(db, 'tutorSalaryConfigs'));
      await setDoc(docRef, {
        tutorId: tutorDocId,
        studentId: student.id,
        month: month,
        billingCycle: billingCycle,
        amount: amount,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser ? auth.currentUser.uid : 'system'
      }, { merge: true });
      
      toast.success('Salary configured successfully!');
      await loadMonthData();
    } catch(e) {
      console.error(e);
      toast.error('Failed to configure salary');
    } finally {
      btnEl.disabled = false;
      btnEl.textContent = 'Set Salary';
    }
  }

  loadInitialData();
});
