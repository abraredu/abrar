import { toast } from './toast.js';
// js/add-tutor.js
import { db, auth } from './firebase-config.js';
import { collection, doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { uploadToCloudinary } from './cloudinary-config.js';
import { loadManagedCourses, renderTutorTypeCheckboxes } from './course-types.js';

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('addTutorForm');
  const submitBtn = document.getElementById('submitBtn');
  const typeContainer = document.getElementById('tutorTypeCheckboxes');

  // Load course types from Manage Courses
  let allCourses = [];
  try {
    allCourses = await loadManagedCourses();
  } catch (err) {
    console.error('Error loading courses:', err);
  }
  renderTutorTypeCheckboxes(typeContainer, allCourses);


  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
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

    const tutorTypeCheckboxes = document.querySelectorAll('.tutor-type-checkbox:checked');
    const tutorType = Array.from(tutorTypeCheckboxes).map(cb => cb.value);
    
    if (tutorType.length === 0) {
      toast.success('Please select at least one Tutor Type.');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }
    
    // Determine prefix based on the primary tutorType
    const typesLower = tutorType.map(t => String(t).toLowerCase());
    const has = (...keys) => typesLower.some(t => keys.some(k => t.includes(k)));
    let prefix = '';
    if (has('madrasa_individual', 'individual', 'one-to-one', 'one to one')) prefix = 'MO';
    else if (has('madrasa_group', 'group')) prefix = 'MG';
    else if (has('quran', "qur'an", 'recitation')) prefix = 'AQR';
    if (!prefix) {
      // New course types: use course serial without trailing digits (e.g. "AS001" -> "AS")
      const firstCourse = allCourses.find(c => c.courseName === tutorType[0]);
      prefix = (firstCourse && String(firstCourse.serialNo || '').trim().toUpperCase().replace(/\d+$/, '')) || 'TU';
    }

    try {
      const counterRef = doc(db, 'counters', 'tutors');
      
      const newTutorId = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        
        let newCount = 1;
        if (counterDoc.exists()) {
          const data = counterDoc.data();
          newCount = (data[prefix] || 0) + 1;
          transaction.update(counterRef, { [prefix]: newCount });
        } else {
          transaction.set(counterRef, { [prefix]: newCount });
        }

        // Format ID, e.g., MO1, AQR2
        const formattedId = `${prefix}${newCount}`;
        
        const tutorRef = doc(collection(db, 'tutors'));
        const tutorData = {
          tutorId: formattedId,
          name: document.getElementById('name').value,
          phone: document.getElementById('phone').value,
          whatsapp: document.getElementById('whatsapp').value,
          email: document.getElementById('email').value,
          address: document.getElementById('address').value,
          tutorType: tutorType,
          joiningDate: document.getElementById('joiningDate').value,
          loginUsername: (document.getElementById('loginUsername') && document.getElementById('loginUsername').value.trim()) ? document.getElementById('loginUsername').value.trim() : 'AGM',
          loginPassword: (document.getElementById('loginPassword') && document.getElementById('loginPassword').value) ? document.getElementById('loginPassword').value : document.getElementById('phone').value,
          status: 'active',
          photoUrl: photoUrl,
          idDocumentUrl: idDocumentUrl,
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser ? auth.currentUser.uid : 'system'
        };

        transaction.set(tutorRef, tutorData);
        return formattedId;
      });

      toast.success(`Tutor saved successfully! ID: ${newTutorId}`);
      window.location.href = 'tutors.html';
      
    } catch (error) {
      console.error("Error adding tutor: ", error);
      toast.error('Error saving tutor: ' + error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
});
