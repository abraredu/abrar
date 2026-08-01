import { toast } from './toast.js';
// js/edit-student.js
import { db, auth } from './firebase-config.js';
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp, collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const studentId = urlParams.get('id');

  if (!studentId) {
    toast.success("No student ID provided.");
    window.location.href = 'students.html';
    return;
  }

  const form = document.getElementById('editStudentForm');
  const submitBtn = document.getElementById('submitBtn');
  const deleteBtn = document.getElementById('deleteBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const courseTypeSelect = document.getElementById('courseType');
  const tutorSelect = document.getElementById('tutorId');
  const classGroup = document.getElementById('classGroup');
  const classSelect = document.getElementById('classId');

  let allActiveTutors = [];
  let allActiveClasses = [];

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        // Fetch active tutors
        const tutorsQ = query(collection(db, "tutors"), where("status", "==", "active"));
        const snapshot = await getDocs(tutorsQ);
        snapshot.forEach(doc => allActiveTutors.push({ id: doc.id, ...doc.data() }));

        // Fetch active group classes
        const classesQ = query(collection(db, "classes"), where("status", "==", "active"), orderBy("createdAt", "desc"));
        const classesSnap = await getDocs(classesQ);
        if (classSelect) {
          classSelect.innerHTML = '<option value="">Select Class</option>';
          classesSnap.forEach(docSnap => {
            const data = docSnap.data();
            allActiveClasses.push({ id: docSnap.id, ...data });
            const option = document.createElement('option');
            option.value = docSnap.id;
            option.textContent = `${data.className} (Level: ${data.level})`;
            classSelect.appendChild(option);
          });
        }

      } catch (err) {
        console.error("Error fetching dependencies:", err);
      }
      loadStudentData();
    }
  });

  function populateTutorDropdown(selectedCourse, preselectedTutorId = null) {
    let targetTutorType = '';
    if (selectedCourse === 'madrasa_one_to_one') targetTutorType = 'madrasa_individual';
    else if (selectedCourse === 'madrasa_group') targetTutorType = 'madrasa_group';
    else if (selectedCourse === 'quran_one_to_one') targetTutorType = 'quran_recitation';

    tutorSelect.innerHTML = '<option value="">Select Tutor</option>';

    if (targetTutorType) {
      const matchingTutors = allActiveTutors.filter(t => t.tutorType === targetTutorType);
      matchingTutors.forEach(tutor => {
        const option = document.createElement('option');
        option.value = tutor.id;
        option.textContent = `${tutor.name} (${tutor.tutorId})`;
        if (tutor.id === preselectedTutorId) option.selected = true;
        tutorSelect.appendChild(option);
      });
    }
  }

  // Handle courseType change
  courseTypeSelect.addEventListener('change', (e) => {
    const selectedCourse = e.target.value;
    const classGroup = document.getElementById('classGroup');
    const classIdSelect = document.getElementById('classId');
    const levelGroup = document.getElementById('levelGroup');
    const levelInput = document.getElementById('level');

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

    populateTutorDropdown(selectedCourse);
  });

  async function loadStudentData() {
    try {
      const docRef = doc(db, "students", studentId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        document.getElementById('name').value = data.name || '';
        document.getElementById('parentName').value = data.parentName || '';
        document.getElementById('phone').value = data.phone || '';
        document.getElementById('whatsapp').value = data.whatsapp || '';
        document.getElementById('place').value = data.place || '';

        document.getElementById('courseType').value = data.courseType || '';
        populateTutorDropdown(data.courseType || '', data.tutorId);

        if (data.courseType === 'madrasa_group') {
          classGroup.style.display = 'block';
          if (classSelect) {
            classSelect.required = true;
            classSelect.value = data.classId || '';
          }
        }

        document.getElementById('admissionDate').value = data.admissionDate || '';
        if (document.getElementById('classStartingDate')) {
          document.getElementById('classStartingDate').value = data.classStartingDate || '';
        }
        document.getElementById('monthlyFee').value = data.monthlyFee || '';
        document.getElementById('status').value = data.status || 'active';

        const courseType = data.courseType || '';
        courseTypeSelect.value = courseType;

        populateTutorDropdown(courseType);
        setTimeout(() => {
          tutorSelect.value = data.tutorId || '';
        }, 100);

        if (courseType === 'madrasa_group') {
          classGroup.style.display = 'block';
          if (classSelect) classSelect.value = data.classId || '';
          if (document.getElementById('levelGroup')) document.getElementById('levelGroup').style.display = 'none';
        } else if (courseType === 'madrasa_one_to_one' || courseType === 'quran_one_to_one') {
          if (document.getElementById('levelGroup')) {
            document.getElementById('levelGroup').style.display = 'block';
            document.getElementById('level').value = data.level || '';
          }
        }

        document.getElementById('pageTitle').textContent = `Edit Student: ${data.name}`;
        cancelBtn.href = `student-view.html?id=${studentId}`;
      } else {
        toast.error("Student not found!");
        window.location.href = "students.html";
      }
    } catch (error) {
      console.error("Error loading student data:", error);
      toast.error("Error loading student data.");
    }
  }

  // Handle Form Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Saving...';

    const courseType = courseTypeSelect.value;
    const isGroup = courseType === 'madrasa_group';

    try {
      const studentRef = doc(db, 'students', studentId);
      const updateData = {
        name: document.getElementById('name').value,
        parentName: document.getElementById('parentName').value,
        phone: document.getElementById('phone').value,
        whatsapp: document.getElementById('whatsapp').value,
        place: document.getElementById('place').value,
        courseType: courseType,
        tutorId: tutorSelect.value,
        classId: isGroup ? classSelect.value : '',
        level: (courseType === 'madrasa_one_to_one' || courseType === 'quran_one_to_one') ? document.getElementById('level').value : '',
        admissionDate: document.getElementById('admissionDate').value,
        classStartingDate: document.getElementById('classStartingDate') ? document.getElementById('classStartingDate').value : '',
        monthlyFee: parseFloat(document.getElementById('monthlyFee').value),
        status: document.getElementById('status').value,
        updatedAt: serverTimestamp()
      };

      await updateDoc(studentRef, updateData);
      toast.success("Student updated successfully!");
      window.location.href = `student-view.html?id=${studentId}`;
    } catch (error) {
      console.error("Error updating student: ", error);
      toast.error('Error updating student: ' + error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });

  // Handle Delete
  deleteBtn.addEventListener('click', async () => {
    if (confirm("Are you sure you want to completely delete this student record? This action cannot be undone. Consider changing the status to 'Inactive' instead if they have financial history.")) {
      try {
        deleteBtn.disabled = true;
        deleteBtn.textContent = 'Deleting...';
        await deleteDoc(doc(db, "students", studentId));
        toast.success("Student deleted successfully.");
        window.location.href = 'students.html';
      } catch (error) {
        console.error("Error deleting student:", error);
        toast.error("Error deleting student: " + error.message);
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete Student';
      }
    }
  });
});
