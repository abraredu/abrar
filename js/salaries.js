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

      return `
        <tr style="border-bottom: 1px solid var(--color-border);">
          <td style="padding: 0.75rem;">
            <div style="font-weight: 500;">${tutor.name}</div>
            <div style="font-size: 0.75rem; color: var(--color-text-secondary);">${tutor.tutorId}</div>
          </td>
          <td style="padding: 0.75rem;">${typeLabel}</td>
          <td style="padding: 0.75rem; color: ${alreadyPaid > 0 ? 'var(--color-success)' : 'inherit'};">${formatter.format(alreadyPaid)}</td>
          <td style="padding: 0.75rem;">${statusBadge}</td>
          <td style="padding: 0.75rem;">
            ${balance > 0 || (tutor.salaryType === 'per_class' && status !== 'Paid') ? `<button class="btn btn-outline pay-btn" data-id="${tutor.id}" data-calc="${calculatedAmount}" data-paid="${alreadyPaid}" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;">Pay</button>` : `<span style="font-size:0.75rem; color: var(--color-text-secondary);">Settled</span>`}
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml || '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No matching tutors found.</td></tr>';
    
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
    if (e.target.classList.contains('pay-btn')) {
      const tutorId = e.target.getAttribute('data-id');
      currentPayCalcAmount = parseFloat(e.target.getAttribute('data-calc')) || 0;
      currentPayAlreadyPaid = parseFloat(e.target.getAttribute('data-paid')) || 0;
      openSalaryModal(tutorId);
    }
  });

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
        // 1. Create Salary Payment Record
        const salaryPaymentRef = doc(collection(db, 'salaryPayments'));
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
          status: 'paid', // Record status is paid, overall tutor month status computed
          paidConfigIds: selectedConfigIds,
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
