import { toast } from './toast.js';
// js/accounts.js
import { db } from './firebase-config.js';
import { collection, getDocs, getDoc, query, where, orderBy, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('accountsTableBody');
  const typeFilter = document.getElementById('typeFilter');
  const monthFilter = document.getElementById('monthFilter');
  const searchInput = document.getElementById('searchInput');
  
  let allTransactions = [];

  // Default month filter to current month
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  monthFilter.value = currentMonth;

  const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
  const auth = getAuth();

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await loadTransactions();
    }
  });

  async function loadTransactions() {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Loading...</td></tr>';
    
    try {
      // Fetch all transactions without orderBy to prevent any index-related silent exclusions
      const q = query(collection(db, "transactions"));
      const snapshot = await getDocs(q);
      allTransactions = [];
      snapshot.forEach(doc => allTransactions.push({ id: doc.id, ...doc.data() }));
      
      // Sort completely in JS (Date descending, then createdAt descending)
      allTransactions.sort((a, b) => {
        const dateA = a.date || "";
        const dateB = b.date || "";
        if (dateA !== dateB) {
          return dateB.localeCompare(dateA); // Descending date
        }
        const tA = a.createdAt ? (typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : 0) : 0;
        const tB = b.createdAt ? (typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : 0) : 0;
        return tB - tA;
      });

      renderTable();
    } catch (error) {
      console.error("Error loading transactions:", error);
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--color-danger);">Error: ${error.message}</td></tr>`;
    }
  }

  function renderTable() {
    const typeTerm = typeFilter.value;
    const monthTerm = monthFilter.value; // YYYY-MM
    const searchTerm = searchInput.value.toLowerCase();
    
    let totalIncome = 0;
    let totalExpense = 0;
    let thisMonthIncome = 0;
    let thisMonthExpense = 0;

    const filtered = allTransactions.filter(t => {
      // Always calculate totals (Overall and for Current Month filter)
      const tAmount = t.amount || 0;
      if (t.type === 'income') {
        totalIncome += tAmount;
        if (t.date.startsWith(monthTerm)) thisMonthIncome += tAmount;
      } else {
        totalExpense += tAmount;
        if (t.date.startsWith(monthTerm)) thisMonthExpense += tAmount;
      }

      // Filtering logic for the table
      if (typeTerm && t.type !== typeTerm) return false;
      if (monthTerm && !t.date.startsWith(monthTerm)) return false;
      
      if (searchTerm) {
        const searchStr = `${t.category || ''} ${t.description || ''} ${t.referenceNumber || ''}`.toLowerCase();
        if (!searchStr.includes(searchTerm)) return false;
      }
      
      return true;
    });

    const rowsHtml = filtered.map(t => {
      const isIncome = t.type === 'income';
      const typeBadge = isIncome 
        ? `<span style="background: var(--color-sidebar-active); color: var(--color-success); padding: 0.25rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 500;">Income</span>`
        : `<span style="background: #FEF2F2; color: var(--color-danger); padding: 0.25rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 500;">Expense</span>`;
        
      const amountColor = isIncome ? 'var(--color-success)' : 'var(--color-danger)';
      const prefix = isIncome ? '+' : '-';

      return `
        <tr style="border-bottom: 1px solid var(--color-border);">
          <td style="padding: 0.75rem;">${t.date || '-'}</td>
          <td style="padding: 0.75rem;">${typeBadge}</td>
          <td style="padding: 0.75rem; font-weight: 500;">${t.category || '-'}</td>
          <td style="padding: 0.75rem;">${t.description || '-'}</td>
          <td style="padding: 0.75rem; font-family: monospace; color: var(--color-text-secondary);">${t.referenceNumber || '-'}</td>
          <td style="padding: 0.75rem; font-weight: 600; text-align: right; color: ${amountColor};">
            ${prefix}${formatter.format(t.amount || 0)}
          </td>
          <td style="padding: 0.75rem; text-align: right;">
            <a href="edit-transaction.html?id=${t.id}" style="color: var(--color-text-secondary); margin-right: 0.5rem;" title="Edit"><i data-lucide="edit" style="width: 16px; height: 16px;"></i></a>
            <button class="delete-btn" data-id="${t.id}" style="background: none; border: none; color: var(--color-danger); cursor: pointer;" title="Delete">
              <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml || '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No matching transactions found.</td></tr>';
    
    // Update Stats
    document.getElementById('statTotalIncome').textContent = formatter.format(totalIncome);
    document.getElementById('statTotalExpense').textContent = formatter.format(totalExpense);
    document.getElementById('statCurrentBalance').textContent = formatter.format(totalIncome - totalExpense);
    
    const monthSurplus = thisMonthIncome - thisMonthExpense;
    const surplusEl = document.getElementById('statMonthSurplus');
    surplusEl.textContent = formatter.format(monthSurplus);
    surplusEl.style.color = monthSurplus >= 0 ? 'var(--color-success)' : 'var(--color-danger)';

    lucide.createIcons();
    attachDeleteListeners();
  }

  function attachDeleteListeners() {
    const deleteBtns = document.querySelectorAll('.delete-btn');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (confirm('Are you sure you want to delete this transaction? This will permanently remove it and synchronize across all pages.')) {
          try {
            const txRef = doc(db, "transactions", id);
            const txSnap = await getDoc(txRef);
            const txData = txSnap.exists() ? txSnap.data() : null;
            
            if (txData) {
              // 1. Delete linked salary payment by direct salaryPaymentId
              if (txData.salaryPaymentId) {
                try {
                  await deleteDoc(doc(db, "salaryPayments", txData.salaryPaymentId));
                } catch (spErr) {
                  console.warn("Could not delete salaryPayment by salaryPaymentId:", spErr);
                }
              }

              // 2. Delete any salary payment linking to this transaction by transactionId
              try {
                const spTxQ = query(collection(db, "salaryPayments"), where("transactionId", "==", id));
                const spTxSnap = await getDocs(spTxQ);
                for (const spDoc of spTxSnap.docs) {
                  await deleteDoc(doc(db, "salaryPayments", spDoc.id));
                }
              } catch (spTxErr) {
                console.warn("Could not query salaryPayments by transactionId:", spTxErr);
              }

              // 3. Fallback for salary payments: match by tutorId and amount/date
              if (txData.category === 'Tutor Salary' || txData.tutorId) {
                try {
                  const fallbackQ = txData.tutorId 
                    ? query(collection(db, "salaryPayments"), where("tutorId", "==", txData.tutorId))
                    : query(collection(db, "salaryPayments"));
                  const fbSnap = await getDocs(fallbackQ);
                  for (const fbDoc of fbSnap.docs) {
                    const fb = fbDoc.data();
                    const amountMatch = (fb.paidAmount === txData.amount || fb.finalAmount === txData.amount);
                    const dateMatch = (fb.paymentDate === txData.date || (fb.month && txData.description && txData.description.includes(fb.month)));
                    if (amountMatch && (dateMatch || !txData.date)) {
                      await deleteDoc(doc(db, "salaryPayments", fbDoc.id));
                    }
                  }
                } catch (fbErr) {
                  console.warn("Could not clean up salaryPayments fallback:", fbErr);
                }
              }

              // 4. Delete linked student fee payment by direct paymentId
              if (txData.paymentId) {
                try {
                  await deleteDoc(doc(db, "payments", txData.paymentId));
                } catch (pErr) {
                  console.warn("Could not delete payment by paymentId:", pErr);
                }
              }

              // 5. Delete any student payment linking to this transaction by transactionId
              try {
                const pTxQ = query(collection(db, "payments"), where("transactionId", "==", id));
                const pTxSnap = await getDocs(pTxQ);
                for (const pDoc of pTxSnap.docs) {
                  await deleteDoc(doc(db, "payments", pDoc.id));
                }
              } catch (pTxErr) {
                console.warn("Could not query payments by transactionId:", pTxErr);
              }

              // 6. Fallback for student payments by receiptNumber / referenceNumber
              if (txData.referenceNumber) {
                try {
                  const rQ = query(collection(db, "payments"), where("receiptNumber", "==", txData.referenceNumber));
                  const rSnap = await getDocs(rQ);
                  for (const rDoc of rSnap.docs) {
                    await deleteDoc(doc(db, "payments", rDoc.id));
                  }
                } catch (rErr) {
                  console.warn("Could not clean up payments by referenceNumber:", rErr);
                }
              }
            }
            
            await deleteDoc(txRef);
            toast.success('Transaction and associated records deleted successfully from all pages.');
            loadTransactions();
          } catch (error) {
            console.error("Error deleting transaction:", error);
            toast.error("Error deleting transaction: " + error.message);
          }
        }
      });
    });
  }

  // Event Listeners
  typeFilter.addEventListener('change', renderTable);
  monthFilter.addEventListener('change', renderTable);
  searchInput.addEventListener('input', renderTable);

  // Load Data
  loadTransactions();
});
