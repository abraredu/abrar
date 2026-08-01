import { toast } from './toast.js';
// js/fees.js
import { db, auth } from './firebase-config.js';
import { collection, getDocs, query, where, doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
  const monthSelector = document.getElementById('monthSelector');
  const tbody = document.getElementById('feesTableBody');
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');
  
  // Payment Modal Elements
  const paymentModal = document.getElementById('paymentModal');
  const paymentForm = document.getElementById('paymentForm');
  const closeModalBtn = document.getElementById('closePaymentModalBtn');
  const isVacationCheckbox = document.getElementById('isVacation');
  const payAmountInput = document.getElementById('payAmount');
  
  let currentStudents = [];
  let currentPayments = [];

  // Initialize Month Selector to Current Month (YYYY-MM)
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  monthSelector.value = currentMonth;
  
  // Set default payment date to today
  document.getElementById('payDate').value = now.toISOString().split('T')[0];

  const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

  async function loadFeeData() {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading...</td></tr>';
    const selectedMonth = monthSelector.value;
    
    try {
      // 1. Fetch all active students
      const studentsQ = query(collection(db, "students"), where("status", "==", "active"));
      const studentsSnap = await getDocs(studentsQ);
      currentStudents = [];
      studentsSnap.forEach(doc => currentStudents.push({ id: doc.id, ...doc.data() }));

      // 2. Fetch all payments for this billing month
      const paymentsQ = query(collection(db, "payments"), where("billingMonth", "==", selectedMonth));
      const paymentsSnap = await getDocs(paymentsQ);
      currentPayments = [];
      paymentsSnap.forEach(doc => currentPayments.push({ id: doc.id, ...doc.data() }));

      renderTable();
    } catch (error) {
      console.error("Error loading fee data:", error);
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--color-danger);">Error: ${error.message}</td></tr>`;
    }
  }

  function renderTable() {
    const searchTerm = searchInput.value.toLowerCase();
    const statusTerm = statusFilter.value;

    let totalExpected = 0;
    let totalCollected = 0;

    const rowsHtml = currentStudents.map(student => {
      const monthlyFee = student.monthlyFee || 0;
      
      // Calculate total paid and waived for this student in this billing month
      const studentPayments = currentPayments.filter(p => p.studentId === student.id);
      const actualPaid = studentPayments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
      const waived = studentPayments.reduce((sum, p) => sum + (p.waivedAmount || 0), 0);
      const totalCredited = actualPaid + waived;
      
      const balance = monthlyFee - totalCredited;
      let status = 'Pending';
      if (totalCredited >= monthlyFee && monthlyFee > 0) {
        status = waived > 0 ? 'Vacation Leave' : 'Paid';
      } else if (totalCredited > 0) {
        status = 'Partial';
      }
      
      totalExpected += monthlyFee;
      totalCollected += actualPaid;

      // Filtering
      if (statusTerm && status !== statusTerm) return '';
      if (searchTerm && !student.name.toLowerCase().includes(searchTerm) && !student.studentId.toLowerCase().includes(searchTerm)) return '';

      let statusBadge = '';
      if (status === 'Paid') {
        statusBadge = `<span style="background: var(--color-sidebar-active); color: var(--color-success); padding: 0.25rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 500;">Paid</span>`;
      } else if (status === 'Partial') {
        statusBadge = `<span style="background: #FEF3C7; color: var(--color-warning); padding: 0.25rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 500;">Partial</span>`;
      } else if (status === 'Vacation Leave') {
        statusBadge = `<span style="background: #E0E7FF; color: #4338CA; padding: 0.25rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 500;">On Leave</span>`;
      } else {
        statusBadge = `<span style="background: #FEF2F2; color: var(--color-danger); padding: 0.25rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 500;">Pending</span>`;
      }

      return `
        <tr style="border-bottom: 1px solid var(--color-border);">
          <td style="padding: 0.75rem;">
            <div style="font-weight: 500;">${student.name}</div>
            <div style="font-size: 0.75rem; color: var(--color-text-secondary);">${student.studentId}</div>
          </td>
          <td style="padding: 0.75rem;">${formatter.format(monthlyFee)}</td>
          <td style="padding: 0.75rem;">${formatter.format(monthlyFee)}</td>
          <td style="padding: 0.75rem; color: ${actualPaid > 0 ? 'var(--color-success)' : 'inherit'};">${formatter.format(actualPaid)}</td>
          <td style="padding: 0.75rem; color: ${balance > 0 ? 'var(--color-danger)' : 'inherit'};">${formatter.format(balance)}</td>
          <td style="padding: 0.75rem;">${statusBadge}</td>
          <td style="padding: 0.75rem;">
            ${balance > 0 ? `<button class="btn btn-outline pay-btn" data-id="${student.id}" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;">Pay</button>` : `<span style="font-size:0.75rem; color: var(--color-text-secondary);">Settled</span>`}
            <button class="btn btn-outline view-history-btn" data-id="${student.id}" style="font-size: 0.75rem; padding: 0.25rem 0.5rem; margin-left: 0.25rem;">History</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml || '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No matching records found.</td></tr>';
    
    // Update Stats
    document.getElementById('statExpected').textContent = formatter.format(totalExpected);
    document.getElementById('statCollected').textContent = formatter.format(totalCollected);
    document.getElementById('statPending').textContent = formatter.format(totalExpected - totalCollected);
    
    const rate = totalExpected > 0 ? ((totalCollected / totalExpected) * 100).toFixed(1) : 0;
    document.getElementById('statRate').textContent = `${rate}%`;
  }

  // Event Listeners for Filters
  monthSelector.addEventListener('change', loadFeeData);
  searchInput.addEventListener('input', renderTable);
  statusFilter.addEventListener('change', renderTable);

  // Event Delegation for Table Buttons
  tbody.addEventListener('click', (e) => {
    if (e.target.classList.contains('pay-btn')) {
      const studentId = e.target.getAttribute('data-id');
      openPaymentModal(studentId);
    } else if (e.target.classList.contains('view-history-btn')) {
      const studentId = e.target.getAttribute('data-id');
      window.location.href = `../students/student-view.html?id=${studentId}`;
    }
  });

  // Modal Logic
  function openPaymentModal(studentDocId) {
    const student = currentStudents.find(s => s.id === studentDocId);
    if (!student) return;

    const monthlyFee = student.monthlyFee || 0;
    const studentPayments = currentPayments.filter(p => p.studentId === studentDocId);
    const actualPaid = studentPayments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
    const waived = studentPayments.reduce((sum, p) => sum + (p.waivedAmount || 0), 0);
    const totalCredited = actualPaid + waived;
    const outstanding = monthlyFee - totalCredited;

    document.getElementById('payStudentId').value = studentDocId;
    document.getElementById('payStudentName').textContent = student.name;
    document.getElementById('payStudentIdDisplay').textContent = student.studentId;
    
    document.getElementById('payExpected').textContent = formatter.format(monthlyFee);
    document.getElementById('payPrevPaid').textContent = formatter.format(totalCredited);
    document.getElementById('payOutstanding').textContent = formatter.format(outstanding);
    
    isVacationCheckbox.checked = false;
    payAmountInput.disabled = false;
    payAmountInput.value = outstanding;
    payAmountInput.max = outstanding;

    // Attach data attribute for outstanding amount to use it when toggling checkbox
    payAmountInput.setAttribute('data-outstanding', outstanding);

    paymentModal.style.display = 'flex';
  }

  isVacationCheckbox.addEventListener('change', (e) => {
    const outstanding = parseFloat(payAmountInput.getAttribute('data-outstanding')) || 0;
    if (e.target.checked) {
      payAmountInput.value = 0;
      // Do not disable, allow manual entry
    } else {
      payAmountInput.value = outstanding;
    }
  });

  closeModalBtn.addEventListener('click', () => {
    paymentModal.style.display = 'none';
    paymentForm.reset();
  });

  // Handle Payment Submission
  paymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('savePaymentBtn');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    const studentDocId = document.getElementById('payStudentId').value;
    const isVacation = isVacationCheckbox.checked;
    const payAmount = parseFloat(document.getElementById('payAmount').value) || 0;
    const outstandingAmount = parseFloat(document.getElementById('payAmount').getAttribute('data-outstanding')) || 0;
    
    // If it's a vacation leave, any remaining balance after what they manually enter is waived
    const waivedAmount = isVacation ? Math.max(0, outstandingAmount - payAmount) : 0;
    
    const payMethod = document.getElementById('payMethod').value;
    const payRef = document.getElementById('payRef').value;
    const payDate = document.getElementById('payDate').value;
    const billingMonth = monthSelector.value;

    const student = currentStudents.find(s => s.id === studentDocId);
    const monthlyFee = student.monthlyFee || 0;
    
    try {
      const counterRef = doc(db, 'counters', 'receipts');
      
      await runTransaction(db, async (transaction) => {
        // 1. Generate Receipt Number
        const counterDoc = await transaction.get(counterRef);
        let newCount = 1;
        if (counterDoc.exists()) {
          newCount = (counterDoc.data().count || 0) + 1;
          transaction.update(counterRef, { count: newCount });
        } else {
          transaction.set(counterRef, { count: newCount });
        }
        
        const receiptNumber = `ABR-RCP-${newCount.toString().padStart(6, '0')}`;
        
        // 2. Create Payment Record
        const paymentRef = doc(collection(db, 'payments'));
        const paymentData = {
          receiptNumber: receiptNumber,
          studentId: studentDocId,
          billingMonth: billingMonth,
          expectedAmount: monthlyFee, 
          paidAmount: payAmount,
          waivedAmount: waivedAmount,
          isVacationLeave: isVacation,
          paymentMethod: isVacation ? 'Vacation Leave' : payMethod,
          paymentDate: payDate,
          referenceNumber: payRef,
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser ? auth.currentUser.uid : 'system'
        };
        transaction.set(paymentRef, paymentData);

        // 3. Create Income Transaction Record ONLY if actual money was paid
        if (payAmount > 0) {
          const transactionRef = doc(collection(db, 'transactions'));
          const transactionData = {
            date: payDate,
            type: 'income',
            category: 'Student Fee',
            description: `Fee payment for ${student.name} (${billingMonth})`,
            amount: payAmount,
            studentId: studentDocId,
            paymentId: paymentRef.id,
            referenceNumber: receiptNumber,
            createdBy: auth.currentUser ? auth.currentUser.uid : 'system',
            createdAt: serverTimestamp()
          };
          transaction.set(transactionRef, transactionData);
        }
      });

      if (isVacation) {
         toast.success('Vacation Leave recorded successfully! The balance for this month has been cleared.');
      } else {
         toast.success('Payment recorded successfully! Automatic Income transaction generated.');
      }
      
      paymentModal.style.display = 'none';
      paymentForm.reset();
      
      // Reload Data
      loadFeeData();

    } catch (error) {
      console.error("Payment error:", error);
      toast.error('Error recording payment: ' + error.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Confirm Payment';
    }
  });

  // Initial Load
  loadFeeData();
});
