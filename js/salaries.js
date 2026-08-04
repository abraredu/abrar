import { toast } from './toast.js';
// js/salaries.js
import { db, auth } from './firebase-config.js';
import { collection, getDocs, query, where, doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
  const monthSelector = document.getElementById('monthSelector');
  const tbody = document.getElementById('salariesTableBody');
  const searchInput = document.getElementById('searchInput');
  
  // Modal Elements
  const salaryModal = document.getElementById('salaryModal');
  const salaryForm = document.getElementById('salaryForm');
  const closeModalBtn = document.getElementById('closeSalaryModalBtn');
  const payAdjustmentInput = document.getElementById('payAdjustment');
  const payFinalAmountDisplay = document.getElementById('payFinalAmount');
  
  let currentTutors = [];
  let currentStudents = []; // Needed for per_student calculation
  let currentSalaryPayments = [];
  let currentMonthlyClasses = {};
  let currentRoleSalaries = [];

  // Initialize Month Selector to Current Month
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  monthSelector.value = currentMonth;
  document.getElementById('payDate').value = now.toISOString().split('T')[0];

  const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

  async function loadSalaryData() {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">Loading...</td></tr>';
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

      // Fetch Tutor Role Salaries configured in Salary Control for this month
      const roleSalariesQ = query(collection(db, "tutorRoleSalaries"), where("month", "==", selectedMonth));
      const roleSalariesSnap = await getDocs(roleSalariesQ);
      currentRoleSalaries = [];
      roleSalariesSnap.forEach(doc => currentRoleSalaries.push({ id: doc.id, ...doc.data() }));

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
      // Determine base calculated amount and salary model display
      let calculatedAmount = 0;
      let salaryModelStr = '';

      const tutorRoleConfigs = currentRoleSalaries.filter(r => r.tutorId === tutor.id);

      if (tutorRoleConfigs.length > 0) {
        const modelParts = tutorRoleConfigs.map(r => {
          let rAmount = 0;
          if (r.salaryType === 'fixed_monthly') {
            rAmount = r.rate || 0;
          } else if (r.salaryType === 'per_student') {
            const studentCount = currentStudents.filter(s => s.tutorId === tutor.id).length;
            rAmount = (studentCount > 0 ? studentCount : 1) * (r.rate || 0);
          } else if (r.salaryType === 'per_class') {
            const classData = currentMonthlyClasses[tutor.id];
            const classCount = classData && classData.classCount > 0 ? classData.classCount : 1;
            rAmount = classCount * (r.rate || 0);
          }
          calculatedAmount += rAmount;
          const typeName = (r.salaryType || 'unspecified').replace('_', ' ');
          return `${typeName} (₹${r.rate || 0})`;
        });
        salaryModelStr = modelParts.join(', ');
      } else {
        if (tutor.salaryType === 'fixed_monthly') {
          calculatedAmount = tutor.salaryRate || 0;
        } else if (tutor.salaryType === 'per_student') {
          const studentCount = currentStudents.filter(s => s.tutorId === tutor.id).length;
          calculatedAmount = studentCount * (tutor.salaryRate || 0);
        } else if (tutor.salaryType === 'per_class') {
          const classData = currentMonthlyClasses[tutor.id];
          const classCount = classData ? classData.classCount : 0;
          calculatedAmount = classCount * (tutor.salaryRate || 0);
        }
        salaryModelStr = `${(tutor.salaryType || 'unspecified').replace('_', ' ')} (₹${tutor.salaryRate || 0})`;
      }
      
      // Look for existing salary payment records for this month
      const tutorPayments = currentSalaryPayments.filter(p => p.tutorId === tutor.id);
      
      // Total paid so far
      const alreadyPaid = tutorPayments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
      
      // Fetch latest adjustment
      const adjustment = tutorPayments.reduce((sum, p) => sum + (p.adjustment || 0), 0);
      
      const finalAmount = calculatedAmount + adjustment;
      const balance = finalAmount - alreadyPaid;
      
      let status = 'Pending';
      if (alreadyPaid >= finalAmount && finalAmount > 0) status = 'Paid';
      else if (alreadyPaid > 0) status = 'Partial';
      else if (finalAmount === 0 && tutor.salaryType !== 'per_class' && tutorRoleConfigs.length === 0) status = 'Zero';

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

      const payBtnClass = status === 'Paid' ? 'btn-outline' : 'btn-primary';
      const payBtnText = status === 'Paid' ? 'Pay More' : 'Pay';

      return `
        <tr style="border-bottom: 1px solid var(--color-border);">
          <td style="padding: 0.75rem;">
            <div style="font-weight: 500;">${tutor.name}</div>
            <div style="font-size: 0.75rem; color: var(--color-text-secondary);">${tutor.tutorId}</div>
          </td>
          <td style="padding: 0.75rem;">${salaryModelStr}</td>
          <td style="padding: 0.75rem;">${formatter.format(calculatedAmount)}</td>
          <td style="padding: 0.75rem;">${adjustment !== 0 ? formatter.format(adjustment) : '-'}</td>
          <td style="padding: 0.75rem; font-weight:600;">${formatter.format(finalAmount)}</td>
          <td style="padding: 0.75rem; color: ${alreadyPaid > 0 ? 'var(--color-success)' : 'inherit'};">${formatter.format(alreadyPaid)}</td>
          <td style="padding: 0.75rem;">${statusBadge}</td>
          <td style="padding: 0.75rem;">
            <button class="btn ${payBtnClass} pay-btn" data-id="${tutor.id}" data-calc="${calculatedAmount}" data-paid="${alreadyPaid}" style="font-size: 0.75rem; padding: 0.25rem 0.6rem;">${payBtnText}</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml || '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No matching tutors found.</td></tr>';
    
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

  tbody.addEventListener('click', (e) => {
    const payBtn = e.target.closest('.pay-btn');
    if (payBtn) {
      const tutorId = payBtn.getAttribute('data-id');
      currentPayCalcAmount = parseFloat(payBtn.getAttribute('data-calc')) || 0;
      currentPayAlreadyPaid = parseFloat(payBtn.getAttribute('data-paid')) || 0;
      openSalaryModal(tutorId);
    }
  });

  const payAmountInput = document.getElementById('payAmount');

  function updateFinalAmount(fromPayAmount = false) {
    let adjustment = parseFloat(payAdjustmentInput.value) || 0;
    
    if (fromPayAmount) {
      const payAmount = parseFloat(payAmountInput.value) || 0;
      adjustment = (payAmount + currentPayAlreadyPaid) - currentPayCalcAmount;
      payAdjustmentInput.value = adjustment;
    }
    
    const finalAmount = currentPayCalcAmount + adjustment;
    const balance = finalAmount - currentPayAlreadyPaid;
    
    payFinalAmountDisplay.textContent = formatter.format(finalAmount);
    
    if (!fromPayAmount) {
      payAmountInput.value = Math.max(0, balance) || '';
    }
  }

  payAdjustmentInput.addEventListener('input', () => updateFinalAmount(false));
  if (payAmountInput) {
    payAmountInput.addEventListener('input', () => updateFinalAmount(true));
  }

  function openSalaryModal(tutorDocId) {
    const tutor = currentTutors.find(t => t.id === tutorDocId);
    if (!tutor) return;

    document.getElementById('payTutorId').value = tutorDocId;
    document.getElementById('payTutorName').textContent = tutor.name;
    document.getElementById('payTutorIdDisplay').textContent = tutor.tutorId;
    document.getElementById('payCalculated').textContent = formatter.format(currentPayCalcAmount);
    
    document.getElementById('payAdjustment').value = 0;
    if (payAmountInput) {
      payAmountInput.removeAttribute('max');
    }
    
    updateFinalAmount(false);

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
    const adjustment = parseFloat(document.getElementById('payAdjustment').value) || 0;
    const payMethod = document.getElementById('payMethod').value;
    const payDate = document.getElementById('payDate').value;
    const month = monthSelector.value;
    
    const finalAmount = currentPayCalcAmount + adjustment;

    const tutor = currentTutors.find(t => t.id === tutorDocId);

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Create Salary Payment Record
        const salaryPaymentRef = doc(collection(db, 'salaryPayments'));
        const salaryData = {
          tutorId: tutorDocId || '',
          month: month || '',
          salaryType: (tutor && tutor.salaryType) || 'unspecified',
          rate: (tutor && tutor.salaryRate) !== undefined ? tutor.salaryRate : 0,
          calculatedAmount: currentPayCalcAmount || 0,
          adjustment: adjustment || 0,
          finalAmount: finalAmount || 0,
          paidAmount: payAmount || 0,
          paymentMethod: payMethod || 'UPI',
          paymentDate: payDate || '',
          status: 'paid', // Record status is paid, overall tutor month status computed
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser ? auth.currentUser.uid : 'system'
        };
        transaction.set(salaryPaymentRef, salaryData);

        // 2. Create Expense Transaction Record
        const transactionRef = doc(collection(db, 'transactions'));
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
