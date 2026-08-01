import { toast } from './toast.js';
// js/add-student.js
import { db, auth } from './firebase-config.js';
import { collection, doc, runTransaction, serverTimestamp, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { uploadToCloudinary } from './cloudinary-config.js';

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('addStudentForm');
  const submitBtn = document.getElementById('submitBtn');
  const courseTypeSelect = document.getElementById('courseType');
  const tutorSelect = document.getElementById('tutorId');
  const classGroup = document.getElementById('classGroup');
  const classIdSelect = document.getElementById('classId');
  const levelGroup = document.getElementById('levelGroup');
  const levelInput = document.getElementById('level');

  if (!form) return;

  // Fetch all active tutors once to use for filtering
  let allActiveTutors = [];
  let allActiveClasses = [];

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const tutorsQ = query(collection(db, "tutors"), where("status", "==", "active"));
        const snapshot = await getDocs(tutorsQ);
        snapshot.forEach(doc => allActiveTutors.push({ id: doc.id, ...doc.data() }));

        const classesQ = query(collection(db, "classes"), where("status", "==", "active"));
        const classSnapshot = await getDocs(classesQ);
        classSnapshot.forEach(doc => allActiveClasses.push({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    }
  });

  // Handle courseType change
  courseTypeSelect.addEventListener('change', (e) => {
    const selectedCourse = e.target.value;

    // Toggle UI elements
    if (selectedCourse === 'madrasa_group') {
      if (classGroup) classGroup.style.display = 'block';
      if (classIdSelect) classIdSelect.required = true;
      if (levelGroup) levelGroup.style.display = 'none';
      if (levelInput) levelInput.required = false;

      classIdSelect.innerHTML = '<option value="">Select Class</option>';
      allActiveClasses.forEach(cls => {
        const option = document.createElement('option');
        option.value = cls.id;
        option.textContent = cls.className;
        classIdSelect.appendChild(option);
      });
    } else if (selectedCourse === 'madrasa_one_to_one' || selectedCourse === 'quran_one_to_one') {
      if (classGroup) classGroup.style.display = 'none';
      if (classIdSelect) classIdSelect.required = false;
      if (levelGroup) levelGroup.style.display = 'block';
    } else {
      if (classGroup) classGroup.style.display = 'none';
      if (classIdSelect) classIdSelect.required = false;
      if (levelGroup) levelGroup.style.display = 'none';
    }

    // Map student course type to tutor type
    let targetTutorType = '';
    if (selectedCourse === 'madrasa_one_to_one') targetTutorType = 'madrasa_individual';
    else if (selectedCourse === 'madrasa_group') targetTutorType = 'madrasa_group';
    else if (selectedCourse === 'quran_one_to_one') targetTutorType = 'quran_recitation';

    // Clear and populate tutor dropdown
    tutorSelect.innerHTML = '<option value="">Select Tutor</option>';

    if (targetTutorType) {
      const matchingTutors = allActiveTutors.filter(t => t.tutorType === targetTutorType);
      matchingTutors.forEach(tutor => {
        const option = document.createElement('option');
        option.value = tutor.id;
        option.textContent = `${tutor.name} (${tutor.tutorId})`;
        tutorSelect.appendChild(option);
      });
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Saving...';

    const courseType = document.getElementById('courseType').value;

    // Determine prefix based on courseType
    let prefix = 'ABR';
    if (courseType === 'madrasa_one_to_one') prefix = 'ABRMO';
    else if (courseType === 'madrasa_group') prefix = 'ABRMG';
    else if (courseType === 'quran_one_to_one') prefix = 'ABRQR';

    try {
      // 1. Generate ID and create student document within a transaction to ensure uniqueness
      submitBtn.textContent = 'Uploading files (if any)...';

      let photoUrl = null;
      let idDocumentUrl = null;

      const photoFile = document.getElementById('photo').files[0];
      const idDocFile = document.getElementById('idDocument').files[0];

      if (photoFile) {
        photoUrl = await uploadToCloudinary(photoFile);
      }
      if (idDocFile) {
        idDocumentUrl = await uploadToCloudinary(idDocFile);
      }

      submitBtn.textContent = 'Saving Record...';

      const counterRef = doc(db, 'counters', 'students');

      const newStudentId = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);

        let newCount = 1;
        if (counterDoc.exists()) {
          const data = counterDoc.data();
          newCount = (data[prefix] || 0) + 1;
          transaction.update(counterRef, { [prefix]: newCount });
        } else {
          transaction.set(counterRef, { [prefix]: newCount });
        }

        // Format ID with leading zeros, e.g., ABRMO001
        const formattedId = `${prefix}${newCount.toString().padStart(3, '0')}`;

        // 2. Prepare student data
        const studentRef = doc(collection(db, 'students'));
        const studentData = {
          studentId: formattedId,
          name: document.getElementById('name').value,
          parentName: document.getElementById('parentName').value,
          phone: document.getElementById('phone').value,
          whatsapp: document.getElementById('whatsapp').value,
          place: document.getElementById('place').value,
          courseType: courseType,
          tutorId: document.getElementById('tutorId').value,
          classId: document.getElementById('classId') ? document.getElementById('classId').value : '',
          level: (courseType === 'madrasa_one_to_one' || courseType === 'quran_one_to_one') ? (document.getElementById('level') ? document.getElementById('level').value : '') : '',
          admissionDate: document.getElementById('admissionDate').value,
          classStartingDate: document.getElementById('classStartingDate') ? document.getElementById('classStartingDate').value : '',
          monthlyFee: parseFloat(document.getElementById('monthlyFee').value),
          status: 'active',
          photoUrl: photoUrl,
          idDocumentUrl: idDocumentUrl,
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser ? auth.currentUser.uid : 'system'
        };

        transaction.set(studentRef, studentData);
        return formattedId;
      });

      toast.success(`Student saved successfully! ID: ${newStudentId}`);
      window.location.href = 'students.html';

    } catch (error) {
      console.error("Error adding student: ", error);
      toast.error('Error saving student: ' + error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
});
