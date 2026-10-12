import { toast } from './toast.js';
// js/edit-tutor.js
import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { loadManagedCourses, renderTutorTypeCheckboxes, valueMatchesCourse, legacyLabel } from './course-types.js';

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
      // Render Tutor Type checkboxes from Manage Courses and pre-check saved values
      let allCourses = [];
      try {
        allCourses = await loadManagedCourses();
      } catch (err) {
        console.error('Error loading courses:', err);
      }
      const savedTypes = data.tutorType ? (Array.isArray(data.tutorType) ? data.tutorType : [data.tutorType]) : [];
      // Map each saved value to a course name (direct match, or old key -> label match)
      const toCheck = [];
      const unmatched = [];
      savedTypes.forEach(t => {
        const course = allCourses.find(c => valueMatchesCourse(t, c) || valueMatchesCourse(legacyLabel(t), c));
        if (course) toCheck.push(course.courseName);
        else { unmatched.push(t); toCheck.push(t); }
      });
      renderTutorTypeCheckboxes(document.getElementById('tutorTypeCheckboxes'), allCourses, unmatched);
      document.querySelectorAll('.tutor-type-checkbox').forEach(cb => {
        if (toCheck.includes(cb.value)) cb.checked = true;
      });
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
        loginUsername: (document.getElementById('loginUsername') && document.getElementById('loginUsername').value.trim()) ? document.getElementById('loginUsername').value.trim() : 'AGM',
        loginPassword: (document.getElementById('loginPassword') && document.getElementById('loginPassword').value) ? document.getElementById('loginPassword').value : document.getElementById('phone').value,
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
