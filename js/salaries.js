import { toast } from './toast.js';
// js/salaries.js
import { db, auth } from './firebase-config.js';
import { collection, getDocs, getDoc, query, where, doc, runTransaction, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
  const monthSelector = document.getElementById('monthSelector');
  const tbody = document.getElementById('salariesTableBody');
  const searchInput = document.getElementById('searchInput');
  
  // Modal Elements
  const salaryModal = document.getElementById('salaryModal');
  const salaryForm = document.getElementById('salaryForm');
  const closeModalBtn = document.getElementById('closeSalaryModalBtn');

  // History Modal Elements
  const salaryHistoryModal = document.getElementById('salaryHistoryModal');
  const closeHistoryModalBtn = document.getElementById('closeHistoryModalBtn');
  const closeHistoryModalFooterBtn = document.getElementById('closeHistoryModalFooterBtn');
  const historyPaymentsList = document.getElementById('historyPaymentsList');

  if (closeHistoryModalBtn) {
    closeHistoryModalBtn.addEventListener('click', () => {
      if (salaryHistoryModal) salaryHistoryModal.style.display = 'none';
    });
  }
  if (closeHistoryModalFooterBtn) {
    closeHistoryModalFooterBtn.addEventListener('click', () => {
      if (salaryHistoryModal) salaryHistoryModal.style.display = 'none';
    });
  }
  if (salaryHistoryModal) {
    salaryHistoryModal.addEventListener('click', (e) => {
      if (e.target === salaryHistoryModal) {
        salaryHistoryModal.style.display = 'none';
      }
    });
  }

  
  let currentTutors = [];
  let currentStudents = [];
  let currentSalaryPayments = [];
  let currentMonthlyClasses = {};
  let currentSalaryConfigs = [];

  // Initialize Month Selector to Current Month
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  monthSelector.value = currentMonth;
  document.getElementById('payDate').value = now.toISOString().split('T')[0];

  const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

  async function loadSalaryData() {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">Loading...</td></tr>';
    const selectedMonth = monthSelector.value;
    
    try {
      // Fetch Tutors
      const tutorsQ = query(collection(db, "tutors"), where("status", "==", "active"));
      const tutorsSnap = await getDocs(tutorsQ);
      currentTutors = [];
      tutorsSnap.forEach(doc => currentTutors.push({ id: doc.id, ...doc.data() }));

      // Fetch Students (Active) to calculate per_student if needed
      const studentsQ = query(collection(db, "students"), where("status", "==", "active"));
      const studentsSnap = await getDocs(studentsQ);
      currentStudents = [];
      studentsSnap.forEach(doc => currentStudents.push({ id: doc.id, ...doc.data() }));

      // Fetch Salary Payments for this month
      const paymentsQ = query(collection(db, "salaryPayments"), where("month", "==", selectedMonth));
      const paymentsSnap = await getDocs(paymentsQ);
      currentSalaryPayments = [];
      paymentsSnap.forEach(doc => currentSalaryPayments.push({ id: doc.id, ...doc.data() }));

      // Fetch Monthly Classes for this month
      const classesQ = query(collection(db, "tutorMonthlyClasses"), where("month", "==", selectedMonth));
      const classesSnap = await getDocs(classesQ);
      currentMonthlyClasses = {};
      classesSnap.forEach(doc => {
        const data = doc.data();
        currentMonthlyClasses[data.tutorId] = data;
      });

      // Fetch tutorSalaryConfigs
      const configsQ = query(collection(db, "tutorSalaryConfigs"), where("month", "==", selectedMonth));
      const configsSnap = await getDocs(configsQ);
      currentSalaryConfigs = [];
      configsSnap.forEach(doc => currentSalaryConfigs.push({ id: doc.id, ...doc.data() }));

      renderTable();
    } catch (error) {
      console.error("Error loading salary data:", error);
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--color-danger);">Error: ${error.message}</td></tr>`;
    }
  }

  function renderTable() {
    const searchTerm = searchInput.value.toLowerCase();
    
    let totalCalculated = 0;
    let totalPaid = 0;
    let pendingTutorsCount = 0;

    const rowsHtml = currentTutors.map(tutor => {
      // Determine base calculated amount
      let calculatedAmount = 0;
      
      const tutorConfigs = currentSalaryConfigs.filter(c => c.tutorId === tutor.id);
      if (tutorConfigs.length > 0) {
        calculatedAmount = tutorConfigs.reduce((sum, c) => sum + (c.amount || 0), 0);
      } else {
        if (tutor.salaryType === 'fixed_monthly') {
          calculatedAmount = tutor.salaryRate || 0;
        } else if (tutor.salaryType === 'per_student') {
          // Count active students assigned to this tutor
          const studentCount = currentStudents.filter(s => s.tutorId === tutor.id).length;
          calculatedAmount = studentCount * (tutor.salaryRate || 0);
        } else if (tutor.salaryType === 'per_class') {
          const classData = currentMonthlyClasses[tutor.id];
          const classCount = classData ? classData.classCount : 0;
          calculatedAmount = classCount * (tutor.salaryRate || 0);
        }
      }
      
      // Look for existing salary payment records for this month
      const tutorPayments = currentSalaryPayments.filter(p => p.tutorId === tutor.id);
      
      // Total paid so far
      const alreadyPaid = tutorPayments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
      
      // Fetch latest adjustment (if multiple, sum them or just take latest for display)
      const adjustment = tutorPayments.reduce((sum, p) => sum + (p.adjustment || 0), 0);
      
      const finalAmount = calculatedAmount + adjustment;
      const balance = finalAmount - alreadyPaid;
      
      let status = 'Pending';
      if (alreadyPaid >= finalAmount && finalAmount > 0) status = 'Paid';
      else if (alreadyPaid > 0) status = 'Partial';
      else if (finalAmount === 0 && tutor.salaryType !== 'per_class') status = 'Zero';

      if (status !== 'Paid' && status !== 'Zero') {
        pendingTutorsCount++;
      }

      totalCalculated += finalAmount;
      totalPaid += alreadyPaid;

      if (searchTerm && !tutor.name.toLowerCase().includes(searchTerm) && !tutor.tutorId.toLowerCase().includes(searchTerm)) return '';

      const statusBadge = status === 'Paid' 
        ? `<span style="background: var(--color-sidebar-active); color: var(--color-success); padding: 0.25rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 500;">Paid</span>`
        : status === 'Partial'
        ? `<span style="background: #FEF3C7; color: var(--color-warning); padding: 0.25rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 500;">Partial</span>`
        : status === 'Zero'
        ? `<span style="background: var(--color-sidebar-hover); color: var(--color-text-secondary); padding: 0.25rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 500;">None</span>`
        : `<span style="background: #FEF2F2; color: var(--color-danger); padding: 0.25rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 500;">Pending</span>`;

      let typeLabel = '-';
      if (tutor.tutorType) {
        const types = Array.isArray(tutor.tutorType) ? tutor.tutorType : [tutor.tutorType];
        typeLabel = types.map(t => {
          return t === 'madrasa_individual' ? 'Madrasa Individual' : 
                 t === 'madrasa_group' ? 'Madrasa Group' : 
                 t === 'quran_recitation' ? "Qur'an Recitation" : t;
        }).join(', ');
      }

      let actionBtns = '';
      if (balance > 0 || (tutor.salaryType === 'per_class' && status !== 'Paid')) {
        actionBtns += `<button class="btn btn-outline pay-btn" data-id="${tutor.id}" data-calc="${calculatedAmount}" data-paid="${alreadyPaid}" style="font-size: 0.75rem; padding: 0.25rem 0.55rem;">Pay</button>`;
      }
      if (tutorPayments.length > 0) {
        actionBtns += `
          <button class="btn btn-sm btn-outline view-history-btn" data-id="${tutor.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 0.25rem; color: #475569;" title="View payment records">
            <i data-lucide="history" style="width: 13px; height: 13px;"></i> (${tutorPayments.length})
          </button>
          <button class="btn btn-sm btn-outline delete-salary-payment-btn" data-payment-id="${tutorPayments[tutorPayments.length - 1].id}" data-tutor-name="${tutor.name}" data-amount="${tutorPayments[tutorPayments.length - 1].paidAmount}" style="padding: 0.25rem 0.45rem; font-size: 0.75rem; border-color: #fecaca; color: #dc2626; background: #fef2f2; display: inline-flex; align-items: center;" title="Delete latest payment (${formatter.format(tutorPayments[tutorPayments.length - 1].paidAmount || 0)})">
            <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
          </button>
        `;
      } else if (balance <= 0 && finalAmount === 0) {
        actionBtns = `<span style="font-size:0.75rem; color: var(--color-text-secondary);">No Salary</span>`;
      }

      return `
        <tr style="border-bottom: 1px solid var(--color-border);">
          <td style="padding: 0.75rem;">
            <div style="font-weight: 500;">${tutor.name}</div>
            <div style="font-size: 0.75rem; color: var(--color-text-secondary);">${tutor.tutorId}</div>
          </td>
          <td style="padding: 0.75rem;">${typeLabel}</td>
          <td style="padding: 0.75rem; color: ${alreadyPaid > 0 ? 'var(--color-success)' : 'inherit'}; font-weight: ${alreadyPaid > 0 ? '600' : 'normal'};">${formatter.format(alreadyPaid)}</td>
          <td style="padding: 0.75rem;">${statusBadge}</td>
          <td style="padding: 0.75rem;">
            <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">${actionBtns}</div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml || '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No matching tutors found.</td></tr>';
    if (window.lucide) lucide.createIcons();
    
    document.getElementById('statCalculated').textContent = formatter.format(totalCalculated);
    document.getElementById('statPaid').textContent = formatter.format(totalPaid);
    document.getElementById('statPending').textContent = formatter.format(totalCalculated - totalPaid);
    document.getElementById('statTutorsPending').textContent = pendingTutorsCount;
  }

  // Event Listeners
  monthSelector.addEventListener('change', loadSalaryData);
  searchInput.addEventListener('input', renderTable);

  let currentPayCalcAmount = 0;
  let currentPayAlreadyPaid = 0;

  tbody.addEventListener('click', async (e) => {
    const payBtn = e.target.closest('.pay-btn');
    if (payBtn) {
      const tutorId = payBtn.getAttribute('data-id');
      currentPayCalcAmount = parseFloat(payBtn.getAttribute('data-calc')) || 0;
      currentPayAlreadyPaid = parseFloat(payBtn.getAttribute('data-paid')) || 0;
      openSalaryModal(tutorId);
      return;
    }

    const historyBtn = e.target.closest('.view-history-btn');
    if (historyBtn) {
      const tutorId = historyBtn.getAttribute('data-id');
      openHistoryModal(tutorId);
      return;
    }

    const deleteBtn = e.target.closest('.delete-salary-payment-btn');
    if (deleteBtn) {
      const paymentId = deleteBtn.getAttribute('data-payment-id');
      const tutorName = deleteBtn.getAttribute('data-tutor-name') || 'Tutor';
      const amount = parseFloat(deleteBtn.getAttribute('data-amount')) || 0;
      await deleteSalaryPayment(paymentId, tutorName, amount);
      return;
    }
  });

  if (historyPaymentsList) {
    historyPaymentsList.addEventListener('click', async (e) => {
      const deleteBtn = e.target.closest('.delete-salary-payment-btn');
      if (deleteBtn) {
        const paymentId = deleteBtn.getAttribute('data-payment-id');
        const tutorName = deleteBtn.getAttribute('data-tutor-name') || 'Tutor';
        const amount = parseFloat(deleteBtn.getAttribute('data-amount')) || 0;
        await deleteSalaryPayment(paymentId, tutorName, amount);
      }
    });
  }

  function openHistoryModal(tutorDocId) {
    const tutor = currentTutors.find(t => t.id === tutorDocId);
    if (!tutor) return;

    const tutorPayments = currentSalaryPayments.filter(p => p.tutorId === tutorDocId);
    const historyModal = document.getElementById('salaryHistoryModal');
    const historyTutorName = document.getElementById('historyTutorName');
    const historyMonthSubtitle = document.getElementById('historyMonthSubtitle');
    const historyPaymentsListEl = document.getElementById('historyPaymentsList');

    if (!historyModal) return;

    historyTutorName.textContent = `${tutor.name} (${tutor.tutorId})`;
    historyMonthSubtitle.textContent = `Payments for ${monthSelector.value} (${tutorPayments.length} payment${tutorPayments.length === 1 ? '' : 's'})`;

    if (tutorPayments.length === 0) {
      historyPaymentsListEl.innerHTML = `<p style="text-align: center; color: #64748b; font-size: 0.875rem; padding: 1.5rem;">No payments found for this month.</p>`;
    } else {
      let listHtml = `<div style="display: flex; flex-direction: column; gap: 0.75rem;">`;
      tutorPayments.forEach((p) => {
        listHtml += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border: 1px solid var(--color-border); border-radius: 8px; background: #f8fafc;">
            <div>
              <div style="font-weight: 700; color: #0f172a; font-size: 0.95rem;">${formatter.format(p.paidAmount || 0)}</div>
              <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.2rem;">
                <span>📅 ${p.paymentDate || '-'}</span> • <span>💳 ${p.paymentMethod || 'Cash'}</span>
              </div>
            </div>
            <button class="btn btn-sm btn-outline text-danger delete-salary-payment-btn" data-payment-id="${p.id}" data-tutor-name="${tutor.name}" data-amount="${p.paidAmount}" style="border-color: #fecaca; color: #dc2626; background: #fff; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 0.3rem;" title="Delete this payment">
              <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i> Delete
            </button>
          </div>
        `;
      });
      listHtml += `</div>`;
      historyPaymentsListEl.innerHTML = listHtml;
    }

    historyModal.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
  }

  async function deleteSalaryPayment(paymentId, tutorName, amount) {
    if (!confirm(`Are you sure you want to delete the salary payment of ${formatter.format(amount || 0)} for ${tutorName}? This will remove it from Salaries and Accounts.`)) {
      return;
    }

    try {
      const spRef = doc(db, "salaryPayments", paymentId);
      const spSnap = await getDoc(spRef);
      const spData = spSnap.exists() ? spSnap.data() : null;

      // 1. Delete matching transaction in transactions collection by transactionId
      if (spData && spData.transactionId) {
        try {
          await deleteDoc(doc(db, "transactions", spData.transactionId));
        } catch (txErr) {
          console.warn("Could not delete transaction by id:", txErr);
        }
      }

      // Also query transactions collection for any transaction linking to this salaryPaymentId
      try {
        const txQ = query(collection(db, "transactions"), where("salaryPaymentId", "==", paymentId));
        const txSnap = await getDocs(txQ);
        for (const tDoc of txSnap.docs) {
          await deleteDoc(doc(db, "transactions", tDoc.id));
        }

        // Fallback: match by tutorId, date, amount
        if (txSnap.empty && spData && spData.tutorId) {
          const fbQ = query(collection(db, "transactions"), where("tutorId", "==", spData.tutorId));
          const fbSnap = await getDocs(fbQ);
          for (const fbDoc of fbSnap.docs) {
            const fb = fbDoc.data();
            if (fb.amount === spData.paidAmount && (fb.date === spData.paymentDate || fb.description?.includes(spData.month))) {
              await deleteDoc(doc(db, "transactions", fbDoc.id));
            }
          }
        }
      } catch (tErr) {
        console.warn("Transaction cleanup error:", tErr);
      }

      // 2. Delete the salary payment document itself
      await deleteDoc(spRef);

      toast.success(`Salary payment for ${tutorName} deleted and removed from all pages!`);
      
      const historyModal = document.getElementById('salaryHistoryModal');
      if (historyModal) historyModal.style.display = 'none';

      await loadSalaryData();
    } catch (err) {
      console.error("Error deleting salary payment:", err);
      toast.error("Failed to delete salary payment: " + err.message);
    }
  }

  function updateFinalAmount() {
    const configsContainer = document.getElementById('paymentConfigsContainer');
    if (configsContainer.style.display === 'block') {
        const checkboxes = document.querySelectorAll('#paymentConfigsList input[type="checkbox"]:not(:disabled)');
        let selectedTotal = 0;
        checkboxes.forEach(cb => {
           if (cb.checked) {
              selectedTotal += parseFloat(cb.dataset.amount) || 0;
           }
        });
        document.getElementById('payAmount').value = selectedTotal;
        document.getElementById('payAmount').max = selectedTotal;
    } else {
        const finalAmount = currentPayCalcAmount;
        const balance = finalAmount - currentPayAlreadyPaid;
        document.getElementById('payAmount').value = Math.max(0, balance);
        document.getElementById('payAmount').max = Math.max(0, balance);
    }
  }

  function openSalaryModal(tutorDocId) {
    const tutor = currentTutors.find(t => t.id === tutorDocId);
    if (!tutor) return;

    document.getElementById('payTutorId').value = tutorDocId;
    document.getElementById('payTutorName').textContent = tutor.name;
    document.getElementById('payTutorIdDisplay').textContent = tutor.tutorId;
    document.getElementById('payCalculated').textContent = formatter.format(currentPayCalcAmount);
    
    const tutorConfigs = currentSalaryConfigs.filter(c => c.tutorId === tutorDocId);
    const tutorPayments = currentSalaryPayments.filter(p => p.tutorId === tutorDocId);
    const paidConfigIds = new Set();
    tutorPayments.forEach(p => {
       if (p.paidConfigIds) {
          p.paidConfigIds.forEach(id => paidConfigIds.add(id));
       }
    });

    const configsContainer = document.getElementById('paymentConfigsContainer');
    const configsList = document.getElementById('paymentConfigsList');
    configsList.innerHTML = '';
    
    if (tutorConfigs.length > 0) {
       configsContainer.style.display = 'block';
       tutorConfigs.forEach(c => {
          const isPaid = paidConfigIds.has(c.id);
          const student = currentStudents.find(s => s.id === c.studentId);
          const studentName = student ? student.name : 'Unknown Student';
          const lbl = document.createElement('label');
          lbl.style.display = 'flex';
          lbl.style.alignItems = 'center';
          lbl.style.gap = '0.5rem';
          lbl.style.padding = '0.5rem';
          lbl.style.background = 'white';
          lbl.style.borderRadius = '4px';
          lbl.style.border = '1px solid var(--color-border)';
          lbl.style.cursor = isPaid ? 'not-allowed' : 'pointer';
          lbl.style.opacity = isPaid ? '0.6' : '1';
          
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = c.id;
          checkbox.dataset.amount = c.amount;
          if (isPaid) {
             checkbox.checked = true;
             checkbox.disabled = true;
          } else {
             checkbox.checked = true;
             checkbox.addEventListener('change', updateFinalAmount);
          }
          
          lbl.appendChild(checkbox);
          lbl.appendChild(document.createTextNode(`${studentName} - ${formatter.format(c.amount)} ${isPaid ? '(Paid)' : ''}`));
          configsList.appendChild(lbl);
       });
    } else {
       configsContainer.style.display = 'none';
    }
    
    updateFinalAmount();

    salaryModal.style.display = 'flex';
  }

  closeModalBtn.addEventListener('click', () => {
    salaryModal.style.display = 'none';
    salaryForm.reset();
  });

  salaryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveSalaryBtn');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    const tutorDocId = document.getElementById('payTutorId').value;
    const payAmount = parseFloat(document.getElementById('payAmount').value);
    const adjustment = 0;
    const payMethod = document.getElementById('payMethod').value;
    const payDate = document.getElementById('payDate').value;
    const month = monthSelector.value;
    
    const finalAmount = currentPayCalcAmount;

    const tutor = currentTutors.find(t => t.id === tutorDocId);
    
    const configsContainer = document.getElementById('paymentConfigsContainer');
    const selectedConfigIds = [];
    if (configsContainer.style.display === 'block') {
       const checkboxes = document.querySelectorAll('#paymentConfigsList input[type="checkbox"]:not(:disabled)');
       checkboxes.forEach(cb => {
          if (cb.checked) selectedConfigIds.push(cb.value);
       });
    }

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Create references
        const salaryPaymentRef = doc(collection(db, 'salaryPayments'));
        const transactionRef = doc(collection(db, 'transactions'));

        // 2. Create Salary Payment Record with transactionId link
        const salaryData = {
          tutorId: tutorDocId,
          month: month,
          salaryType: tutor.salaryType || 'custom',
          rate: tutor.salaryRate || 0,
          calculatedAmount: currentPayCalcAmount,
          adjustment: adjustment,
          finalAmount: finalAmount,
          paidAmount: payAmount,
          paymentMethod: payMethod,
          paymentDate: payDate,
          status: 'paid',
          paidConfigIds: selectedConfigIds,
          transactionId: transactionRef.id,
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser ? auth.currentUser.uid : 'system'
        };
        transaction.set(salaryPaymentRef, salaryData);

        // 3. Create Expense Transaction Record with salaryPaymentId link
        const transactionData = {
          date: payDate,
          type: 'expense',
          category: 'Tutor Salary',
          description: `Salary payment for ${tutor.name} (${month})`,
          amount: payAmount,
          tutorId: tutorDocId,
          salaryPaymentId: salaryPaymentRef.id,
          createdBy: auth.currentUser ? auth.currentUser.uid : 'system',
          createdAt: serverTimestamp()
        };
        transaction.set(transactionRef, transactionData);
      });

      toast.success('Salary payment recorded successfully! Automatic Expense transaction generated.');
      salaryModal.style.display = 'none';
      salaryForm.reset();
      
      loadSalaryData();

    } catch (error) {
      console.error("Salary payment error:", error);
      toast.error('Error processing salary: ' + error.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Confirm Payment';
    }
  });

  loadSalaryData();
});
