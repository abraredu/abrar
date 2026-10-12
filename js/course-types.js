// js/course-types.js
// Shared helpers to load course types dynamically from "Manage Courses" (managed_courses).
import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Labels for older hard-coded type keys still stored on some records
export const LEGACY_TYPE_LABELS = {
  madrasa_individual: 'Madrasa One-to-One',
  madrasa_one_to_one: 'Madrasa One-to-One',
  madrasa_group: 'Madrasa Group',
  quran_recitation: "Qur'an Recitation"
};

export function legacyLabel(value) {
  return LEGACY_TYPE_LABELS[value] || value;
}

// Fetch all managed courses, sorted by serial number
export async function loadManagedCourses() {
  const snap = await getDocs(collection(db, 'managed_courses'));
  const courses = [];
  snap.forEach(d => courses.push({ id: d.id, ...d.data() }));
  courses.sort((a, b) => String(a.serialNo || '').localeCompare(String(b.serialNo || ''), undefined, { numeric: true }));
  return courses;
}

// Does a stored value (student course/courseType or tutor type) refer to this course?
export function valueMatchesCourse(value, course) {
  if (!value || !course) return false;
  const v = String(value).trim().toLowerCase();
  return v === String(course.courseName || '').trim().toLowerCase() ||
         v === String(course.serialNo || '').trim().toLowerCase() ||
         v === String(course.id || '').toLowerCase();
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Render tutor-type checkboxes into a container.
// extraValues = stored values that don't match any course (kept so they aren't lost on edit)
export function renderTutorTypeCheckboxes(container, courses, extraValues = []) {
  const items = courses.map(c => ({ value: c.courseName, label: c.serialNo ? `${c.courseName} (${c.serialNo})` : c.courseName }));

  // Fallback if no courses configured yet
  if (items.length === 0) {
    ['madrasa_individual', 'madrasa_group', 'quran_recitation'].forEach(k => items.push({ value: k, label: legacyLabel(k) }));
  }

  extraValues.forEach(v => {
    if (!items.some(i => i.value === v)) items.push({ value: v, label: `${legacyLabel(v)} (old)` });
  });

  container.innerHTML = items.map(i => `
    <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; cursor: pointer;">
      <input type="checkbox" name="tutorType" value="${escapeHtml(i.value)}" class="tutor-type-checkbox"> ${escapeHtml(i.label)}
    </label>`).join('');
}
