document.addEventListener('DOMContentLoaded', () => {
  const printBtn = document.getElementById('printBtn');
  const progressForm = document.getElementById('progressForm');

  // Auto-fill student name if it's in the URL
  const urlParams = new URLSearchParams(window.location.search);
  const studentParam = urlParams.get('student');
  if (studentParam) {
    const studentNameInput = document.getElementById('studentName');
    if (studentNameInput) studentNameInput.value = studentParam;
  }

  // Prevent form submission from refreshing the page if enter is pressed
  if (progressForm) {
    progressForm.addEventListener('submit', (e) => {
      e.preventDefault();
      window.print();
    });
  }

  if (printBtn) {
    // Handled in HTML script tag to allow data binding first
  }
});
