import { toast } from './toast.js';
// js/edit-transaction.js
import { db, auth } from './firebase-config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('editTransactionForm');
  const submitBtn = document.getElementById('submitBtn');
  
  const urlParams = new URLSearchParams(window.location.search);
  const transactionId = urlParams.get('id');

  if (!transactionId) {
    toast.error("Transaction ID not found!");
    window.location.href = 'accounts.html';
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      loadTransactionData();
    }
  });

  async function loadTransactionData() {
    try {
      const docRef = doc(db, "transactions", transactionId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('type').value = data.type || 'income';
        document.getElementById('date').value = data.date || '';
        document.getElementById('category').value = data.category || '';
        document.getElementById('description').value = data.description || '';
        document.getElementById('amount').value = data.amount || 0;
        document.getElementById('paymentMethod').value = data.paymentMethod || 'Cash';
        document.getElementById('reference').value = data.referenceNumber || '';
      } else {
        toast.error("Transaction not found.");
        window.location.href = 'accounts.html';
      }
    } catch (error) {
      console.error("Error loading transaction:", error);
      toast.error("Error loading transaction.");
    }
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Updating...';

      try {
        const transactionRef = doc(db, 'transactions', transactionId);
        await updateDoc(transactionRef, {
          type: document.getElementById('type').value,
          date: document.getElementById('date').value,
          category: document.getElementById('category').value,
          description: document.getElementById('description').value,
          amount: parseFloat(document.getElementById('amount').value),
          paymentMethod: document.getElementById('paymentMethod').value,
          referenceNumber: document.getElementById('reference').value
        });
        
        toast.success('Transaction updated successfully!');
        window.location.href = 'accounts.html';
        
      } catch (error) {
        console.error("Error updating transaction: ", error);
        toast.error('Error updating transaction: ' + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Transaction';
      }
    });
  }
});
