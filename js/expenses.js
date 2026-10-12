import { toast } from './toast.js';
// js/expenses.js
import { db, auth } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('expenseForm');
  const submitBtn = document.getElementById('submitBtn');

  // Default to today
  document.getElementById('date').value = new Date().toISOString().split('T')[0];

  // Auto-generate reference number
  const refInput = document.getElementById('reference');
  if (refInput && !refInput.value) {
    refInput.value = 'EXP-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);
  }

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      const transactionData = {
        date: document.getElementById('date').value,
        type: 'expense',
        category: 'Uncategorized',
        description: document.getElementById('description').value,
        amount: parseFloat(document.getElementById('amount').value),
        paymentMethod: document.getElementById('paymentMethod').value,
        referenceNumber: document.getElementById('reference').value,
        createdBy: auth.currentUser ? auth.currentUser.uid : 'system',
        createdAt: serverTimestamp(),
        isManual: true
      };

      await addDoc(collection(db, 'transactions'), transactionData);
      
      toast.success('Manual expense recorded successfully!');
      window.location.href = 'accounts.html';
      
    } catch (error) {
      console.error("Error saving expense: ", error);
      toast.error('Error saving expense: ' + error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Expense';
    }
  });
});
