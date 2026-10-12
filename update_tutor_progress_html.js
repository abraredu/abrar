const fs = require('fs');

const path = 'd:\\abrar-main\\reports\\tutor-progress.html';
let content = fs.readFileSync(path, 'utf8');

const replacement = `
      <div class="page-content">
        
        <!-- Selection Container (Table) -->
        <div id="selectionContainer" class="card" style="margin-bottom: 2rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3>Select Student to Report</h3>
            <div class="form-group" style="margin-bottom: 0; min-width: 200px;">
              <input type="month" id="reportMonthSelect" class="form-control" title="Select Month for Report">
            </div>
          </div>
          
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead style="background: var(--color-background); border-bottom: 2px solid var(--color-border);">
                <tr>
                  <th style="padding: 1rem; font-weight: 600; color: var(--color-text-secondary);">Student Name</th>
                  <th style="padding: 1rem; font-weight: 600; color: var(--color-text-secondary);">Reg No.</th>
                  <th style="padding: 1rem; font-weight: 600; color: var(--color-text-secondary);">Action</th>
                </tr>
              </thead>
              <tbody id="tutorStudentsTableBody">
                <tr><td colspan="3" style="padding: 2rem; text-align: center; color: var(--color-text-secondary);">Loading students...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Report Container (Form) -->
        <div id="reportContainer" class="card" style="display: none;">
          <button type="button" id="backToTableBtn" class="btn btn-outline no-print" style="margin-bottom: 1rem;">
            <i data-lucide="arrow-left"></i> Back to List
          </button>
          
          <div class="report-header">
            <img src="../logo.png" alt="ABRAR Logo">
            <div class="report-title">ABRAR MONTHLY PROGRESS REPORT</div>
          </div>

          <form id="progressForm">
            
            <div class="report-section">
              <h4>Student Details</h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                  <label class="form-label">Student Name</label>
                  <input type="text" id="studentName" class="form-control" readonly style="background: var(--color-background);">
                  <input type="hidden" id="studentIdHidden">
                </div>
                <div class="form-group">
                  <label class="form-label">Report Month</label>
                  <input type="month" id="reportMonth" class="form-control" readonly style="background: var(--color-background);">
                </div>
              </div>
            </div>

            <div class="report-section">
              <h4>1. Attendance</h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                  <label class="form-label">Classes Conducted</label>
                  <input type="number" id="classesConducted" class="form-control" min="0" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Classes Attended</label>
                  <input type="number" id="classesAttended" class="form-control" min="0" required>
                </div>
              </div>
            </div>

            <div class="report-section">
              <h4>2. Performance & Progress Ratings</h4>
              
              <div class="rating-group">
                <div class="rating-label">Live Class Performance</div>
                <div class="rating-desc">Overall participation, confidence, attentiveness, and response during live classes.</div>
                <select id="liveClassPerf" class="form-control" required>
                  <option value="" disabled selected>Select Rating...</option>
                  <option value="Excellent">Excellent</option>
                  <option value="Very Good">Very Good</option>
                  <option value="Good">Good</option>
                  <option value="Needs Improvement">Needs Improvement</option>
                </select>
              </div>

              <div class="rating-group">
                <div class="rating-label">Lesson Progress</div>
                <div class="rating-desc">Progress made according to the monthly syllabus and learning objectives.</div>
                <select id="lessonProgress" class="form-control" required>
                  <option value="" disabled selected>Select Rating...</option>
                  <option value="Excellent">Excellent</option>
                  <option value="Very Good">Very Good</option>
                  <option value="Good">Good</option>
                  <option value="Needs Improvement">Needs Improvement</option>
                </select>
              </div>

              <div class="rating-group">
                <div class="rating-label">Revision & Homework</div>
                <div class="rating-desc">Regularity in revision and completion of assigned work.</div>
                <select id="revisionHomework" class="form-control" required>
                  <option value="" disabled selected>Select Rating...</option>
                  <option value="Excellent">Excellent</option>
                  <option value="Very Good">Very Good</option>
                  <option value="Good">Good</option>
                  <option value="Needs Improvement">Needs Improvement</option>
                </select>
              </div>

              <div class="rating-group">
                <div class="rating-label">Classroom Activities & Participation</div>
                <div class="rating-desc">Participation in discussions, oral responses, classroom activities, and practical tasks.</div>
                <select id="classActivities" class="form-control" required>
                  <option value="" disabled selected>Select Rating...</option>
                  <option value="Excellent">Excellent</option>
                  <option value="Very Good">Very Good</option>
                  <option value="Good">Good</option>
                  <option value="Needs Improvement">Needs Improvement</option>
                </select>
              </div>
            </div>

            <div class="report-section">
              <h4>3. Topics & Remarks</h4>
              
              <div class="form-group">
                <label class="form-label">Topics Covered This Month</label>
                <div class="rating-desc">The mentor manually enters the lessons or chapters completed during the month. (e.g. Surah Al-Mulk, Fiqh - Lesson 3, etc.)</div>
                <textarea id="topicsCovered" class="form-control" required placeholder="Enter topics covered..."></textarea>
              </div>

              <div class="form-group">
                <label class="form-label">Mentor's Remarks</label>
                <div class="rating-desc">A brief summary (2-3 sentences) highlighting the student's overall progress, strengths, and areas for improvement.</div>
                <textarea id="mentorRemarks" class="form-control" required placeholder="Enter remarks..."></textarea>
              </div>

              <div class="form-group">
                <label class="form-label">Recommendation to Parents</label>
                <div class="rating-desc">A short and practical suggestion to help support the student's learning at home.</div>
                <textarea id="recommendations" class="form-control" required placeholder="Enter recommendations..."></textarea>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 1rem;" class="no-print">
              <button type="submit" class="btn btn-primary" id="saveBtn">
                <i data-lucide="save"></i> Submit & Save Report
              </button>
            </div>
          </form>
        </div>
      </div>
`;

// Extract before page-content
const beforeContent = content.substring(0, content.indexOf('<div class="page-content">'));
const afterContent = content.substring(content.indexOf('</main>'));

content = beforeContent + replacement + afterContent;

// Replace <script type="module" src="../js/progress.js"></script> with tutor-progress.js
content = content.replace(/<script type="module" src="\.\.\/js\/progress\.js"><\/script>/, '<script type="module" src="../js/firebase-config.js"></script>\n  <script type="module" src="../js/tutor-progress.js"></script>');

fs.writeFileSync(path, content);
console.log('tutor-progress.html updated successfully');
