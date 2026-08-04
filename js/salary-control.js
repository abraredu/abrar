import { toast } from './toast.js';
// js/salary-control.js
import { db, auth } from './firebase-config.js';
import { collection, getDocs, query, where, doc, setDoc, deleteDoc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
  const monthSelector = document.getElementById('monthSelector');
  const tutorSelector = document.getElementById('tutorSelector');
  const tutorRolesContainer = document.getElementById('tutorRolesContainer');
  const selectedTutorNameDisplay = document.getElementById('selectedTutorNameDisplay');
  const tabsNav = document.getElementById('tabsNav');
  const tabsContent = document.getElementById('tabsContent');
  const savedEntriesTableBody = document.getElementById('savedEntriesTableBody');
  const currentMonthDisplay = document.getElementById('currentMonthDisplay');

  // Modal Elements
  const salaryModal = document.getElementById('salaryModal');
  const salaryForm = document.getElementById('salaryForm');
  const closeModalBtn = document.getElementById('closeSalaryModalBtn');
  const payAdjustmentInput = document.getElementById('payAdjustment');
  const payFinalAmountDisplay = document.getElementById('payFinalAmount');

  // Initialize Month Selector
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  monthSelector.value = currentMonth;
  currentMonthDisplay.textContent = currentMonth;

  let allTutors = [];
  let savedConfigurations = [];
  let currentPayEntry = null; // Holds the entry we are currently paying
  
  const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

  const TUTOR_TYPE_LABELS = {
    'madrasa_group': 'Madrasa (Group)',
    'madrasa_individual': 'Madrasa (One-to-One)',
    'quran_recitation': 'Quran Recitation',
    'hifz': 'Hifz'
  };

  async function loadInitialData() {
    try {
      const tutorsQ = query(collection(db, "tutors"), where("status", "==", "active"));
      const tutorsSnap = await getDocs(tutorsQ);
      allTutors = [];
      let optionsHtml = '<option value="">-- Select a Tutor --</option>';
      tutorsSnap.forEach(docSnap => {
        const t = { id: docSnap.id, ...docSnap.data() };
        allTutors.push(t);
        optionsHtml += `<option value="${t.id}">${t.name} (${t.tutorId})</option>`;
      });
      tutorSelector.innerHTML = optionsHtml;

      loadSavedEntries();
    } catch (error) {
      console.error("Error loading initial data:", error);
      toast.error("Error loading tutors: " + error.message);
    }
  }

  async function loadSavedEntries() {
    const selectedMonth = monthSelector.value;
    currentMonthDisplay.textContent = selectedMonth;
    savedEntriesTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading...</td></tr>';
    
    try {
      const q = query(collection(db, "tutorRoleSalaries"), where("month", "==", selectedMonth));
      const snap = await getDocs(q);

      const paymentsQ = query(collection(db, "salaryPayments"), where("month", "==", selectedMonth));
      const paymentsSnap = await getDocs(paymentsQ);
      
      const paidEntries = new Set();
      paymentsSnap.forEach(docSnap => {
        paidEntries.add(docSnap.data().salaryEntryId);
      });

      savedConfigurations = [];
      snap.forEach(docSnap => {
        if (!paidEntries.has(docSnap.id)) {
          savedConfigurations.push({ id: docSnap.id, ...docSnap.data() });
        }
      });
      renderSavedEntries();
    } catch (error) {
      console.error("Error loading entries:", error);
      savedEntriesTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--color-danger);">Error: ${error.message}</td></tr>`;
    }
  }

  function formatTutorType(typeValue) {
    return TUTOR_TYPE_LABELS[typeValue] || typeValue;
  }

  function renderSavedEntries() {
    if (savedConfigurations.length === 0) {
      savedEntriesTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No saved entries for this month.</td></tr>';
      return;
    }

    const rowsHtml = savedConfigurations.map(entry => {
      const tutor = allTutors.find(t => t.id === entry.tutorId);
      const tutorName = tutor ? tutor.name : 'Unknown';
      
      let typeLabel = "Fixed Monthly";
      if (entry.salaryType === 'per_class') typeLabel = "Per Class";
      else if (entry.salaryType === 'per_student') typeLabel = "Per Student";

      return `
        <tr style="border-bottom: 1px solid var(--color-border);">
          <td style="padding: 0.75rem; font-weight: 500;">${tutorName}</td>
          <td style="padding: 0.75rem;">${formatTutorType(entry.tutorRole)}</td>
          <td style="padding: 0.75rem;">${typeLabel}</td>
          <td style="padding: 0.75rem; font-weight: 600; color: var(--color-primary);">₹${entry.rate}</td>
          <td style="padding: 0.75rem;">${entry.date || '-'}</td>
          <td style="padding: 0.75rem; display: flex; gap: 0.5rem;">
            <button class="btn btn-primary pay-btn" data-entry-id="${entry.id}" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;">Pay</button>
            <button class="btn delete-btn" data-entry-id="${entry.id}" style="font-size: 0.75rem; padding: 0.25rem 0.5rem; background: #FEF2F2; color: var(--color-danger); border: 1px solid #FECACA;">Delete</button>
          </td>
        </tr>
      `;
    }).join('');

    savedEntriesTableBody.innerHTML = rowsHtml;

    document.querySelectorAll('.pay-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const entryId = e.target.getAttribute('data-entry-id');
        handlePayClick(entryId, e.target);
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const entryId = e.target.getAttribute('data-entry-id');
        if (confirm('Are you sure you want to delete this salary configuration?')) {
          e.target.disabled = true;
          e.target.textContent = '...';
          try {
            await deleteDoc(doc(db, "tutorRoleSalaries", entryId));
            await loadSavedEntries();
          } catch (err) {
            console.error(err);
            toast.error("Error deleting entry: " + err.message);
            e.target.disabled = false;
            e.target.textContent = 'Delete';
          }
        }
      });
    });
  }

  monthSelector.addEventListener('change', () => {
    loadSavedEntries();
    if (tutorSelector.value) {
      renderTutorTabs(tutorSelector.value); // Re-render tabs for the new month
    }
  });

  tutorSelector.addEventListener('change', (e) => {
    const tutorId = e.target.value;
    if (!tutorId) {
      tutorRolesContainer.style.display = 'none';
      return;
    }
    renderTutorTabs(tutorId);
  });

  function renderTutorTabs(tutorId) {
    const tutor = allTutors.find(t => t.id === tutorId);
    if (!tutor) return;

    selectedTutorNameDisplay.textContent = `Configure Roles: ${tutor.name}`;
    const roles = tutor.tutorType || [];
    
    if (roles.length === 0) {
      tabsNav.innerHTML = '';
      tabsContent.innerHTML = '<p>This tutor has no assigned roles.</p>';
      tutorRolesContainer.style.display = 'block';
      return;
    }

    let navHtml = '';
    let contentHtml = '';

    roles.forEach((role, index) => {
      const activeClass = index === 0 ? 'active' : '';
      const displayStyle = index === 0 ? 'block' : 'none';
      const roleLabel = formatTutorType(role);
      
      // Look for existing saved config for this month, tutor, and role
      const docId = `${monthSelector.value}_${tutor.id}_${role}`;
      const savedConfig = savedConfigurations.find(c => c.id === docId);
      
      const sType = savedConfig ? savedConfig.salaryType : '';
      const sRate = savedConfig ? savedConfig.rate : '';
      const sDate = savedConfig && savedConfig.date ? savedConfig.date : now.toISOString().split('T')[0];

      navHtml += `
        <button class="tab-btn ${activeClass}" data-target="tab-${role}" style="padding: 0.5rem 1rem; border: none; background: ${index === 0 ? 'var(--color-primary)' : 'var(--color-background)'}; color: ${index === 0 ? 'white' : 'var(--color-text)'}; border-radius: var(--radius-sm); cursor: pointer; white-space: nowrap;">
          ${roleLabel}
        </button>
      `;

      contentHtml += `
        <div id="tab-${role}" class="tab-pane" style="display: ${displayStyle}; padding: 1rem; background: var(--color-background); border-radius: var(--radius-md);">
          <form class="role-config-form" data-role="${role}" data-tutor="${tutor.id}">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Salary Type *</label>
                <select class="form-control role-salary-type" required>
                  <option value="">Select Type</option>
                  <option value="per_class" ${sType === 'per_class' ? 'selected' : ''}>Per Class</option>
                  <option value="per_student" ${sType === 'per_student' ? 'selected' : ''}>Per Student</option>
                  <option value="fixed_monthly" ${sType === 'fixed_monthly' ? 'selected' : ''}>Fixed Monthly</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Amount (₹) *</label>
                <input type="number" class="form-control role-rate" required min="0" step="0.01" value="${sRate}">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Date</label>
                <input type="date" class="form-control role-date" required value="${sDate}">
              </div>
            </div>
            <button type="submit" class="btn btn-primary">Save Configuration for ${roleLabel}</button>
            <span class="save-msg" style="margin-left: 1rem; color: var(--color-success); font-size: 0.875rem;"></span>
          </form>
        </div>
      `;
    });

    tabsNav.innerHTML = navHtml;
    tabsContent.innerHTML = contentHtml;
    tutorRolesContainer.style.display = 'block';

    // Toggle Logic
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = e.target.getAttribute('data-target');
        const contentDiv = document.getElementById(targetId);
        
        // Check if currently active (by checking background color)
        const isActive = e.target.style.background === 'var(--color-primary)';
        
        if (isActive) {
          // Deactivate
          e.target.style.background = 'var(--color-background)';
          e.target.style.color = 'var(--color-text)';
          contentDiv.style.display = 'none';
        } else {
          // Activate
          e.target.style.background = 'var(--color-primary)';
          e.target.style.color = 'white';
          contentDiv.style.display = 'block';
        }
      });
    });

    // Handle Save Form Submission
    document.querySelectorAll('.role-config-form').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const role = form.getAttribute('data-role');
        const tutorId = form.getAttribute('data-tutor');
        const month = monthSelector.value;
        const sType = form.querySelector('.role-salary-type').value;
        const rate = parseFloat(form.querySelector('.role-rate').value) || 0;
        const dateStr = form.querySelector('.role-date').value;
        const msgSpan = form.querySelector('.save-msg');

        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Saving...';

        try {
          const docId = `${month}_${tutorId}_${role}`;
          const ref = doc(db, "tutorRoleSalaries", docId);
          
          const payload = {
            tutorId,
            tutorRole: role,
            month,
            salaryType: sType,
            rate,
            date: dateStr,
            updatedAt: serverTimestamp()
          };

          await setDoc(ref, payload);
          
          msgSpan.textContent = 'Saved successfully!';
          setTimeout(() => { msgSpan.textContent = ''; }, 3000);
          
          // Reload entries to update table
          await loadSavedEntries();
        } catch (err) {
          console.error("Save error", err);
          msgSpan.textContent = 'Error: ' + err.message;
          msgSpan.style.color = 'var(--color-danger)';
        } finally {
          btn.disabled = false;
          btn.textContent = `Save Configuration for ${formatTutorType(role)}`;
        }
      });
    });
  }

  // --- PAYMENT MODAL LOGIC ---

  async function handlePayClick(entryId, btnElement) {
    const entry = savedConfigurations.find(c => c.id === entryId);
    if (!entry) return;

    btnElement.disabled = true;
    btnElement.textContent = "Calc...";

    try {
      const tutor = allTutors.find(t => t.id === entry.tutorId);
      // The user wants the amount to come directly from what they entered (the table),
      // so we use entry.rate unconditionally.
      let calcAmount = entry.rate;

      // Check how much is already paid for THIS entry (tutor + role + month)
      const paymentsQ = query(collection(db, "salaryPayments"), where("salaryEntryId", "==", entry.id));
      const paymentsSnap = await getDocs(paymentsQ);
      let alreadyPaid = 0;
      paymentsSnap.forEach(p => {
         alreadyPaid += (p.data().paidAmount || 0);
      });

      currentPayEntry = {
        ...entry,
        tutorName: tutor.name,
        tutorDisplayId: tutor.tutorId,
        calcAmount,
        alreadyPaid
      };

      openSalaryModal();
    } catch (err) {
      console.error(err);
      toast.error("Error calculating payment: " + err.message);
    } finally {
      btnElement.disabled = false;
      btnElement.textContent = "Pay";
    }
  }

  const amountInput = document.getElementById('payAmount');

  function updateFinalAmount(fromPayAmount = false) {
    if (!currentPayEntry) return;
    let adjustment = parseFloat(payAdjustmentInput.value) || 0;
    
    if (fromPayAmount) {
      const payAmount = parseFloat(amountInput.value) || 0;
      adjustment = (payAmount + currentPayEntry.alreadyPaid) - currentPayEntry.calcAmount;
      payAdjustmentInput.value = adjustment;
    }
    
    const finalAmount = currentPayEntry.calcAmount + adjustment;
    const balance = finalAmount - currentPayEntry.alreadyPaid;
    
    payFinalAmountDisplay.textContent = formatter.format(finalAmount);
    if (!fromPayAmount) {
      amountInput.value = Math.max(0, balance) || '';
    }
  }

  payAdjustmentInput.addEventListener('input', () => updateFinalAmount(false));
  if (amountInput) {
    amountInput.addEventListener('input', () => updateFinalAmount(true));
  }

  function openSalaryModal() {
    document.getElementById('payTutorId').value = currentPayEntry.tutorId;
    document.getElementById('payTutorName').textContent = `${currentPayEntry.tutorName} (${formatTutorType(currentPayEntry.tutorRole)})`;
    document.getElementById('payTutorIdDisplay').textContent = currentPayEntry.tutorDisplayId;
    document.getElementById('payCalculated').textContent = formatter.format(currentPayEntry.calcAmount);
    
    document.getElementById('payAdjustment').value = 0;
    document.getElementById('payDateModal').value = currentPayEntry.date || new Date().toISOString().split('T')[0];
    if (amountInput) {
      amountInput.removeAttribute('max');
    }
    
    updateFinalAmount(false);
    salaryModal.style.display = 'flex';
  }

  closeModalBtn.addEventListener('click', () => {
    salaryModal.style.display = 'none';
    salaryForm.reset();
    currentPayEntry = null;
  });

  salaryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveSalaryBtn');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    const payAmount = parseFloat(document.getElementById('payAmount').value);
    const adjustment = parseFloat(document.getElementById('payAdjustment').value) || 0;
    const payMethod = document.getElementById('payMethod').value;
    const payDate = document.getElementById('payDateModal').value;
    
    const finalAmount = currentPayEntry.calcAmount + adjustment;

    try {
      await runTransaction(db, async (transaction) => {
        const salaryPaymentRef = doc(collection(db, 'salaryPayments'));
        const salaryData = {
          tutorId: currentPayEntry.tutorId || '',
          tutorRole: currentPayEntry.tutorRole || '',
          salaryEntryId: currentPayEntry.id || '', // Link to the specific role configuration
          month: currentPayEntry.month || '',
          salaryType: currentPayEntry.salaryType || 'unspecified',
          rate: currentPayEntry.rate !== undefined ? currentPayEntry.rate : 0,
          calculatedAmount: currentPayEntry.calcAmount || 0,
          adjustment: adjustment || 0,
          finalAmount: finalAmount || 0,
          paidAmount: payAmount || 0,
          paymentMethod: payMethod || 'UPI',
          paymentDate: payDate || '',
          status: 'paid',
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser ? auth.currentUser.uid : 'system'
        };
        transaction.set(salaryPaymentRef, salaryData);

        const transactionRef = doc(collection(db, 'transactions'));
        const transactionData = {
          date: payDate,
          type: 'expense',
          category: 'Tutor Salary',
          description: `Salary for ${currentPayEntry.tutorName} - ${formatTutorType(currentPayEntry.tutorRole)} (${currentPayEntry.month})`,
          amount: payAmount,
          tutorId: currentPayEntry.tutorId,
          salaryPaymentId: salaryPaymentRef.id,
          createdBy: auth.currentUser ? auth.currentUser.uid : 'system',
          createdAt: serverTimestamp()
        };
        transaction.set(transactionRef, transactionData);
      });

      toast.success('Payment recorded successfully!');
      salaryModal.style.display = 'none';
      salaryForm.reset();
      currentPayEntry = null;
      await loadSavedEntries();
    } catch (error) {
      console.error("Error processing payment: ", error);
      toast.error('Error processing payment: ' + error.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Confirm Payment';
    }
  });

  loadInitialData();
});
