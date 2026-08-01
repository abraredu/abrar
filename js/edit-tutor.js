import { toast } from './toast.js';
// js/edit-tutor.js
import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const tutorId = urlParams.get('id');

  if (!tutorId) {
    toast.success("No tutor ID provided.");
    window.location.href = 'tutors.html';
    return;
  }

  const form = document.getElementById('editTutorForm');
  const submitBtn = document.getElementById('submitBtn');
  const deleteBtn = document.getElementById('deleteBtn');
  const cancelBtn = document.getElementById('cancelBtn');

  // Load tutor data
  try {
    const docRef = doc(db, "tutors", tutorId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      
      document.getElementById('name').value = data.name || '';
      document.getElementById('phone').value = data.phone || '';
      document.getElementById('whatsapp').value = data.whatsapp || '';
      document.getElementById('email').value = data.email || '';
      document.getElementById('address').value = data.address || '';
      if (data.tutorType) {
        const types = Array.isArray(data.tutorType) ? data.tutorType : [data.tutorType];
        const tutorTypeCheckboxes = document.querySelectorAll('.tutor-type-checkbox');
        Array.from(tutorTypeCheckboxes).forEach(cb => {
          if (types.includes(cb.value)) {
            cb.checked = true;
          }
        });
      }
      document.getElementById('joiningDate').value = data.joiningDate || '';
      if (document.getElementById('loginUsername')) document.getElementById('loginUsername').value = data.loginUsername || '';
      if (document.getElementById('loginPassword')) document.getElementById('loginPassword').value = data.loginPassword || '';
      document.getElementById('status').value = data.status || 'active';

      document.getElementById('pageTitle').textContent = `Edit Tutor: ${data.name}`;
      cancelBtn.href = `tutor-view.html?id=${tutorId}`;
    } else {
      toast.error("Tutor not found.");
      window.location.href = 'tutors.html';
    }
  } catch (error) {
    console.error("Error fetching tutor:", error);
    toast.error("Error loading tutor data.");
  }

  // Handle Form Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const tutorTypeCheckboxes = document.querySelectorAll('.tutor-type-checkbox:checked');
    const tutorType = Array.from(tutorTypeCheckboxes).map(cb => cb.value);
    
    if (tutorType.length === 0) {
      toast.success('Please select at least one Tutor Type.');
      return;
    }
    
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Updating...';

    try {
      const tutorRef = doc(db, 'tutors', tutorId);
      const updatedData = {
        name: document.getElementById('name').value,
        phone: document.getElementById('phone').value,
        whatsapp: document.getElementById('whatsapp').value,
        email: document.getElementById('email').value,
        address: document.getElementById('address').value,
        tutorType: tutorType,
        joiningDate: document.getElementById('joiningDate').value,
        loginUsername: document.getElementById('loginUsername') ? document.getElementById('loginUsername').value : '',
        loginPassword: document.getElementById('loginPassword') ? document.getElementById('loginPassword').value : '',
        status: document.getElementById('status').value,
        updatedAt: serverTimestamp()
      };

      await updateDoc(tutorRef, updatedData);
      toast.success("Tutor updated successfully!");
      window.location.href = `tutor-view.html?id=${tutorId}`;
    } catch (error) {
      console.error("Error updating tutor: ", error);
      toast.error('Error updating tutor: ' + error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });

  // Handle Delete
  deleteBtn.addEventListener('click', async () => {
    if (confirm("Are you sure you want to completely delete this tutor record? This action cannot be undone. Consider changing the status to 'Inactive' instead if they have salary history.")) {
      try {
        deleteBtn.disabled = true;
        deleteBtn.textContent = 'Deleting...';
        await deleteDoc(doc(db, "tutors", tutorId));
        toast.success("Tutor deleted successfully.");
        window.location.href = 'tutors.html';
      } catch (error) {
        console.error("Error deleting tutor:", error);
        toast.error("Error deleting tutor: " + error.message);
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete Tutor';
      }
    }
  });
});
