// Quantum Jira-like Dashboard Manager - State & Logic
let projects = [];
let activeProjectId = '';
let epics = [];
let sprints = [];
let issues = [];
let comments = {};

// Active View Tab State
let activeTab = 'roadmap';
let activeEpicFilter = null; // Filter board/backlog by Epic
let activeIssueForDrawer = null;

// Mock Names & Seed Helper
const mockAssignees = ["สมชาย คิวเอ", "Chaemongkhon", "Nattaphong", "Dev A", "Dev B"];
function formatDateOffset(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

// ==========================================================================
// 1. LOCAL STORAGE SEED & INITIALIZATION
// ==========================================================================
function initLocalStorage() {
  // 1. Projects
  if (localStorage.getItem('jira_projects') === null) {
    const defaultProjects = [
      { id: "proj-101", name: "พัฒนาระบบ SAP FI Procurement" },
      { id: "proj-102", name: "พัฒนาระบบ Budgeting CAPEX" }
    ];
    localStorage.setItem('jira_projects', JSON.stringify(defaultProjects));
    localStorage.setItem('jira_active_project_id', "proj-102");
  }

  // 2. Epics
  if (localStorage.getItem('jira_epics') === null) {
    const defaultEpics = [
      { id: "epic-1", projectId: "proj-102", name: "Master Data & Database Setup", color: "#a855f7", startDate: formatDateOffset(-10), endDate: formatDateOffset(10) },
      { id: "epic-2", projectId: "proj-102", name: "Budget Workflow & Approval", color: "#ec4899", startDate: formatDateOffset(-2), endDate: formatDateOffset(20) },
      { id: "epic-3", projectId: "proj-102", name: "Reporting & Export Dashboard", color: "#3b82f6", startDate: formatDateOffset(5), endDate: formatDateOffset(30) }
    ];
    localStorage.setItem('jira_epics', JSON.stringify(defaultEpics));
  }

  // 3. Sprints
  if (localStorage.getItem('jira_sprints') === null) {
    const defaultSprints = [
      { id: "active-sprint", projectId: "proj-102", name: "CAPEX Sprint 1 (Active)", startDate: formatDateOffset(-7), endDate: formatDateOffset(7), status: "active" },
      { id: "sprint-2", projectId: "proj-102", name: "CAPEX Sprint 2 (Future)", startDate: formatDateOffset(8), endDate: formatDateOffset(22), status: "future" }
    ];
    localStorage.setItem('jira_sprints', JSON.stringify(defaultSprints));
  }

  // 4. Issues (Task, Bug, Story)
  if (localStorage.getItem('jira_issues') === null) {
    const defaultIssues = [
      {
        id: "CAPEX-001",
        projectId: "proj-102",
        title: "ออกแบบตารางสัญญากลุ่ม IO และ WBS Master Data",
        type: "Story",
        priority: "High",
        status: "Done",
        sp: 5,
        startDate: formatDateOffset(-9),
        endDate: formatDateOffset(-4),
        assignee: "Nattaphong",
        reporter: "QA Reporter",
        detail: "จัดทำฐานข้อมูลเก็บรหัสสัญญากลุ่ม IO ทั้งหมดสอดรับกับ SAP FI",
        remark: "ผ่านขั้นตอนการสอบทานข้อมูลแล้ว",
        epicId: "epic-1",
        sprintId: "active-sprint",
        createdDate: formatDateOffset(-10),
        subTasks: [
          { id: "sub-1-1", title: "เตรียมโครงสร้างตาราง JSON", completed: true },
          { id: "sub-1-2", title: "แมปฟิลด์รหัส IO", completed: true }
        ],
        resolvedDate: formatDateOffset(-4)
      },
      {
        id: "CAPEX-002",
        projectId: "proj-102",
        title: "แก้ไขบัค WBS Dropdown แสดงรายการเรียงลำดับรหัสอักษรผิดพลาด",
        type: "Bug",
        priority: "Highest",
        status: "In Progress",
        sp: 3,
        startDate: formatDateOffset(-5),
        endDate: formatDateOffset(1),
        assignee: "Chaemongkhon",
        reporter: "สมชาย คิวเอ",
        detail: "Dropdown แสดงรายการรหัส WBS สลับตำแหน่งกันค้นหายาก รบกวนเรียงลำดับ ASC",
        remark: "กำลังทำ Mapping ดาต้าหน้าจอ",
        epicId: "epic-1",
        sprintId: "active-sprint",
        createdDate: formatDateOffset(-5),
        subTasks: [
          { id: "sub-2-1", title: "แก้ไขฟังก์ชัน sorting ASC", completed: false }
        ]
      },
      {
        id: "CAPEX-003",
        projectId: "proj-102",
        title: "สร้างฟอร์มกรอกเอกสารเสนออนุมัติงบประมาณ CAPEX",
        type: "Story",
        priority: "Medium",
        status: "To Do",
        sp: 8,
        startDate: formatDateOffset(-1),
        endDate: formatDateOffset(6),
        assignee: "Dev A",
        reporter: "QA Reporter",
        detail: "หน้าจอ UI เพื่อเสนอข้อมูลและแนบลิงก์รูปผลการดำเนินงาน",
        remark: "รอสเปก Validation เพิ่มเติม",
        epicId: "epic-2",
        sprintId: "active-sprint",
        createdDate: formatDateOffset(-2),
        subTasks: []
      },
      {
        id: "CAPEX-004",
        projectId: "proj-102",
        title: "จัดทำไฟล์ส่งออกรายงาน Dashboard และความคืบหน้า (CSV)",
        type: "Task",
        priority: "Low",
        status: "To Do",
        sp: 2,
        startDate: formatDateOffset(9),
        endDate: formatDateOffset(15),
        assignee: "Dev B",
        reporter: "QA Reporter",
        detail: "สร้างปุ่มให้กดดาวน์โหลดสรุปประวัติตารางงาน Epics/Sprints ทั้งหมดในระบบ",
        remark: "",
        epicId: "epic-3",
        sprintId: "sprint-2",
        createdDate: formatDateOffset(0),
        subTasks: []
      }
    ];
    localStorage.setItem('jira_issues', JSON.stringify(defaultIssues));
  }

  // 5. Comments
  if (localStorage.getItem('jira_comments') === null) {
    const defaultComments = {
      "CAPEX-002": [
        { author: "สมชาย คิวเอ", text: "Dropdown ตัวนี้ค้นหารหัสสัญญาค่อนข้างลำบากครับ รบกวนเรียงลำดับด่วน", date: formatDateOffset(-4) + " 09:30" },
        { author: "Chaemongkhon", text: "รับทราบครับ กำลังแก้อาร์เรย์ Sort ฝั่งหน้าจอให้ครับ", date: formatDateOffset(-3) + " 14:15" }
      ]
    };
    localStorage.setItem('jira_comments', JSON.stringify(defaultComments));
  }
}

// Load states from LocalStorage
function loadAllState() {
  projects = JSON.parse(localStorage.getItem('jira_projects') || '[]');
  activeProjectId = localStorage.getItem('jira_active_project_id') || '';

  const allEpics = JSON.parse(localStorage.getItem('jira_epics') || '[]');
  epics = allEpics.filter(e => e.projectId === activeProjectId);

  const allSprints = JSON.parse(localStorage.getItem('jira_sprints') || '[]');
  sprints = allSprints.filter(s => s.projectId === activeProjectId);

  const allIssues = JSON.parse(localStorage.getItem('jira_issues') || '[]');
  issues = allIssues.filter(i => i.projectId === activeProjectId);

  comments = JSON.parse(localStorage.getItem('jira_comments') || '{}');
}

// Save back to LocalStorage
function saveGlobalState(type, data) {
  if (type === 'epics') {
    const all = JSON.parse(localStorage.getItem('jira_epics') || '[]');
    const rest = all.filter(e => e.projectId !== activeProjectId);
    const merged = [...rest, ...data];
    localStorage.setItem('jira_epics', JSON.stringify(merged));
  } else if (type === 'sprints') {
    const all = JSON.parse(localStorage.getItem('jira_sprints') || '[]');
    const rest = all.filter(s => s.projectId !== activeProjectId);
    const merged = [...rest, ...data];
    localStorage.setItem('jira_sprints', JSON.stringify(merged));
  } else if (type === 'issues') {
    const all = JSON.parse(localStorage.getItem('jira_issues') || '[]');
    const rest = all.filter(i => i.projectId !== activeProjectId);
    const merged = [...rest, ...data];
    localStorage.setItem('jira_issues', JSON.stringify(merged));
  } else if (type === 'comments') {
    localStorage.setItem('jira_comments', JSON.stringify(data));
  }
}

// ==========================================================================
// 2. DOM ELEMENTS & EVENT BINDINGS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initLocalStorage();
  loadAllState();
  
  // Bind UI Controls
  setupSidebarNavigation();
  setupProjectControls();
  setupSettingsControls();
  setupCreateIssueControls();
  setupBacklogSprintControls();
  setupDrawerControls();
  
  // Render default active tab
  renderActiveTab();
});

// Sidebar navigation switcher
function setupSidebarNavigation() {
  const tabs = {
    'tab-roadmap': 'roadmap',
    'tab-backlog': 'backlog',
    'tab-board': 'board',
    'tab-dashboard': 'dashboard',
    'tab-settings': 'settings'
  };

  Object.keys(tabs).forEach(tabId => {
    const el = document.getElementById(tabId);
    if (el) {
      el.addEventListener('click', () => {
        Object.keys(tabs).forEach(id => {
          const btn = document.getElementById(id);
          if (btn) btn.classList.remove('active');
        });
        el.classList.add('active');
        activeTab = tabs[tabId];
        
        // Update breadcrumb
        const viewLabel = el.querySelector('span').textContent.replace(/[^\w\s\u0e00-\u0e7f]/g, '').trim();
        document.getElementById('breadcrumb-view').textContent = viewLabel;
        
        renderActiveTab();
      });
    }
  });
}

function renderActiveTab() {
  // Hide all views
  document.querySelectorAll('.tab-view').forEach(view => view.classList.remove('active'));
  
  // Toggle Board Quick filters visibility
  const quickFiltersBar = document.getElementById('board-quick-filters');
  if (activeTab === 'board' || activeTab === 'backlog') {
    quickFiltersBar.style.display = 'flex';
  } else {
    quickFiltersBar.style.display = 'none';
  }

  // Show active view & render
  if (activeTab === 'roadmap') {
    document.getElementById('view-roadmap').classList.add('active');
    renderRoadmapView();
  } else if (activeTab === 'backlog') {
    document.getElementById('view-backlog').classList.add('active');
    renderBacklogView();
  } else if (activeTab === 'board') {
    document.getElementById('view-board').classList.add('active');
    renderActiveBoardView();
  } else if (activeTab === 'dashboard') {
    document.getElementById('view-dashboard').classList.add('active');
    renderDashboardView();
  } else if (activeTab === 'settings') {
    document.getElementById('view-settings').classList.add('active');
  }

  if (window.lucide) window.lucide.createIcons();
}

// Project Selectors
function setupProjectControls() {
  const projectSelector = document.getElementById('project-selector');
  const btnCreateProj = document.getElementById('btn-create-project');
  const projectModal = document.getElementById('project-modal');
  const projectForm = document.getElementById('project-form');
  const projectNameInput = document.getElementById('project-name-input');
  
  function populateProjects() {
    projectSelector.innerHTML = '';
    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      if (p.id === activeProjectId) opt.selected = true;
      projectSelector.appendChild(opt);
    });
    // Set breadcrumb project
    const activeP = projects.find(p => p.id === activeProjectId);
    document.getElementById('breadcrumb-project').textContent = activeP ? activeP.name : 'โครงการ';
  }
  
  populateProjects();

  projectSelector.addEventListener('change', function() {
    activeProjectId = this.value;
    localStorage.setItem('jira_active_project_id', activeProjectId);
    loadAllState();
    populateProjects();
    renderActiveTab();
  });

  btnCreateProj.addEventListener('click', () => {
    projectNameInput.value = '';
    projectNameInput.closest('.form-group').classList.remove('has-error');
    projectModal.classList.add('active');
  });

  document.getElementById('btn-close-project-modal').addEventListener('click', () => projectModal.classList.remove('active'));
  document.getElementById('btn-cancel-project-modal').addEventListener('click', () => projectModal.classList.remove('active'));

  projectForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const name = projectNameInput.value.trim();
    if (!name) {
      projectNameInput.closest('.form-group').classList.add('has-error');
      return;
    }
    const newProjId = `proj-${Date.now()}`;
    projects.push({ id: newProjId, name });
    localStorage.setItem('jira_projects', JSON.stringify(projects));
    activeProjectId = newProjId;
    localStorage.setItem('jira_active_project_id', activeProjectId);
    
    // Seed initial basic sprint, epic, and backlog task for the new project
    const initialEpic = { id: `epic-${Date.now()}`, projectId: newProjId, name: "Epic ตั้งต้น", color: "#a855f7", startDate: formatDateOffset(0), endDate: formatDateOffset(30) };
    const initialSprint = { id: "active-sprint", projectId: newProjId, name: "Sprint 1 (Active)", startDate: formatDateOffset(0), endDate: formatDateOffset(14), status: "active" };
    
    const allEpics = JSON.parse(localStorage.getItem('jira_epics') || '[]');
    allEpics.push(initialEpic);
    localStorage.setItem('jira_epics', JSON.stringify(allEpics));

    const allSprints = JSON.parse(localStorage.getItem('jira_sprints') || '[]');
    allSprints.push(initialSprint);
    localStorage.setItem('jira_sprints', JSON.stringify(allSprints));

    projectModal.classList.remove('active');
    loadAllState();
    populateProjects();
    renderActiveTab();
  });

  // Delete Project Logic
  const btnDeleteProj = document.getElementById('btn-delete-project');
  if (btnDeleteProj) {
    btnDeleteProj.addEventListener('click', () => {
      if (projects.length <= 1) {
        alert("ไม่สามารถลบโครงการได้เนื่องจากระบบจำเป็นต้องมีอย่างน้อย 1 โครงการ");
        return;
      }
      
      const activeP = projects.find(p => p.id === activeProjectId);
      const pName = activeP ? activeP.name : 'โครงการปัจจุบัน';
      
      if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ "${pName}"?\n\nการลบนี้จะล้างข้อมูล Epics, Sprints, การ์ดงาน และคอมเม้นต์ทั้งหมดในโครงการนี้ทิ้งอย่างถาวร!`)) {
        // Remove from projects list
        projects = projects.filter(p => p.id !== activeProjectId);
        localStorage.setItem('jira_projects', JSON.stringify(projects));
        
        // Clean up child data in database (localStorage)
        const allEpics = JSON.parse(localStorage.getItem('jira_epics') || '[]').filter(e => e.projectId !== activeProjectId);
        localStorage.setItem('jira_epics', JSON.stringify(allEpics));
        
        const allSprints = JSON.parse(localStorage.getItem('jira_sprints') || '[]').filter(s => s.projectId !== activeProjectId);
        localStorage.setItem('jira_sprints', JSON.stringify(allSprints));
        
        // Get all issue IDs for this project to delete comments
        const projectIssues = JSON.parse(localStorage.getItem('jira_issues') || '[]').filter(i => i.projectId === activeProjectId);
        const issueIds = projectIssues.map(i => i.id);
        
        const allIssues = JSON.parse(localStorage.getItem('jira_issues') || '[]').filter(i => i.projectId !== activeProjectId);
        localStorage.setItem('jira_issues', JSON.stringify(allIssues));
        
        const allComments = JSON.parse(localStorage.getItem('jira_comments') || '{}');
        issueIds.forEach(id => {
          delete allComments[id];
        });
        localStorage.setItem('jira_comments', JSON.stringify(allComments));
        
        // Select the first remaining project as active
        activeProjectId = projects[0].id;
        localStorage.setItem('jira_active_project_id', activeProjectId);
        
        alert(`ลบโครงการ "${pName}" สำเร็จ!`);
        
        // Reload and render
        loadAllState();
        populateProjects();
        renderActiveTab();
      }
    });
  }
}

// Settings backups exports/imports
function setupSettingsControls() {
  const btnExportJson = document.getElementById('btn-export-db-json-full');
  const btnImportJson = document.getElementById('btn-import-db-json-full');
  const fileInputJson = document.getElementById('db-json-file-input-full');
  const btnResetMock = document.getElementById('btn-reset-to-mock');
  const btnResetEmpty = document.getElementById('btn-reset-to-empty');

  const btnExportTasks = document.getElementById('btn-export-tasks-csv');
  const btnExportSprints = document.getElementById('btn-export-sprints-csv');

  // Export JSON Backup
  btnExportJson.addEventListener('click', () => {
    const backupData = {
      projects: JSON.parse(localStorage.getItem('jira_projects') || '[]'),
      epics: JSON.parse(localStorage.getItem('jira_epics') || '[]'),
      sprints: JSON.parse(localStorage.getItem('jira_sprints') || '[]'),
      issues: JSON.parse(localStorage.getItem('jira_issues') || '[]'),
      comments: JSON.parse(localStorage.getItem('jira_comments') || '{}'),
      activeProjId: activeProjectId
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const dlElem = document.createElement('a');
    dlElem.setAttribute("href", dataStr);
    dlElem.setAttribute("download", `quantum_jira_backup_${formatDateOffset(0)}.json`);
    dlElem.click();
  });

  // Import JSON Backup
  btnImportJson.addEventListener('click', () => fileInputJson.click());
  fileInputJson.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const data = JSON.parse(evt.target.result);
        if (data.projects && data.epics && data.sprints && data.issues) {
          localStorage.setItem('jira_projects', JSON.stringify(data.projects));
          localStorage.setItem('jira_epics', JSON.stringify(data.epics));
          localStorage.setItem('jira_sprints', JSON.stringify(data.sprints));
          localStorage.setItem('jira_issues', JSON.stringify(data.issues));
          localStorage.setItem('jira_comments', JSON.stringify(data.comments || {}));
          if (data.activeProjId) localStorage.setItem('jira_active_project_id', data.activeProjId);

          alert("นำเข้าข้อมูลสำรอง Quantum Jira สำเร็จ!");
          window.location.reload();
        } else {
          alert("ไฟล์สแนปช็อต JSON ข้อมูลไม่ถูกต้อง!");
        }
      } catch (err) {
        alert("อ่านไฟล์สแนปช็อตผิดพลาด: " + err.message);
      }
    };
    reader.readAsText(file);
  });

  // Reset to mock data
  btnResetMock.addEventListener('click', () => {
    if (confirm("คุณต้องการล้างระบบและดาวน์โหลดข้อมูลจำลองมาตรฐานใช่หรือไม่?")) {
      localStorage.removeItem('jira_projects');
      localStorage.removeItem('jira_epics');
      localStorage.removeItem('jira_sprints');
      localStorage.removeItem('jira_issues');
      localStorage.removeItem('jira_comments');
      localStorage.removeItem('jira_active_project_id');
      initLocalStorage();
      window.location.reload();
    }
  });

  // Reset to empty database
  btnResetEmpty.addEventListener('click', () => {
    if (confirm("คำเตือน! คุณต้องการล้างฐานข้อมูลโครงการทั้งหมดเป็นห้องว่างเปล่าใช่หรือไม่?")) {
      localStorage.setItem('jira_projects', JSON.stringify([{ id: "proj-101", name: "โครงการจัดหาจัดซื้อใหม่" }]));
      localStorage.setItem('jira_epics', JSON.stringify([]));
      localStorage.setItem('jira_sprints', JSON.stringify([]));
      localStorage.setItem('jira_issues', JSON.stringify([]));
      localStorage.setItem('jira_comments', JSON.stringify({}));
      localStorage.setItem('jira_active_project_id', "proj-101");
      window.location.reload();
    }
  });

  // Export Tasks CSV
  btnExportTasks.addEventListener('click', () => {
    let csv = "Issue Key,Title,Type,Priority,Status,Story Points,Start Date,End Date,Assignee,Epic,Remark,Detail\r\n";
    issues.forEach(i => {
      const epicName = epics.find(e => e.id === i.epicId)?.name || '';
      csv += `"${i.id}","${i.title.replace(/"/g, '""')}","${i.type}","${i.priority}","${i.status}",${i.sp || 0},"${i.startDate}","${i.endDate}","${i.assignee}","${epicName}","${(i.remark || '').replace(/"/g, '""')}","${(i.detail || '').replace(/"/g, '""')}"\r\n`;
    });
    downloadCSV(csv, `jira_tasks_report_${activeProjectId}.csv`);
  });

  // Export Sprints CSV
  btnExportSprints.addEventListener('click', () => {
    let csv = "Sprint ID,Name,Start Date,End Date,Status,Total Cards,Completed SP\r\n";
    sprints.forEach(s => {
      const sIssues = issues.filter(i => i.sprintId === s.id);
      const totalSP = sIssues.reduce((acc, curr) => acc + (curr.sp || 0), 0);
      const doneSP = sIssues.filter(i => i.status === 'Done').reduce((acc, curr) => acc + (curr.sp || 0), 0);
      csv += `"${s.id}","${s.name}","${s.startDate}","${s.endDate}","${s.status}",${sIssues.length},${doneSP}/${totalSP}\r\n`;
    });
    downloadCSV(csv, `jira_sprints_report_${activeProjectId}.csv`);
  });
}

function downloadCSV(csvContent, filename) {
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.click();
}

// Quick filters
document.getElementById('filter-my-issues').addEventListener('click', () => {
  activeEpicFilter = "my-issues";
  renderActiveTab();
});
document.getElementById('filter-bugs').addEventListener('click', () => {
  activeEpicFilter = "only-bugs";
  renderActiveTab();
});
document.getElementById('filter-clear').addEventListener('click', () => {
  activeEpicFilter = null;
  renderActiveTab();
});

// ==========================================================================
// 3. ROADMAP VIEW TIMELINE RENDERING
// ==========================================================================
function renderRoadmapView() {
  const headerMonths = document.getElementById('roadmap-timeline-header-months');
  const rowsContainer = document.getElementById('roadmap-rows-container');
  
  headerMonths.innerHTML = '<div class="month-col" style="border-left:none;">รายการแผนงาน (Item Label)</div>';
  rowsContainer.innerHTML = '';

  // Calculate 4 months range starting from 2 months ago to 2 months from now
  const months = [];
  const currDate = new Date();
  currDate.setDate(1);
  currDate.setMonth(currDate.getMonth() - 2);
  
  for (let i = 0; i < 5; i++) {
    months.push(new Date(currDate));
    currDate.setMonth(currDate.getMonth() + 1);
  }

  // Draw Month Header columns
  months.forEach(m => {
    const monthLabel = m.toLocaleString('th-TH', { month: 'short', year: 'numeric' });
    headerMonths.innerHTML += `<div class="month-col" style="grid-column: span 2;">${monthLabel}</div>`;
  });

  const timelineStartDate = new Date(months[0]);
  const timelineEndDate = new Date(months[months.length - 1]);
  timelineEndDate.setMonth(timelineEndDate.getMonth() + 1);
  timelineEndDate.setDate(timelineEndDate.getDate() - 1);
  
  const totalDays = Math.round((timelineEndDate - timelineStartDate) / (1000 * 60 * 60 * 24));

  // Helper to calculate position percentage
  function getPositionPct(startStr, endStr) {
    const start = new Date(startStr || formatDateOffset(0));
    const end = new Date(endStr || formatDateOffset(1));
    
    let offsetDays = Math.round((start - timelineStartDate) / (1000 * 60 * 60 * 24));
    let durationDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
    
    if (offsetDays < 0) { durationDays += offsetDays; offsetDays = 0; }
    if (offsetDays > totalDays) return null;
    if (offsetDays + durationDays > totalDays) durationDays = totalDays - offsetDays;
    if (durationDays <= 0) durationDays = 1;

    const leftPct = (offsetDays / totalDays) * 100;
    const widthPct = (durationDays / totalDays) * 100;
    return { left: leftPct, width: widthPct };
  }

  // Draw Epic rows
  epics.forEach(ep => {
    const pos = getPositionPct(ep.startDate, ep.endDate);
    const row = document.createElement('div');
    row.className = 'roadmap-row';
    
    let barHtml = '';
    if (pos) {
      barHtml = `<div class="roadmap-bar epic-bar" style="left: calc(${pos.left}% + 10px); width: calc(${pos.width}% - 20px);" onclick="filterByEpic('${ep.id}')">⚡ Epic: ${escapeHTML(ep.name)}</div>`;
    }

    row.innerHTML = `
      <div class="roadmap-row-label">
        <span class="epic-color-dot" style="background:${ep.color}; box-shadow:0 0 5px ${ep.color};"></span>
        <span style="font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;" title="${escapeHTML(ep.name)}">${escapeHTML(ep.name)}</span>
      </div>
      <div class="roadmap-timeline-cells">
        ${barHtml}
      </div>
    `;
    rowsContainer.appendChild(row);
  });

  // Draw Sprint rows
  sprints.forEach(sp => {
    const pos = getPositionPct(sp.startDate, sp.endDate);
    const row = document.createElement('div');
    row.className = 'roadmap-row';

    let barHtml = '';
    if (pos) {
      barHtml = `<div class="roadmap-bar sprint-bar" style="left: calc(${pos.left}% + 10px); width: calc(${pos.width}% - 20px);" onclick="switchToSprintBoard('${sp.id}')">🏃 Sprint: ${escapeHTML(sp.name)}</div>`;
    }

    row.innerHTML = `
      <div class="roadmap-row-label">
        <i data-lucide="refresh-cw" style="width:14px; color:#3b82f6;"></i>
        <span style="font-weight:500;">${escapeHTML(sp.name)}</span>
      </div>
      <div class="roadmap-timeline-cells">
        ${barHtml}
      </div>
    `;
    rowsContainer.appendChild(row);
  });

  if (epics.length === 0 && sprints.length === 0) {
    rowsContainer.innerHTML = '<div style="text-align:center; padding:3rem; color:var(--color-text-muted);">ยังไม่มีรายการแผนงานในโครงการนี้</div>';
  }
}

window.filterByEpic = function(epicId) {
  activeEpicFilter = epicId;
  const tabBacklog = document.getElementById('tab-backlog');
  if (tabBacklog) tabBacklog.click();
};

window.switchToSprintBoard = function(sprintId) {
  // If clicked sprint is future, let's just show active sprint board or bind active sprint
  const tabBoard = document.getElementById('tab-board');
  if (tabBoard) tabBoard.click();
};

// ==========================================================================
// 4. BACKLOG VIEW (Sprint Planning & Drag-and-Drop)
// ==========================================================================
function renderBacklogView() {
  const epicContainer = document.getElementById('backlog-epics-list');
  const activeSprintDragArea = document.getElementById('active-sprint-drag-area');
  const backlogDragArea = document.getElementById('backlog-drag-area');
  const futureSprintsArea = document.getElementById('future-sprints-area');

  // Render Epics Filters
  epicContainer.innerHTML = `
    <div class="epic-item ${activeEpicFilter === null ? 'active' : ''}" onclick="selectEpicFilter(null)">
      <span>ทั้งหมด (All Epics)</span>
    </div>
  `;
  epics.forEach(ep => {
    epicContainer.innerHTML += `
      <div class="epic-item ${activeEpicFilter === ep.id ? 'active' : ''}" onclick="selectEpicFilter('${ep.id}')">
        <span>${escapeHTML(ep.name)}</span>
        <span class="epic-color-dot" style="background:${ep.color};"></span>
      </div>
    `;
  });

  // Filter issues based on active filters
  let filteredIssues = [...issues];
  if (activeEpicFilter === 'my-issues') {
    filteredIssues = filteredIssues.filter(i => i.assignee && i.assignee.includes("QA"));
  } else if (activeEpicFilter === 'only-bugs') {
    filteredIssues = filteredIssues.filter(i => i.type === 'Bug');
  } else if (activeEpicFilter) {
    filteredIssues = filteredIssues.filter(i => i.epicId === activeEpicFilter);
  }

  // Active Sprint
  const activeSprint = sprints.find(s => s.status === 'active') || { id: 'active-sprint', name: 'Sprint 1 (Active)', startDate: '', endDate: '' };
  document.getElementById('active-sprint-name').textContent = activeSprint.name;
  document.getElementById('active-sprint-date-label').textContent = `${activeSprint.startDate || 'No start'} - ${activeSprint.endDate || 'No end'}`;

  // Populate active sprint issues
  const activeSprintIssues = filteredIssues.filter(i => i.sprintId === 'active-sprint');
  const activeSP = activeSprintIssues.reduce((acc, curr) => acc + (curr.sp || 0), 0);
  document.getElementById('active-sprint-sp-count').textContent = `${activeSP} SP`;
  renderSprintIssuesList(activeSprintDragArea, activeSprintIssues);

  // Populate backlog issues
  const backlogIssues = filteredIssues.filter(i => i.sprintId === 'backlog' || !i.sprintId);
  const backlogSP = backlogIssues.reduce((acc, curr) => acc + (curr.sp || 0), 0);
  document.getElementById('backlog-sp-count').textContent = `${backlogSP} SP`;
  renderSprintIssuesList(backlogDragArea, backlogIssues);

  // Future Sprints
  futureSprintsArea.innerHTML = '';
  const futureSprints = sprints.filter(s => s.status === 'future');
  futureSprints.forEach(fs => {
    const fsIssues = filteredIssues.filter(i => i.sprintId === fs.id);
    const fsSP = fsIssues.reduce((acc, curr) => acc + (curr.sp || 0), 0);

    const container = document.createElement('div');
    container.className = 'sprint-container';
    container.style.marginTop = '1rem';
    container.innerHTML = `
      <div class="sprint-header">
        <div class="sprint-title-info">
          <i data-lucide="chevron-right" class="toggle-icon"></i>
          <strong>${escapeHTML(fs.name)}</strong>
          <span class="sprint-date-badge">${fs.startDate} - ${fs.endDate}</span>
          <span class="badge-count">${fsSP} SP</span>
        </div>
        <div class="sprint-actions">
          <button class="btn btn-secondary btn-sm" onclick="editSprintDates('${fs.id}')">ตั้งค่าวันสปินต์</button>
          <button class="btn btn-primary btn-sm" onclick="startSprint('${fs.id}')" style="background:#3b82f6;">เริ่มสปินต์ (Start)</button>
        </div>
      </div>
      <div class="sprint-drag-area" id="drag-${fs.id}" data-sprint-id="${fs.id}">
        <!-- Future sprint cards -->
      </div>
    `;
    futureSprintsArea.appendChild(container);
    
    const fsDragArea = container.querySelector('.sprint-drag-area');
    renderSprintIssuesList(fsDragArea, fsIssues);
  });

  // Setup drag-and-drop listener to backlog sprint boxes
  setupDragAndDropHandlers();
}

window.selectEpicFilter = function(epicId) {
  activeEpicFilter = epicId;
  renderActiveTab();
};

function renderSprintIssuesList(container, cardIssues) {
  container.innerHTML = '';
  if (cardIssues.length === 0) {
    container.innerHTML = '<div class="drag-placeholder" style="text-align:center; padding:1.2rem; font-size:0.75rem; color:var(--color-text-muted); border:1px dashed rgba(255,255,255,0.05); border-radius:6px;">ลากการ์ดงานมาวางที่นี่เพื่อมอบหมายแผนสปินต์</div>';
    return;
  }

  cardIssues.forEach(i => {
    const card = document.createElement('div');
    card.className = 'backlog-card';
    card.setAttribute('draggable', 'true');
    card.setAttribute('id', `backlog-card-${i.id}`);
    card.setAttribute('data-id', i.id);

    const priClass = i.priority.toLowerCase();
    const typeClass = i.type.toLowerCase();

    card.innerHTML = `
      <div class="card-title-group">
        <span class="badge-status ${typeClass}">${i.type}</span>
        <strong>${i.id}</strong>
        <span style="color:#e2e8f0; margin-left:0.5rem; cursor:pointer;" onclick="openDefectDrawer('${i.id}')">${escapeHTML(i.title)}</span>
      </div>
      <div class="card-meta-group">
        <span class="badge-tag ${priClass}" style="padding:0.1rem 0.35rem; font-size:0.6rem;">${i.priority}</span>
        <span style="font-size:0.75rem; color:var(--color-text-muted);">${i.assignee || 'Unassigned'}</span>
        <span class="badge-count" style="font-size:0.68rem; background:rgba(59, 130, 246, 0.15); color:#93c5fd;">${i.sp || 0} SP</span>
      </div>
    `;

    card.addEventListener('dragstart', (evt) => {
      evt.dataTransfer.setData('text/plain', i.id);
      evt.dataTransfer.effectAllowed = 'move';
      card.style.opacity = '0.4';
    });

    card.addEventListener('dragend', () => {
      card.style.opacity = '1';
    });

    container.appendChild(card);
  });
}

function setupDragAndDropHandlers() {
  const dragAreas = document.querySelectorAll('.sprint-drag-area, .board-cards-container');
  
  dragAreas.forEach(area => {
    area.addEventListener('dragover', (e) => {
      e.preventDefault();
      area.classList.add('drag-over');
    });

    area.addEventListener('dragleave', () => {
      area.classList.remove('drag-over');
    });

    area.addEventListener('drop', (e) => {
      e.preventDefault();
      area.classList.remove('drag-over');
      
      const issueId = e.dataTransfer.getData('text/plain');
      const issue = issues.find(i => i.id === issueId);
      if (!issue) return;

      // Check drop target type
      if (area.classList.contains('sprint-drag-area')) {
        // Backlog/Sprint drop
        const sprintId = area.getAttribute('data-sprint-id');
        issue.sprintId = sprintId;
        saveGlobalState('issues', issues);
        renderBacklogView();
      } else if (area.classList.contains('board-cards-container')) {
        // Active Board column drop
        const status = area.getAttribute('data-status');
        issue.status = status;
        
        // If moved to Done, track resolution date for burndown
        if (status === 'Done') {
          issue.resolvedDate = formatDateOffset(0);
        } else {
          delete issue.resolvedDate;
        }

        saveGlobalState('issues', issues);
        renderActiveBoardView();
      }
    });
  });
}

// Complete Sprint
document.getElementById('btn-complete-sprint').addEventListener('click', () => {
  const activeSprint = sprints.find(s => s.status === 'active');
  if (!activeSprint) return;

  if (confirm(`คุณต้องการปิดรอบสปินต์ ${activeSprint.name} หรือไม่? งานที่สถานะเป็น 'Done' จะถูกบันทึกสำเร็จ และงานที่ค้างอยู่จะถูกย้ายเข้าสู่ Backlog เพื่อวางแผนใหม่`)) {
    // Move all unfinished issues in active sprint back to backlog
    issues.forEach(i => {
      if (i.sprintId === 'active-sprint' && i.status !== 'Done') {
        i.sprintId = 'backlog';
      }
    });
    
    // Change sprint status to completed
    activeSprint.status = 'completed';
    saveGlobalState('sprints', sprints);
    saveGlobalState('issues', issues);
    
    // If sprint-2 exists, make it active
    const s2 = sprints.find(s => s.id === 'sprint-2');
    if (s2) {
      s2.status = 'active';
      s2.id = 'active-sprint'; // Rename ID to match active sprint slot
      // Update issues mapped to sprint-2 to active-sprint
      issues.forEach(i => {
        if (i.sprintId === 'sprint-2') i.sprintId = 'active-sprint';
      });
      saveGlobalState('sprints', sprints);
      saveGlobalState('issues', issues);
    }

    loadAllState();
    renderActiveTab();
  }
});

// Edit Sprint Dates
const sprintModal = document.getElementById('sprint-date-modal');
const sprintForm = document.getElementById('sprint-date-form');
const sprintIdHidden = document.getElementById('sprint-id-hidden');
const sprintNameInput = document.getElementById('sprint-name-input');
const sprintStartDateInput = document.getElementById('sprint-start-date');
const sprintEndDateInput = document.getElementById('sprint-end-date');

window.editSprintDates = function(sprintId) {
  const sp = sprints.find(s => s.id === sprintId);
  if (!sp) return;

  sprintIdHidden.value = sp.id;
  sprintNameInput.value = sp.name;
  sprintStartDateInput.value = sp.startDate;
  sprintEndDateInput.value = sp.endDate;

  sprintModal.classList.add('active');
};

document.getElementById('btn-edit-sprint-active').addEventListener('click', () => {
  editSprintDates('active-sprint');
});

[document.getElementById('btn-close-sprint-modal'), document.getElementById('btn-cancel-sprint-modal')].forEach(btn => {
  btn.addEventListener('click', () => sprintModal.classList.remove('active'));
});

sprintForm.addEventListener('submit', function(e) {
  e.preventDefault();
  const id = sprintIdHidden.value;
  const sp = sprints.find(s => s.id === id);
  if (sp) {
    sp.name = sprintNameInput.value.trim();
    sp.startDate = sprintStartDateInput.value;
    sp.endDate = sprintEndDateInput.value;
    saveGlobalState('sprints', sprints);
  }
  sprintModal.classList.remove('active');
  renderActiveTab();
});

// Create Sprints
document.getElementById('btn-create-sprint').addEventListener('click', () => {
  const sprintCount = sprints.length + 1;
  const newSprint = {
    id: `sprint-${Date.now()}`,
    projectId: activeProjectId,
    name: `CAPEX Sprint ${sprintCount} (Future)`,
    startDate: formatDateOffset(15),
    endDate: formatDateOffset(29),
    status: "future"
  };
  sprints.push(newSprint);
  saveGlobalState('sprints', sprints);
  renderBacklogView();
});

window.startSprint = function(sprintId) {
  const active = sprints.find(s => s.status === 'active');
  if (active) {
    alert("ระบบตรวจพบว่ามี Active Sprint รันอยู่แล้ว! กรุณา Complete สปินต์แรกก่อนจะเริ่มสปินต์ใหม่");
    return;
  }
  const target = sprints.find(s => s.id === sprintId);
  if (target) {
    target.status = 'active';
    target.id = 'active-sprint'; // Rename to match slot
    issues.forEach(i => {
      if (i.sprintId === sprintId) i.sprintId = 'active-sprint';
    });
    saveGlobalState('sprints', sprints);
    saveGlobalState('issues', issues);
    loadAllState();
    renderActiveTab();
  }
};

// ==========================================================================
// 5. ACTIVE KANBAN BOARD VIEW RENDERING
// ==========================================================================
function renderActiveBoardView() {
  const activeSprint = sprints.find(s => s.status === 'active');
  if (!activeSprint) {
    document.getElementById('active-board-sprint-title').textContent = "ไม่มี Active Sprint ในตอนนี้";
    document.getElementById('active-board-sprint-dates').textContent = "กรุณาสร้างและกดปุ่มเริ่ม Sprint ในแถบ Backlog";
    document.querySelectorAll('.board-cards-container').forEach(c => c.innerHTML = '');
    return;
  }

  document.getElementById('active-board-sprint-title').textContent = activeSprint.name;
  document.getElementById('active-board-sprint-dates').textContent = `${activeSprint.startDate} ถึง ${activeSprint.endDate}`;

  // Filter issues in active sprint
  let boardIssues = issues.filter(i => i.sprintId === 'active-sprint');
  
  if (activeEpicFilter === 'my-issues') {
    boardIssues = boardIssues.filter(i => i.assignee && i.assignee.includes("QA"));
  } else if (activeEpicFilter === 'only-bugs') {
    boardIssues = boardIssues.filter(i => i.type === 'Bug');
  } else if (activeEpicFilter) {
    boardIssues = boardIssues.filter(i => i.epicId === activeEpicFilter);
  }

  const containers = {
    'To Do': document.getElementById('board-todo-container'),
    'In Progress': document.getElementById('board-inprogress-container'),
    'In Review': document.getElementById('board-review-container'),
    'Done': document.getElementById('board-done-container')
  };

  const counts = { 'To Do': 0, 'In Progress': 0, 'In Review': 0, 'Done': 0 };

  // Clear containers
  Object.values(containers).forEach(c => { if(c) c.innerHTML = ''; });

  boardIssues.forEach(i => {
    const col = i.status || 'To Do';
    if (containers[col]) {
      counts[col]++;
      const card = document.createElement('div');
      card.className = `kanban-card ${i.priority.toLowerCase()}`;
      card.setAttribute('draggable', 'true');
      card.setAttribute('id', `board-card-${i.id}`);
      card.setAttribute('data-id', i.id);

      const assigneeInitials = i.assignee ? i.assignee.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() : 'UA';

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="card-issue-key" onclick="openDefectDrawer('${i.id}')">${i.id}</span>
          <span class="badge-status ${i.type.toLowerCase()}">${i.type}</span>
        </div>
        <h3 onclick="openDefectDrawer('${i.id}')" style="cursor:pointer;">${escapeHTML(i.title)}</h3>
        <div class="card-detail-text">${escapeHTML(i.detail || 'ไม่มีคำอธิบาย')}</div>
        
        <div class="card-dates-row">
          <span>เริ่ม: ${i.startDate || '-'}</span>
          <span>End: ${i.endDate || '-'}</span>
        </div>
        ${i.remark ? `<div class="card-remark">Remark: ${escapeHTML(i.remark)}</div>` : ''}

        <div class="card-footer-meta">
          <span class="badge-tag ${i.priority.toLowerCase()}">${i.priority}</span>
          <div style="display:flex; align-items:center; gap:0.4rem;">
            <span class="badge-count" style="font-size:0.65rem; background:rgba(255,255,255,0.06);">${i.sp || 0} SP</span>
            <div class="card-assignee-initials" title="${escapeHTML(i.assignee || 'Unassigned')}">${assigneeInitials}</div>
          </div>
        </div>
      `;

      card.addEventListener('dragstart', (evt) => {
        evt.dataTransfer.setData('text/plain', i.id);
        evt.dataTransfer.effectAllowed = 'move';
        card.style.opacity = '0.4';
      });

      card.addEventListener('dragend', () => {
        card.style.opacity = '1';
      });

      containers[col].appendChild(card);
    }
  });

  // Update counts
  document.getElementById('count-todo').textContent = counts['To Do'];
  document.getElementById('count-inprogress').textContent = counts['In Progress'];
  document.getElementById('count-review').textContent = counts['In Review'];
  document.getElementById('count-done').textContent = counts['Done'];

  setupDragAndDropHandlers();
}

// ==========================================================================
// 6. DASHBOARD MANAGER (Burndown Chart & Stats calculation)
// ==========================================================================
function renderDashboardView() {
  renderStatusDonutChart();
  renderWorkloadBars();
  renderVelocityHistory();
  renderBurndownChart();
}

function renderStatusDonutChart() {
  const container = document.getElementById('status-donut-chart');
  const legend = document.getElementById('status-donut-legend-list');
  container.innerHTML = '';
  legend.innerHTML = '';

  const total = issues.length;
  if (total === 0) {
    container.innerHTML = '<div style="font-size:0.8rem; color:var(--color-text-muted);">ไม่มีข้อมูลสรุป</div>';
    return;
  }

  const counts = { 'To Do': 0, 'In Progress': 0, 'In Review': 0, 'Done': 0 };
  issues.forEach(i => {
    counts[i.status || 'To Do']++;
  });

  // Render a simple CSS circular gradient representing the breakdown
  const todoPct = (counts['To Do'] / total) * 360;
  const ipPct = (counts['In Progress'] / total) * 360;
  const reviewPct = (counts['In Review'] / total) * 360;
  const donePct = (counts['Done'] / total) * 360;

  // Pie CSS gradient
  container.style.width = '120px';
  container.style.height = '120px';
  container.style.borderRadius = '50%';
  container.style.background = `conic-gradient(
    #64748b 0deg ${todoPct}deg,
    #eab308 ${todoPct}deg ${todoPct + ipPct}deg,
    #a855f7 ${todoPct + ipPct}deg ${todoPct + ipPct + reviewPct}deg,
    #10b981 ${todoPct + ipPct + reviewPct}deg 360deg
  )`;
  container.style.position = 'relative';
  container.style.boxShadow = '0 0 15px rgba(0,0,0,0.5)';
  
  // Donut inner hole
  container.innerHTML = `
    <div style="position:absolute; width:70px; height:70px; background:#0b1221; border-radius:50%; top:25px; left:25px; display:flex; flex-direction:column; justify-content:center; align-items:center; box-shadow:inset 0 0 10px rgba(0,0,0,0.8);">
      <span style="font-size:1.1rem; font-weight:700; color:#fff;">${total}</span>
      <span style="font-size:0.55rem; color:var(--color-text-muted); text-transform:uppercase;">Issues</span>
    </div>
  `;

  // Legend List
  const keys = [
    { label: 'To Do', color: '#64748b', count: counts['To Do'] },
    { label: 'In Progress', color: '#eab308', count: counts['In Progress'] },
    { label: 'In Review', color: '#a855f7', count: counts['In Review'] },
    { label: 'Done', color: '#10b981', count: counts['Done'] }
  ];

  keys.forEach(k => {
    const pct = total > 0 ? Math.round((k.count / total) * 100) : 0;
    legend.innerHTML += `
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; padding:0.2rem 0; border-bottom:1px solid rgba(255,255,255,0.03);">
        <span style="display:flex; align-items:center; gap:0.4rem;">
          <span style="width:7px; height:7px; border-radius:50%; background:${k.color}; display:inline-block;"></span>
          <span style="color:var(--color-text-muted);">${k.label}</span>
        </span>
        <strong style="color:#fff;">${k.count} (${pct}%)</strong>
      </div>
    `;
  });
}

function renderWorkloadBars() {
  const container = document.getElementById('workload-bars-container');
  container.innerHTML = '';

  const workloads = {};
  mockAssignees.forEach(name => workloads[name] = 0);
  workloads['Unassigned'] = 0;

  issues.forEach(i => {
    const name = i.assignee || 'Unassigned';
    if (workloads[name] !== undefined) {
      workloads[name] += (i.sp || 0);
    } else {
      workloads[name] = (i.sp || 0);
    }
  });

  const maxSP = Math.max(...Object.values(workloads), 1);

  Object.keys(workloads).forEach(name => {
    const sp = workloads[name];
    const pct = (sp / maxSP) * 100;

    container.innerHTML += `
      <div class="workload-bar-row">
        <strong style="color:#cbd5e1; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${escapeHTML(name)}</strong>
        <div class="workload-bar-wrapper">
          <div class="workload-bar-fill" style="width: ${pct}%;"></div>
        </div>
        <span style="font-weight:700; color:#fff; text-align:right;">${sp} SP</span>
      </div>
    `;
  });
}

function renderVelocityHistory() {
  const container = document.getElementById('velocity-list-container');
  container.innerHTML = '';

  // Get completed sprints
  const completedSprints = sprints.filter(s => s.status === 'completed');
  
  if (completedSprints.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:1rem; font-size:0.75rem; color:var(--color-text-muted);">ยังไม่มีประวัติสปินต์ที่ปิดการทำงาน</div>';
    return;
  }

  completedSprints.forEach(s => {
    const sIssues = issues.filter(i => i.sprintId === s.id || i.sprintId === 'completed-sprint-' + s.id);
    const totalSP = sIssues.reduce((acc, curr) => acc + (curr.sp || 0), 0);
    const completedSP = sIssues.filter(i => i.status === 'Done').reduce((acc, curr) => acc + (curr.sp || 0), 0);

    const pct = totalSP > 0 ? (completedSP / totalSP) * 100 : 0;

    container.innerHTML += `
      <div style="font-size:0.75rem; display:flex; flex-direction:column; gap:0.2rem; border-bottom:1px solid rgba(255,255,255,0.03); padding-bottom:0.4rem;">
        <div style="display:flex; justify-content:space-between;">
          <strong style="color:#fff;">${escapeHTML(s.name)}</strong>
          <span>${completedSP} / ${totalSP} SP Completed</span>
        </div>
        <div style="background:rgba(255,255,255,0.03); height:8px; border-radius:4px; overflow:hidden; width:100%;">
          <div style="background:#10b981; height:100%; width:${pct}%;"></div>
        </div>
      </div>
    `;
  });
}

function renderBurndownChart() {
  const svg = document.getElementById('burndown-svg-chart');
  svg.innerHTML = '';

  const activeSprint = sprints.find(s => s.status === 'active');
  if (!activeSprint) {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "300");
    text.setAttribute("y", "120");
    text.setAttribute("fill", "var(--color-text-muted)");
    text.setAttribute("font-size", "12");
    text.setAttribute("text-anchor", "middle");
    text.textContent = "ไม่มี Active Sprint เพื่อคำนวณกราฟเบิร์นดาวน์";
    svg.appendChild(text);
    return;
  }

  // Active Sprint dates & duration
  const start = new Date(activeSprint.startDate);
  const end = new Date(activeSprint.endDate);
  const durationDays = Math.max(Math.round((end - start) / (1000 * 60 * 60 * 24)), 1) + 1;

  // Active Sprint issues
  const sprintIssues = issues.filter(i => i.sprintId === 'active-sprint');
  const totalSP = sprintIssues.reduce((acc, curr) => acc + (curr.sp || 0), 0);

  if (totalSP === 0) {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "300");
    text.setAttribute("y", "120");
    text.setAttribute("fill", "var(--color-text-muted)");
    text.setAttribute("font-size", "12");
    text.setAttribute("text-anchor", "middle");
    text.textContent = "ไม่มีค่า Story Points ในสปินต์นี้เพื่อคำนวณเบิร์นดาวน์";
    svg.appendChild(text);
    return;
  }

  const width = 600;
  const height = 240;
  const paddingX = 50;
  const paddingY = 30;

  const graphWidth = width - paddingX * 2;
  const graphHeight = height - paddingY * 2;

  // Grid Lines & Y Labels (Burndown Story Points remaining)
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const val = Math.round((totalSP / ySteps) * i);
    const y = paddingY + graphHeight - (i / ySteps) * graphHeight;

    // Grid line
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", paddingX);
    line.setAttribute("y1", y);
    line.setAttribute("x2", width - paddingX);
    line.setAttribute("y2", y);
    line.setAttribute("stroke", "rgba(255,255,255,0.03)");
    svg.appendChild(line);

    // Label
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", paddingX - 10);
    text.setAttribute("y", y + 4);
    text.setAttribute("fill", "var(--color-text-muted)");
    text.setAttribute("font-size", "9");
    text.setAttribute("text-anchor", "end");
    text.textContent = `${val} SP`;
    svg.appendChild(text);
  }

  // X Labels & Timeline grid (Days)
  const xPoints = [];
  for (let i = 0; i < durationDays; i++) {
    const x = paddingX + (i / (durationDays - 1)) * graphWidth;
    xPoints.push(x);

    // Vertical line
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x);
    line.setAttribute("y1", paddingY);
    line.setAttribute("x2", x);
    line.setAttribute("y2", height - paddingY);
    line.setAttribute("stroke", "rgba(255,255,255,0.02)");
    svg.appendChild(line);

    // Label
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", x);
    text.setAttribute("y", height - paddingY + 16);
    text.setAttribute("fill", "var(--color-text-muted)");
    text.setAttribute("font-size", "8");
    text.setAttribute("text-anchor", "middle");
    text.textContent = `D${i+1}`;
    svg.appendChild(text);
  }

  // Ideal Burn Line (Ideal remaining SP over days)
  const idealPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  idealPath.setAttribute("d", `M ${paddingX},${paddingY} L ${width - paddingX},${height - paddingY}`);
  idealPath.setAttribute("fill", "none");
  idealPath.setAttribute("stroke", "rgba(255,255,255,0.15)");
  idealPath.setAttribute("stroke-width", "2");
  idealPath.setAttribute("stroke-dasharray", "4,4");
  svg.appendChild(idealPath);

  // Calculate actual remaining SP day by day (simulated for mock timeline)
  const today = new Date();
  const daysFromStart = Math.min(Math.round((today - start) / (1000 * 60 * 60 * 24)), durationDays - 1);
  
  const remainingPoints = [];
  let currentPoints = totalSP;

  for (let i = 0; i < durationDays; i++) {
    const dayDate = new Date(start);
    dayDate.setDate(dayDate.getDate() + i);
    const dayStr = dayDate.toISOString().split('T')[0];

    // Find issues resolved on this specific date
    const resolvedPoints = sprintIssues
      .filter(iss => iss.status === 'Done' && iss.resolvedDate === dayStr)
      .reduce((acc, curr) => acc + (curr.sp || 0), 0);
    
    currentPoints -= resolvedPoints;
    
    // Stop recording points if this date is in the future
    if (dayDate <= today || i === 0) {
      remainingPoints.push(currentPoints);
    } else {
      break;
    }
  }

  // Plot Actual Burn line (Red)
  const actualPoints = remainingPoints.map((val, idx) => {
    const x = xPoints[idx];
    const y = paddingY + graphHeight - (val / totalSP) * graphHeight;
    return `${x},${y}`;
  });

  if (actualPoints.length > 0) {
    const actualPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    actualPath.setAttribute("d", `M ${actualPoints.join(" L ")}`);
    actualPath.setAttribute("fill", "none");
    actualPath.setAttribute("stroke", "#ef4444");
    actualPath.setAttribute("stroke-width", "3");
    actualPath.setAttribute("stroke-linecap", "round");
    svg.appendChild(actualPath);

    // Draw circles on data points
    remainingPoints.forEach((val, idx) => {
      const x = xPoints[idx];
      const y = paddingY + graphHeight - (val / totalSP) * graphHeight;

      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", x);
      circle.setAttribute("cy", y);
      circle.setAttribute("r", "4");
      circle.setAttribute("fill", "#04060b");
      circle.setAttribute("stroke", "#ef4444");
      circle.setAttribute("stroke-width", "2");
      
      // Tooltip title
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = `Day ${idx+1}: เหลือ ${val} SP`;
      circle.appendChild(title);
      
      svg.appendChild(circle);
    });
  }
}

// ==========================================================================
// 7. CREATE NEW ISSUE CARD FORM
// ==========================================================================
function setupCreateIssueControls() {
  const btnCreateIssue = document.getElementById('btn-create-issue');
  const issueModal = document.getElementById('issue-modal');
  const issueForm = document.getElementById('issue-form');
  const btnCloseModal = document.getElementById('btn-close-issue-modal');
  const btnCancelModal = document.getElementById('btn-cancel-issue-modal');

  const issueIdHidden = document.getElementById('issue-id-hidden');
  const issueTitleInput = document.getElementById('issue-title-input');
  const issueTypeInput = document.getElementById('issue-type-input');
  const issuePriorityInput = document.getElementById('issue-priority-input');
  const issueSpInput = document.getElementById('issue-sp-input');
  const issueStartDateInput = document.getElementById('issue-start-date-input');
  const issueEndDateInput = document.getElementById('issue-end-date-input');
  const issueAssigneeInput = document.getElementById('issue-assignee-input');
  const issueEpicSelect = document.getElementById('issue-epic-select');
  const issueDetailInput = document.getElementById('issue-detail-input');
  const issueRemarkInput = document.getElementById('issue-remark-input');

  function populateEpicOptions() {
    issueEpicSelect.innerHTML = '<option value="">-- ไม่มี Epic --</option>';
    epics.forEach(ep => {
      issueEpicSelect.innerHTML += `<option value="${ep.id}">${escapeHTML(ep.name)}</option>`;
    });
  }

  btnCreateIssue.addEventListener('click', () => {
    populateEpicOptions();
    
    // Prefill form
    issueIdHidden.value = '';
    document.getElementById('issue-modal-title').textContent = 'สร้างการ์ดงานใหม่ (Create Issue Card)';
    issueTitleInput.value = '';
    issueTypeInput.value = 'Story';
    issuePriorityInput.value = 'High';
    issueSpInput.value = '3';
    issueStartDateInput.value = formatDateOffset(0);
    issueEndDateInput.value = formatDateOffset(7);
    issueAssigneeInput.value = '';
    issueDetailInput.value = '';
    issueRemarkInput.value = '';
    
    document.querySelectorAll('#issue-form .form-group').forEach(g => g.classList.remove('has-error'));
    issueModal.classList.add('active');
  });

  [btnCloseModal, btnCancelModal].forEach(btn => {
    btn.addEventListener('click', () => issueModal.classList.remove('active'));
  });

  issueForm.addEventListener('submit', function(e) {
    e.preventDefault();

    // Validations
    let hasError = false;
    const title = issueTitleInput.value.trim();
    const startDate = issueStartDateInput.value;
    const endDate = issueEndDateInput.value;
    const assignee = issueAssigneeInput.value.trim();
    const detail = issueDetailInput.value.trim();

    if (!title) { issueTitleInput.closest('.form-group').classList.add('has-error'); hasError = true; }
    else { issueTitleInput.closest('.form-group').classList.remove('has-error'); }

    if (!startDate) { issueStartDateInput.closest('.form-group').classList.add('has-error'); hasError = true; }
    else { issueStartDateInput.closest('.form-group').classList.remove('has-error'); }

    if (!endDate) { issueEndDateInput.closest('.form-group').classList.add('has-error'); hasError = true; }
    else { issueEndDateInput.closest('.form-group').classList.remove('has-error'); }

    if (!assignee) { issueAssigneeInput.closest('.form-group').classList.add('has-error'); hasError = true; }
    else { issueAssigneeInput.closest('.form-group').classList.remove('has-error'); }

    if (!detail) { issueDetailInput.closest('.form-group').classList.add('has-error'); hasError = true; }
    else { issueDetailInput.closest('.form-group').classList.remove('has-error'); }

    if (hasError) return;

    const id = issueIdHidden.value;
    if (id) {
      // Edit mode
      const iss = issues.find(i => i.id === id);
      if (iss) {
        iss.title = title;
        iss.type = issueTypeInput.value;
        iss.priority = issuePriorityInput.value;
        iss.sp = parseInt(issueSpInput.value, 10) || 0;
        iss.startDate = startDate;
        iss.endDate = endDate;
        iss.assignee = assignee;
        iss.epicId = issueEpicSelect.value;
        iss.detail = detail;
        iss.remark = issueRemarkInput.value.trim();
      }
    } else {
      // Create mode
      // Generate running JIRA key based on project ID abbreviation
      const activeP = projects.find(p => p.id === activeProjectId);
      const prefix = activeP ? activeP.name.replace(/[^\w\s]/g, '').split(' ').map(n => n[0]).join('').toUpperCase().substring(0,4) : 'KEY';
      
      const allIssues = JSON.parse(localStorage.getItem('jira_issues') || '[]');
      const nextNum = allIssues.length + 1;
      const runningKey = `${prefix || 'JIRA'}-${String(nextNum).padStart(3, '0')}`;

      const newIssue = {
        id: runningKey,
        projectId: activeProjectId,
        title,
        type: issueTypeInput.value,
        priority: issuePriorityInput.value,
        status: "To Do",
        sp: parseInt(issueSpInput.value, 10) || 0,
        startDate,
        endDate,
        assignee,
        reporter: "QA Reporter",
        detail,
        remark: issueRemarkInput.value.trim(),
        epicId: issueEpicSelect.value,
        sprintId: "backlog", // Default to backlog
        createdDate: formatDateOffset(0),
        subTasks: []
      };

      issues.push(newIssue);
    }

    saveGlobalState('issues', issues);
    issueModal.classList.remove('active');
    renderActiveTab();
  });
}

// Epic Creation Modal
function setupBacklogSprintControls() {
  const btnCreateEpic = document.getElementById('btn-create-epic');
  btnCreateEpic.addEventListener('click', () => {
    const name = prompt("กรุณาระบุชื่อ Epic (หัวข้อโครงการหลัก) ใหม่:");
    if (name && name.trim()) {
      const colors = ["#a855f7", "#ec4899", "#3b82f6", "#10b981", "#eab308"];
      const randColor = colors[Math.floor(Math.random() * colors.length)];
      const newEpic = {
        id: `epic-${Date.now()}`,
        projectId: activeProjectId,
        name: name.trim(),
        color: randColor,
        startDate: formatDateOffset(0),
        endDate: formatDateOffset(30)
      };
      epics.push(newEpic);
      saveGlobalState('epics', epics);
      renderBacklogView();
    }
  });
}

// ==========================================================================
// 8. ISSUE DETAILS SLIDE DRAWER (Right sidebar details & chats)
// ==========================================================================
function setupDrawerControls() {
  const drawerOverlay = document.getElementById('defect-drawer-overlay');
  const btnCloseDrawer = document.getElementById('btn-close-defect-drawer');
  const btnSaveDrawer = document.getElementById('btn-save-drawer-changes');

  const fieldKey = document.getElementById('drawer-issue-key');
  const fieldTypeBadge = document.getElementById('drawer-issue-type-badge');
  const fieldTitle = document.getElementById('drawer-title-field');
  const fieldDetail = document.getElementById('drawer-detail-field');
  const fieldRemark = document.getElementById('drawer-remark-field');
  
  const fieldStatus = document.getElementById('drawer-status-select');
  const fieldAssignee = document.getElementById('drawer-assignee-field');
  const fieldStartDate = document.getElementById('drawer-start-date-field');
  const fieldEndDate = document.getElementById('drawer-end-date-field');
  const fieldPriority = document.getElementById('drawer-priority-select');
  const fieldSP = document.getElementById('drawer-sp-field');
  const fieldEpic = document.getElementById('drawer-epic-select');

  const labelReporter = document.getElementById('drawer-reporter-label');
  const labelCreatedDate = document.getElementById('drawer-created-date-label');
  const subtasksList = document.getElementById('drawer-subtasks-list');
  const btnAddSubtask = document.getElementById('btn-add-subtask');

  const commentForm = document.getElementById('comment-add-form');
  const commentAuthor = document.getElementById('comment-author-input');
  const commentText = document.getElementById('comment-text-input');
  const commentsContainer = document.getElementById('drawer-comments-container');

  window.openDefectDrawer = function(issueId) {
    const iss = issues.find(i => i.id === issueId);
    if (!iss) return;

    activeIssueForDrawer = issueId;

    // Set fields
    fieldKey.textContent = iss.id;
    fieldTypeBadge.textContent = iss.type;
    fieldTypeBadge.className = `badge-status ${iss.type.toLowerCase()}`;

    fieldTitle.value = iss.title;
    fieldDetail.value = iss.detail || '';
    fieldRemark.value = iss.remark || '';
    fieldStatus.value = iss.status || 'To Do';
    fieldAssignee.value = iss.assignee || '';
    fieldStartDate.value = iss.startDate || '';
    fieldEndDate.value = iss.endDate || '';
    fieldPriority.value = iss.priority || 'High';
    fieldSP.value = iss.sp || 0;

    labelReporter.textContent = iss.reporter || 'QA Reporter';
    labelCreatedDate.textContent = iss.createdDate || '-';

    // Populate Epic dropdown options
    fieldEpic.innerHTML = '<option value="">-- ไม่มี Epic --</option>';
    epics.forEach(ep => {
      fieldEpic.innerHTML += `<option value="${ep.id}" ${iss.epicId === ep.id ? 'selected' : ''}>${escapeHTML(ep.name)}</option>`;
    });

    // Populate Sub-tasks checklist
    renderDrawerSubtasks(iss.subTasks || []);

    // Populate Comments
    renderDrawerComments(iss.id);

    // Open overlay drawer animation
    drawerOverlay.classList.add('active');
    setTimeout(() => {
      drawerOverlay.querySelector('.modal-content').style.right = '0px';
    }, 50);
  };

  function renderDrawerSubtasks(subTasks) {
    subtasksList.innerHTML = '';
    if (subTasks.length === 0) {
      subtasksList.innerHTML = '<div style="font-size:0.75rem; color:var(--color-text-muted); font-style:italic;">ไม่มีเช็คลิสต์งานย่อย</div>';
      return;
    }

    subTasks.forEach((st, idx) => {
      const row = document.createElement('div');
      row.className = `subtask-item ${st.completed ? 'completed' : ''}`;
      row.innerHTML = `
        <input type="checkbox" ${st.completed ? 'checked' : ''} onchange="toggleSubtaskStatus(${idx})">
        <span style="flex:1; font-size:0.78rem; color:#e2e8f0;">${escapeHTML(st.title)}</span>
        <button class="action-btn delete-btn" onclick="deleteSubtask(${idx})"><i data-lucide="trash-2" style="width:13px; height:13px;"></i></button>
      `;
      subtasksList.appendChild(row);
    });
    if (window.lucide) window.lucide.createIcons();
  }

  window.toggleSubtaskStatus = function(idx) {
    const iss = issues.find(i => i.id === activeIssueForDrawer);
    if (iss && iss.subTasks[idx]) {
      iss.subTasks[idx].completed = !iss.subTasks[idx].completed;
      saveGlobalState('issues', issues);
      renderDrawerSubtasks(iss.subTasks);
    }
  };

  window.deleteSubtask = function(idx) {
    const iss = issues.find(i => i.id === activeIssueForDrawer);
    if (iss && iss.subTasks[idx]) {
      iss.subTasks.splice(idx, 1);
      saveGlobalState('issues', issues);
      renderDrawerSubtasks(iss.subTasks);
    }
  };

  btnAddSubtask.addEventListener('click', () => {
    const title = prompt("กรุณาระบุหัวข้อเช็คลิสต์งานย่อย (Sub-task):");
    if (title && title.trim()) {
      const iss = issues.find(i => i.id === activeIssueForDrawer);
      if (iss) {
        if (!iss.subTasks) iss.subTasks = [];
        iss.subTasks.push({ id: `st-${Date.now()}`, title: title.trim(), completed: false });
        saveGlobalState('issues', issues);
        renderDrawerSubtasks(iss.subTasks);
      }
    }
  });

  // Comments Logs
  function renderDrawerComments(issueId) {
    commentsContainer.innerHTML = '';
    const issComments = comments[issueId] || [];

    if (issComments.length === 0) {
      commentsContainer.innerHTML = '<div style="text-align:center; padding:1rem; font-size:0.75rem; color:var(--color-text-muted);">ยังไม่มีประวัติการถามตอบการ์ดนี้</div>';
      return;
    }

    issComments.forEach(c => {
      const isOwn = c.author === commentAuthor.value;
      const bubble = document.createElement('div');
      bubble.className = `chat-bubble ${isOwn ? 'own' : ''}`;
      bubble.innerHTML = `
        <div class="meta-info">
          <span class="author">${escapeHTML(c.author)}</span>
          <span class="time">${c.date}</span>
        </div>
        <div class="text-msg">${escapeHTML(c.text)}</div>
      `;
      commentsContainer.appendChild(bubble);
    });
    commentsContainer.scrollTop = commentsContainer.scrollHeight;
  }

  // Save comments
  commentForm.addEventListener('submit', function(e) {
    e.preventDefault();
    if (!activeIssueForDrawer) return;

    const author = commentAuthor.value.trim();
    const text = commentText.value.trim();
    if (!author || !text) return;

    const now = new Date();
    const dateStr = formatDateOffset(0) + " " + String(now.getHours()).padStart(2,'0') + ":" + String(now.getMinutes()).padStart(2,'0');

    if (!comments[activeIssueForDrawer]) comments[activeIssueForDrawer] = [];
    comments[activeIssueForDrawer].push({ author, text, date: dateStr });

    saveGlobalState('comments', comments);
    commentText.value = '';
    renderDrawerComments(activeIssueForDrawer);
  });

  // Close Drawer
  function closeDrawer() {
    drawerOverlay.querySelector('.modal-content').style.right = '-680px';
    setTimeout(() => {
      drawerOverlay.classList.remove('active');
      activeIssueForDrawer = null;
    }, 300);
  }

  btnCloseDrawer.addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', (e) => {
    if (e.target === drawerOverlay) closeDrawer();
  });

  // Save drawer changes
  btnSaveDrawer.addEventListener('click', () => {
    if (!activeIssueForDrawer) return;

    const iss = issues.find(i => i.id === activeIssueForDrawer);
    if (iss) {
      iss.title = fieldTitle.value.trim();
      iss.detail = fieldDetail.value.trim();
      iss.remark = fieldRemark.value.trim();
      
      const oldStatus = iss.status;
      const newStatus = fieldStatus.value;
      iss.status = newStatus;
      
      if (newStatus === 'Done' && oldStatus !== 'Done') {
        iss.resolvedDate = formatDateOffset(0);
      } else if (newStatus !== 'Done') {
        delete iss.resolvedDate;
      }

      iss.assignee = fieldAssignee.value.trim();
      iss.startDate = fieldStartDate.value;
      iss.endDate = fieldEndDate.value;
      iss.priority = fieldPriority.value;
      iss.sp = parseInt(fieldSP.value, 10) || 0;
      iss.epicId = fieldEpic.value;

      saveGlobalState('issues', issues);
      closeDrawer();
      renderActiveTab();
    }
  });
}

// ==========================================================================
// 9. EXPOSE API FOR AUTOMATION TESTS (CORS BYPASS)
// ==========================================================================
window.qcState = {
  getProjects: () => projects,
  setProjects: (val) => projects = val,
  getActiveProjectId: () => activeProjectId,
  setActiveProjectId: (val) => { activeProjectId = val; },
  getSprints: () => sprints,
  setSprints: (val) => { sprints = val; },
  getEpics: () => epics,
  setEpics: (val) => { epics = val; },
  getIssues: () => issues,
  setIssues: (val) => { issues = val; },
  getComments: () => comments,
  setComments: (val) => { comments = val; },
  loadAllState,
  saveGlobalState,
  renderActiveTab,
  formatDateOffset
};

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
