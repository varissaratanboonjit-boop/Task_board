// Quantum Jira-like Dashboard Manager - E2E Inline Automation Test Suite
(function() {
  // DOM Elements for Runner Drawer
  const runnerPanel = document.getElementById('automation-runner-panel');
  const btnOpenTests = document.getElementById('btn-open-tests');
  const btnCloseRunner = document.getElementById('btn-close-runner');
  const btnStartAutomation = document.getElementById('btn-start-automation');
  const selectRunSpeed = document.getElementById('select-run-speed');
  const runConsoleBox = document.getElementById('run-console-box');
  const runTimestamp = document.getElementById('run-timestamp');

  const runTotalVal = document.getElementById('run-total');
  const runPassedVal = document.getElementById('run-passed');
  const runFailedVal = document.getElementById('run-failed');

  let originalStateBackup = null;
  let actionDelay = 650;
  let passedCount = 0;
  let failedCount = 0;
  let createdIssueKey = ''; // Saved dynamically during E2E run

  // Toggle Runner Panel
  btnOpenTests.addEventListener('click', () => {
    backupState();
    runnerPanel.classList.add('active');
    document.body.classList.add('runner-active');
    log("เปิดใช้งาน E2E Automation Panel. สำรองข้อมูลจริงเรียบร้อย", "info");
  });

  function closeRunnerPanel() {
    runnerPanel.classList.remove('active');
    document.body.classList.remove('runner-active');
    restoreState();
    log("ปิด E2E Automation Panel. คืนค่าข้อมูลจริงเสร็จสิ้น", "info");
  }

  btnCloseRunner.addEventListener('click', closeRunnerPanel);

  // Log in runner console
  function log(msg, type = 'info') {
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    
    const time = document.createElement('span');
    time.className = 'log-time';
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
    time.textContent = `[${timeStr}]`;
    
    const content = document.createElement('span');
    content.className = 'log-msg';
    content.textContent = msg;
    
    line.appendChild(time);
    line.appendChild(content);
    runConsoleBox.appendChild(line);
    runConsoleBox.scrollTop = runConsoleBox.scrollHeight;
  }

  // Backup & Restore Jira State keys
  function backupState() {
    originalStateBackup = {
      projects: localStorage.getItem('jira_projects'),
      epics: localStorage.getItem('jira_epics'),
      sprints: localStorage.getItem('jira_sprints'),
      issues: localStorage.getItem('jira_issues'),
      comments: localStorage.getItem('jira_comments'),
      activeProjId: localStorage.getItem('jira_active_project_id')
    };
  }

  function restoreState() {
    if (!originalStateBackup) return;
    
    const restoreOrClear = (key, val) => {
      if (val === null) localStorage.removeItem(key);
      else localStorage.setItem(key, val);
    };

    restoreOrClear('jira_projects', originalStateBackup.projects);
    restoreOrClear('jira_epics', originalStateBackup.epics);
    restoreOrClear('jira_sprints', originalStateBackup.sprints);
    restoreOrClear('jira_issues', originalStateBackup.issues);
    restoreOrClear('jira_comments', originalStateBackup.comments);
    restoreOrClear('jira_active_project_id', originalStateBackup.activeProjId);

    if (window.qcState) {
      window.qcState.loadAllState();
      window.qcState.renderActiveTab();
    }
  }

  // DOM interaction helpers
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  async function click(selector, description) {
    log(`คลิก: ${description || selector}`, 'info');
    const el = document.querySelector(selector);
    if (!el) {
      throw new Error(`ไม่พบอิลิเมนต์สำหรับการคลิก: ${selector}`);
    }
    el.click();
    await wait(actionDelay);
  }

  async function type(selector, text, description) {
    log(`กรอก "${text}": ${description || selector}`, 'info');
    const el = document.querySelector(selector);
    if (!el) {
      throw new Error(`ไม่พบอิลิเมนต์สำหรับการกรอกข้อความ: ${selector}`);
    }
    el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(actionDelay);
  }

  async function select(selector, value, description) {
    log(`เลือก "${value}": ${description || selector}`, 'info');
    const el = document.querySelector(selector);
    if (!el) {
      throw new Error(`ไม่พบ dropdown: ${selector}`);
    }
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(actionDelay);
  }

  // Assertions
  function assert(condition, message) {
    if (condition) {
      log(`[ผ่าน] ${message}`, 'success');
    } else {
      log(`[ล้มเหลว] ${message}`, 'error');
      throw new Error(`ข้อผิดพลาด: ${message}`);
    }
  }

  function assertEquals(actual, expected, message) {
    assert(actual === expected, `${message} (คาดหวัง: "${expected}", ได้รับ: "${actual}")`);
  }

  function assertExists(selector, message) {
    const el = document.querySelector(selector);
    assert(el !== null, `${message} (พบคีย์ค้นหา "${selector}")`);
  }

  function updateStepUI(stepNum, status) {
    const item = document.getElementById(`run-step-${stepNum}`);
    const badge = document.getElementById(`run-status-${stepNum}`);
    
    if (!item || !badge) return;

    item.classList.remove('running', 'passed', 'failed');
    badge.classList.remove('pending', 'running', 'passed', 'failed');

    badge.className = `badge-status ${status}`;
    badge.textContent = status;
    
    if (status !== 'pending') {
      item.classList.add(status);
    }
  }

  // ==========================================================================
  // E2E AUTOMATION TEST STEPS (JIRA REFACTOR)
  // ==========================================================================
  const E2ETests = [
    // 1. สร้างโครงการและ Epic บน Roadmap
    async () => {
      log("--- เทส 1: สร้างโครงการและ Epic บน Roadmap ---", "header-log");
      await click('#btn-create-project', 'ปุ่มสร้างโครงการใหม่');
      assertExists('#project-modal.active', 'แบบฟอร์มเพิ่มโครงการแสดงสำเร็จ');

      await type('#project-name-input', 'โครงการจัดสรรงบประมาณ Target-Alpha', 'ระบุชื่อโครงการ');
      await click('#project-form button[type="submit"]', 'ปุ่มกดยืนยันสร้างโครงการ');

      const selectedName = document.querySelector('#project-selector option:checked').textContent;
      assertEquals(selectedName, 'โครงการจัดสรรงบประมาณ Target-Alpha', 'Dropdown เปลี่ยนเป็นโครงการใหม่');

      // Add Epic in Backlog Tab
      await click('#tab-backlog', 'สลับแท็บ Backlog');
      await click('#btn-create-epic', 'ปุ่มสร้าง Epic ใหม่');
      
      const firstEpicEl = document.querySelector('#backlog-epics-list .epic-item:nth-child(3)');
      assert(firstEpicEl !== null, 'Epic ใหม่แสดงในคอลัมน์ด้านซ้ายสำเร็จ');
      assertEquals(firstEpicEl.querySelector('span').textContent, 'Epic Setup 101', 'ชื่อ Epic ตรงตามที่ Mock ไว้');
    },

    // 2. สร้างงานใน Backlog และสร้างสปินต์ใหม่ (Sprint Plan)
    async () => {
      log("--- เทส 2: สร้างงานใน Backlog และสร้างสปินต์ใหม่ ---", "header-log");
      await click('#btn-create-issue', 'ปุ่มบวกสร้างการ์ดงาน');
      assertExists('#issue-modal.active', 'แบบฟอร์มสร้างการ์ดงานเปิดสำเร็จ');

      await type('#issue-title-input', 'เตรียมแผนงานทดสอบ SAP FI Integration', 'ระบุชื่อการ์ดงาน');
      await select('#issue-type-input', 'Test Planning & Design', 'เลือกประเภทงานเป็น Test Planning & Design');
      await select('#issue-priority-input', 'High', 'ระบุระดับความรุนแรง High');
      
      if (document.getElementById('issue-est-hours-input')) {
        await type('#issue-est-hours-input', '16', 'ระบุชั่วโมงประเมิน Est. Hours = 16');
      }
      
      const today = window.qcState.formatDateOffset(0);
      const nextWeek = window.qcState.formatDateOffset(7);
      await type('#issue-start-date-input', today, 'ใส่วันเริ่มงาน (Start Date)');
      await type('#issue-end-date-input', nextWeek, 'ใส่วันสิ้นสุดงาน (End Date)');

      await type('#issue-assignee-input', 'สมชาย คิวเอ', 'ระบุชื่อผู้รับผิดชอบ (Assignee)');
      await select('#issue-epic-select', document.querySelector('#issue-epic-select option:nth-child(2)').value, 'เลือกผูกกับ Epic');
      await type('#issue-detail-input', 'วิเคราะห์ข้อกำหนดสเปกและจัดทำเคสสอบทาน', 'กรอกช่องรายละเอียดงาน (Detail)');
      await type('#issue-remark-input', 'หมายเหตุเพิ่มเติมรัน E2E', 'กรอกช่องหมายเหตุ (Remark)');

      await click('#issue-form button[type="submit"]', 'กดยืนยันบันทึกการ์ดงาน');
      assert(!document.getElementById('issue-modal').classList.contains('active'), 'แบบฟอร์มปิดตัวลงเรียบร้อย');

      // Create new Sprint
      await click('#btn-create-sprint', 'สร้างสปินต์ล่วงหน้าใหม่');
      const sprintCount = document.querySelectorAll('#future-sprints-area .sprint-container').length;
      assert(sprintCount > 0, 'Sprint 2 (Future) ถูกจัดตั้งและแสดงผลสำเร็จ');
    },

    // 3. จำลองย้ายการ์ดงานและปักธง Blocked
    async () => {
      log("--- เทส 3: ย้ายแผนสปินต์และจำลองสถานะติด Blocker ---", "header-log");
      const allIssues = window.qcState.getIssues();
      assert(allIssues.length > 0, 'พบประวัติการ์ดงานในระบบ');
      
      const lastIssue = allIssues[allIssues.length - 1];
      createdIssueKey = lastIssue.id;

      log(`จำลองการย้ายการ์ด ${createdIssueKey} ไปยัง Active Sprint และอัปเดตเป็น In Progress...`, "info");
      lastIssue.sprintId = 'active-sprint';
      lastIssue.status = 'In Progress';
      window.qcState.saveGlobalState('issues', allIssues);
      
      // Switch to Active Board tab
      await click('#tab-board', 'สลับแท็บ Active Board');
      
      // Verify card existence in In Progress column
      const cardEl = document.querySelector(`#board-card-${createdIssueKey}`);
      assert(cardEl !== null, 'พบการ์ดงานย้ายมาแสดงบนคอลัมน์ IN PROGRESS สำเร็จ');
      
      // Click Blocked flag button on card
      log("จำลองการกดปุ่มติดธงแดงแจ้งเตือนปัญหา (Flag as Blocked)...", "info");
      const flagBtn = cardEl.querySelector('button[title="ติดธง/ยกเลิก Blocker"]');
      assert(flagBtn !== null, 'พบปุ่มปักธงบนการ์ด');
      flagBtn.click();
      
      // Allow state to update and re-render
      await new Promise(r => setTimeout(r, 150));
      
      // Verify it moved to Blocked column
      const blockedContainer = document.getElementById('board-blocked-container');
      const cardInBlocked = blockedContainer.querySelector(`#board-card-${createdIssueKey}`);
      assert(cardInBlocked !== null, 'การ์ดงานย้ายไปแสดงผลที่คอลัมน์ BLOCKED / WAITING เรียบร้อย');
    },

    // 4. แก้ไขรายละเอียดผ่าน Drawer ปรับ Progress Slider
    async () => {
      log(`--- เทส 4: เปิดดูและแก้ไขรายละเอียดการ์ดผ่าน Drawer (${createdIssueKey}) ---`, "header-log");
      await click(`#board-card-${createdIssueKey} .card-issue-key`, 'คลิกเลข Key งานเปิด Drawer');
      assertExists('#defect-drawer-overlay.active', 'ลิ้นชักรายละเอียดด้านขวาเปิดสำเร็จ');

      // Edit fields inside Drawer
      await type('#drawer-title-field', 'เตรียมแผนงานทดสอบ SAP FI Integration (แก้ไขล่าสุด)', 'แก้ไขชื่อหัวข้อ');
      await type('#drawer-detail-field', 'รายละเอียดที่ได้รับการปรับปรุงเนื้อหา', 'แก้ไขช่องรายละเอียด');
      await type('#drawer-remark-field', 'หมายเหตุใหม่ด่วนมาก', 'แก้ไขหมายเหตุ');
      
      // Slider progress set to 75%
      const slider = document.getElementById('drawer-progress-slider');
      if (slider) {
        slider.value = 75;
        slider.dispatchEvent(new Event('input'));
        log("เลื่อนสไลเดอร์ความคืบหน้าเป็น 75%", "info");
      }
      
      // Request help checkbox
      const helpCheckbox = document.getElementById('drawer-help-checkbox');
      if (helpCheckbox) {
        helpCheckbox.checked = true;
        log("ทำเครื่องหมายขอความช่วยเหลือ (Request Help)", "info");
      }

      // Est & Actual hours
      const estField = document.getElementById('drawer-est-hours-field');
      const actField = document.getElementById('drawer-actual-hours-field');
      if (estField) estField.value = 16;
      if (actField) actField.value = 4;

      // Add subtask
      await click('#btn-add-subtask', 'คลิกเพิ่มเช็คลิสต์ย่อย (Sub-task)');
      const subtaskCount = document.querySelectorAll('#drawer-subtasks-list .subtask-item').length;
      assert(subtaskCount > 0, 'เช็คลิสต์ย่อยเพิ่มสำเร็จ');

      // Save drawer changes
      await click('#btn-save-drawer-changes', 'กดยืนยันเซฟข้อมูลในลิ้นชัก');
      
      // Verify update on Active Board card
      const cardEl = document.querySelector(`#board-card-${createdIssueKey}`);
      const cardTitleText = cardEl.querySelector('h3').textContent;
      assert(cardTitleText.includes('(แก้ไขล่าสุด)'), 'ข้อมูลความคืบหน้าที่แก้ไขอัปเดตลงบอร์ดเรียบร้อย');
      assert(cardEl.classList.contains('help-requested'), 'การ์ดติดเอฟเฟกต์กระพริบขอความช่วยเหลือเรียบร้อย');
    },

    // 5. พิมพ์คอมเม้นต์ถามตอบราย Task
    async () => {
      log(`--- เทส 5: พิมพ์ข้อความคิดเห็นถามตอบในทีม (${createdIssueKey}) ---`, "header-log");
      await click(`#board-card-${createdIssueKey} .card-issue-key`, 'เปิด Drawer คีย์งานอีกครั้ง');
      
      await type('#comment-author-input', 'QA Auto Engine', 'พิมพ์ชื่อผู้โพสต์');
      await type('#comment-text-input', 'กำลังประสานงานทีมเพื่อเข้าทดสอบเพิ่มเติม', 'กรอกข้อความแชท');
      await click('#comment-add-form button[type="submit"]', 'กดส่งความคิดเห็น');

      const commentsCount = document.querySelectorAll('#drawer-comments-container .chat-bubble').length;
      assert(commentsCount > 0, 'ห้องสนทนาแสดงผลบันทึกข้อความสำเร็จ');

      await click('#btn-close-defect-drawer', 'กดปิดลิ้นชักด้านขวา');
    },

    // 6. แดชบอร์ดสรุป Blocker และการกระจายงาน
    async () => {
      log("--- เทส 6: ตรวจสอบแดชบอร์ดสรุป Blocker และส่งออกรายงาน ---", "header-log");
      await click('#tab-dashboard', 'สลับแท็บ Dashboard');
      
      // Check Blocked tasks list widget
      const blockedWidgetContainer = document.getElementById('blocked-tasks-summary-container');
      assert(blockedWidgetContainer !== null, 'พบ Widget สรุปงานติด Blocker บนแดชบอร์ด');
      assert(blockedWidgetContainer.textContent.includes(createdIssueKey), 'Widget แสดงรหัสงานติด Blocker ถูกต้อง');

      const workloadText = document.getElementById('workload-bars-container').textContent;
      assert(workloadText.includes('สมชาย คิวเอ'), 'แดชบอร์ดแสดงกราฟภาระงานของ สมชาย คิวเอ');

      // Settings downloads test
      await click('#tab-settings', 'สลับแท็บ Settings');
      await click('#btn-export-tasks-csv', 'ดาวน์โหลดรายงานการ์ดงาน CSV');

      log("E2E Automated Tests การันตีระบบ Tester Progress Board ผ่านครบ 100%! 🏆", "success");
    }
  ];

  // Start E2E automation runner loop
  async function runE2EAutomation() {
    const originalConfirm = window.confirm;
    const originalPrompt = window.prompt;
    
    // Mock user responses to prevent blocks
    window.confirm = () => true;
    window.prompt = (msg) => {
      if (msg && msg.includes("Epic")) return "Epic Setup 101";
      if (msg && msg.includes("Sub-task")) return "Subtask Check A";
      if (msg && msg.includes("Blocker")) return "ติดปัญหาบัญชีสำหรับเข้าเทสระบบ SAP ล็อก";
      return "Mock Response";
    };

    btnStartAutomation.disabled = true;
    btnStartAutomation.textContent = "กำลังรัน...";
    runConsoleBox.innerHTML = '';
    
    passedCount = 0;
    failedCount = 0;
    runPassedVal.textContent = '0';
    runFailedVal.textContent = '0';
    runTimestamp.textContent = 'executing...';

    actionDelay = parseInt(selectRunSpeed.value, 10);

    try {
      log("กำลังล้างข้อมูลเก่าค้างสต๊อกเพื่อสร้างคลีนเอนไวรอนเมนต์สำหรับรัน E2E...", "info");
      
      localStorage.removeItem('jira_projects');
      localStorage.removeItem('jira_epics');
      localStorage.removeItem('jira_sprints');
      localStorage.removeItem('jira_issues');
      localStorage.removeItem('jira_comments');
      localStorage.removeItem('jira_active_project_id');
      
      if (window.qcState) {
        initLocalStorage();
        window.qcState.loadAllState();
        window.qcState.renderActiveTab();
      }

      // Reset step badges
      for (let i = 1; i <= 6; i++) {
        updateStepUI(i, 'pending');
      }

      // Execute steps
      for (let i = 0; i < E2ETests.length; i++) {
        const stepNum = i + 1;
        updateStepUI(stepNum, 'running');
        try {
          await E2ETests[i]();
          updateStepUI(stepNum, 'passed');
          passedCount++;
          runPassedVal.textContent = passedCount;
        } catch (err) {
          updateStepUI(stepNum, 'failed');
          failedCount++;
          runFailedVal.textContent = failedCount;
          log(`ขั้นตอนเทสย่อย ${stepNum} พัง: ${err.message}`, 'error');
          log("เปิดใช้งานระบบ Fail-Fast. หยุดการทำงานทันทีเพื่อวิเคราะห์บัค", "error");
          break;
        }
      }

      if (failedCount === 0) {
        log("E2E Test Suite สรุปผล Jira-like Dashboard Manager ผ่านราบรื่น 100%! 🎉", "success");
        runTimestamp.textContent = 'ALL PASSED';
      } else {
        log("สิ้นสุดชุดทดสอบ โดยพบจุดบกพร่องตามรายการด้านบน", "error");
        runTimestamp.textContent = 'FAILED';
      }
    } finally {
      window.confirm = originalConfirm;
      window.prompt = originalPrompt;
      btnStartAutomation.disabled = false;
      btnStartAutomation.textContent = "เริ่มรันสคริปต์ทดสอบ";
    }
  }

  btnStartAutomation.addEventListener('click', runE2EAutomation);

  // Check URL query parameter (for automatic run)
  window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('run-tests') === 'true') {
      setTimeout(() => {
        btnOpenTests.click();
        runE2EAutomation();
      }, 500);
    }
  });

})();
