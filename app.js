// Quantum Jira-like Dashboard Manager - State & Logic
let projects = [];
let activeProjectId = '';
let epics = [];
let sprints = [];
let issues = [];
let comments = {};
let summaryData = [];

// Firebase Real-time Sync Configuration
const firebaseConfig = {
  apiKey: "AIzaSyB3o3JupXVMgbcggltstEQhzY_X5EWuYfg",
  authDomain: "tester-taskboard.firebaseapp.com",
  databaseURL: "https://tester-taskboard-default-rtdb.firebaseio.com",
  projectId: "tester-taskboard",
  storageBucket: "tester-taskboard.appspot.com",
  appId: "1:14606292268:web:5b1b57fff8c7f370b50f89"
};
let dbRef = null;
let isRemoteUpdate = false;

function initFirebaseSync() {
  const checkbox = document.getElementById('sync-enabled-checkbox');
  const roomInput = document.getElementById('sync-room-input');
  const configRow = document.getElementById('sync-config-row');
  const statusBox = document.getElementById('sync-status-box');
  const statusLabel = document.getElementById('sync-status-label');

  if (!checkbox) return;

  const isEnabled = checkbox.checked;
  
  // Save settings state to localStorage
  localStorage.setItem('sync_enabled', isEnabled ? 'true' : 'false');

  if (!isEnabled) {
    if (configRow) configRow.style.display = 'none';
    if (statusBox) statusBox.style.display = 'none';
    if (dbRef) {
      dbRef.off();
      dbRef = null;
    }
    return;
  }

  if (configRow) configRow.style.display = 'flex';
  if (statusBox) statusBox.style.display = 'block';

  const roomId = roomInput ? roomInput.value.trim() : '';
  if (!roomId) {
    if (statusLabel) {
      statusLabel.textContent = "🔴 ออฟไลน์ (ระบุรหัสห้องทำงานเพื่อเชื่อมต่อ)";
      statusLabel.style.color = "#ef4444";
    }
    if (dbRef) {
      dbRef.off();
      dbRef = null;
    }
    return;
  }

  // Save room ID to localStorage
  localStorage.setItem('sync_room_id', roomId);

  // Load Custom Firebase config
  let customApiKey = localStorage.getItem('sync_firebase_apikey');
  let customDbUrl = localStorage.getItem('sync_firebase_dburl');
  let customProjId = localStorage.getItem('sync_firebase_projid');
  let customAppId = localStorage.getItem('sync_firebase_appid');

  if (!customApiKey || !customDbUrl || !customProjId || !customAppId) {
    // Fall back to default hardcoded config (useful for teammates opening the link)
    customApiKey = firebaseConfig.apiKey;
    customDbUrl = firebaseConfig.databaseURL;
    customProjId = firebaseConfig.projectId;
    customAppId = firebaseConfig.appId;
  }

  const customConfig = {
    apiKey: customApiKey,
    authDomain: `${customProjId}.firebaseapp.com`,
    databaseURL: customDbUrl,
    projectId: customProjId,
    storageBucket: `${customProjId}.appspot.com`,
    appId: customAppId
  };

  if (statusLabel) {
    statusLabel.textContent = "🟡 กำลังเชื่อมต่อ...";
    statusLabel.style.color = "#ffe68a";
  }

  try {
    if (typeof firebase === 'undefined') {
      throw new Error("ระบบ Firebase ยังโหลดไม่เสร็จสมบูรณ์");
    }

    if (firebase.apps.length) {
      Promise.all(firebase.apps.map(app => app.delete())).then(() => {
        firebase.initializeApp(customConfig);
        connectToRef();
      });
    } else {
      firebase.initializeApp(customConfig);
      connectToRef();
    }

    function connectToRef() {
      if (dbRef) {
        dbRef.off();
      }

      dbRef = firebase.database().ref(`rooms/${roomId}`);

      // Listen to value updates
      dbRef.on('value', (snapshot) => {
        const val = snapshot.val();
        if (val) {
          isRemoteUpdate = true;
          
          if (val.projects) {
            projects = val.projects;
            localStorage.setItem('jira_projects', JSON.stringify(projects));
          }
          if (val.epics) {
            localStorage.setItem('jira_epics', JSON.stringify(val.epics));
          }
          if (val.sprints) {
            localStorage.setItem('jira_sprints', JSON.stringify(val.sprints));
          }
          if (val.issues) {
            localStorage.setItem('jira_issues', JSON.stringify(val.issues));
          }
          if (val.comments) {
            comments = val.comments;
            localStorage.setItem('jira_comments', JSON.stringify(comments));
          }
          if (val.summaryData) {
            summaryData = val.summaryData;
            localStorage.setItem('jira_summary_data', JSON.stringify(summaryData));
          }

          // Reload data from local storage
          loadAllState();
          renderActiveTab();

          isRemoteUpdate = false;

          if (statusLabel) {
            statusLabel.innerHTML = `🟢 เชื่อมต่อสำเร็จ (ห้อง: <span style="color:#6366f1; font-weight:700;">${escapeHTML(roomId)}</span>)`;
            statusLabel.style.color = "#10b981";
          }
        } else {
          // First connection to this room: upload current state
          pushLocalStateToCloud();
          if (statusLabel) {
            statusLabel.innerHTML = `🟢 สร้างห้องใหม่สำเร็จ (ห้อง: <span style="color:#6366f1; font-weight:700;">${escapeHTML(roomId)}</span>)`;
            statusLabel.style.color = "#10b981";
          }
        }
      }, (err) => {
        if (statusLabel) {
          statusLabel.textContent = `🔴 เชื่อมต่อล้มเหลว: ${err.message}`;
          statusLabel.style.color = "#ef4444";
        }
      });
    }

  } catch (err) {
    if (statusLabel) {
      statusLabel.textContent = `🔴 ข้อผิดพลาด: ${err.message}`;
      statusLabel.style.color = "#ef4444";
    }
  }
}

function pushLocalStateToCloud() {
  if (!dbRef || isRemoteUpdate) return;
  const allEpics = JSON.parse(localStorage.getItem('jira_epics') || '[]');
  const allSprints = JSON.parse(localStorage.getItem('jira_sprints') || '[]');
  const allIssues = JSON.parse(localStorage.getItem('jira_issues') || '[]');

  dbRef.set({
    projects,
    epics: allEpics,
    sprints: allSprints,
    issues: allIssues,
    comments,
    summaryData
  }).catch(err => {
    console.error("Cloud push failed:", err);
  });
}

// Active View Tab State
let activeTab = 'home';
let currentCalendarDate = new Date();
let activeEpicFilter = null; // Filter board/backlog by Epic
let activeIssueForDrawer = null;

// Mock Names & Seed Helper
const mockAssignees = ["Ynok", "Sai", "Jud", "สมชาย คิวเอ"];
function formatDateOffset(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

// ==========================================================================
// 1. LOCAL STORAGE SEED & INITIALIZATION
// ==========================================================================
function initLocalStorage() {
  // Test Summary Data (From Act-Budget Excel image)
  if (localStorage.getItem('jira_summary_data') === null) {
    const defaultSummary = [
      { id: "ACTbudget-001", name: "Login_Logout", env: "UAT", assignedTo: "Ynok", status: "In Progress", total: 6, pass: 0, fail: 0, inprogress: 0, notStart: 6 },
      { id: "ACTbudget-002", name: "Dashboard", env: "UAT", assignedTo: "", status: "Not Start", total: 1, pass: 0, fail: 0, inprogress: 0, notStart: 1 },
      { id: "ACTbudget-003", name: "Create New Annual", env: "UAT", assignedTo: "Yid", status: "Pass", total: 57, pass: 57, fail: 0, inprogress: 0, notStart: 0 },
      { id: "ACTbudget-004", name: "Select budget", env: "UAT", assignedTo: "Sai", status: "Not Start", total: 25, pass: 8, fail: 0, inprogress: 0, notStart: 17 },
      { id: "ACTbudget-005", name: "Select Assignee", env: "UAT", assignedTo: "Jud", status: "Pass", total: 28, pass: 28, fail: 0, inprogress: 0, notStart: 0 },
      { id: "ACTbudget-006", name: "Set up Budget", env: "UAT", assignedTo: "Jud", status: "Pass", total: 74, pass: 74, fail: 0, inprogress: 0, notStart: 0 },
      { id: "ACTbudget-007", name: "summary Set up", env: "UAT", assignedTo: "Ynok", status: "Not Start", total: 8, pass: 0, fail: 0, inprogress: 0, notStart: 8 },
      { id: "ACTbudget-008", name: "Summary Department", env: "UAT", assignedTo: "Jud", status: "Not Start", total: 23, pass: 0, fail: 0, inprogress: 0, notStart: 23 }
    ];
    localStorage.setItem('jira_summary_data', JSON.stringify(defaultSummary));
  }
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
        id: "TEST-001",
        projectId: "proj-102",
        title: "วางแผนและเขียน Test Cases สำหรับระบบ SAP FI Procurement",
        type: "Test Planning & Design",
        priority: "High",
        status: "Done",
        sp: 5,
        estHours: 12,
        actualHours: 12,
        progress: 100,
        startDate: formatDateOffset(-9),
        endDate: formatDateOffset(-4),
        assignee: "Ynok",
        reporter: "QA Reporter",
        detail: "วิเคราะห์เงื่อนไขจัดทำเอกสารและสเต็ปคำนวณการจัดซื้อ SAP FI",
        remark: "ผ่านขั้นตอนการสอบทานร่วมกับ Lead แล้ว",
        epicId: "epic-1",
        sprintId: "active-sprint",
        createdDate: formatDateOffset(-10),
        subTasks: [
          { id: "sub-1-1", title: "เตรียมโครงสร้างเอกสาร UAT", completed: true },
          { id: "sub-1-2", title: "แมปฟิลด์รหัส IO ในฟิลเตอร์หลัก", completed: true }
        ],
        resolvedDate: formatDateOffset(-4)
      },
      {
        id: "TEST-002",
        projectId: "proj-102",
        title: "เขียน Automation Scripts สำหรับโมดูล Budgeting CAPEX ด้วย Playwright",
        type: "Automation Development",
        priority: "Highest",
        status: "In Progress",
        sp: 8,
        estHours: 24,
        actualHours: 8,
        progress: 25,
        isHelpRequested: true,
        startDate: formatDateOffset(-5),
        endDate: formatDateOffset(1),
        assignee: "Sai",
        reporter: "สมชาย คิวเอ",
        detail: "พัฒนายูสเคสเขียนสคริปต์ลงชื่อเข้าใช้บอร์ดคัมบังและการลากวาง",
        remark: "กำลังทำสคริปต์เช็คเอลิเมนต์หน้าจอ",
        epicId: "epic-1",
        sprintId: "active-sprint",
        createdDate: formatDateOffset(-5),
        subTasks: [
          { id: "sub-2-1", title: "แก้ไของค์ประกอบ sorting ASC", completed: false }
        ]
      },
      {
        id: "TEST-003",
        projectId: "proj-102",
        title: "เตรียมข้อมูลทดสอบพนักงานและกลุ่มงบประมาณย่อย (Test Data Prep)",
        type: "Environment & Data Prep",
        priority: "High",
        status: "Blocked",
        sp: 3,
        estHours: 8,
        actualHours: 2,
        progress: 50,
        blockerReason: "ติดปัญหาบัญชีสำหรับเข้าเทสระบบ SAP ล็อก รอผู้เชี่ยวชาญตรวจสอบเวลา 14:00 น.",
        startDate: formatDateOffset(-1),
        endDate: formatDateOffset(3),
        assignee: "Jud",
        reporter: "QA Reporter",
        detail: "สร้างชุดข้อมูลผู้ใช้สำหรับทดสอบขั้นตอนคำนวณเงินปันผลสะสม",
        remark: "ประสานงานไปแล้วทาง MS Teams",
        epicId: "epic-2",
        sprintId: "active-sprint",
        createdDate: formatDateOffset(-2),
        subTasks: []
      },
      {
        id: "TEST-004",
        projectId: "proj-102",
        title: "รันการทดสอบระบบจัดสรรงบประมาณรอบ Regression Testing (UAT Phase 1)",
        type: "Sprint Test Execution",
        priority: "Medium",
        status: "To Do",
        sp: 5,
        estHours: 16,
        actualHours: 0,
        progress: 0,
        startDate: formatDateOffset(1),
        endDate: formatDateOffset(7),
        assignee: "สมชาย คิวเอ",
        reporter: "QA Reporter",
        detail: "ดำเนินการรันเทสเคสทั้งหมดของ SAP FI Integration",
        remark: "รอบรรยายสเปกแก้บัค",
        epicId: "epic-2",
        sprintId: "active-sprint",
        createdDate: formatDateOffset(0),
        subTasks: []
      },
      {
        id: "TEST-005",
        projectId: "proj-102",
        title: "ประสานงาน UAT สนับสนุนการทดสอบร่วมกับทางผู้จัดการโครงการและทีมไอที",
        type: "UAT & Coordination",
        priority: "High",
        status: "In Review",
        sp: 2,
        estHours: 8,
        actualHours: 6,
        progress: 75,
        startDate: formatDateOffset(-2),
        endDate: formatDateOffset(5),
        assignee: "Jud",
        reporter: "QA Reporter",
        detail: "สรุปผลการเทสเคสส่งมอบให้ Test Lead ตรวจทานและอนุมัติ",
        remark: "ตรวจสอบเอกสาร UAT แล้ว",
        epicId: "epic-3",
        sprintId: "active-sprint",
        createdDate: formatDateOffset(-2),
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
  summaryData = JSON.parse(localStorage.getItem('jira_summary_data') || '[]');
}

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
  } else if (type === 'summary') {
    localStorage.setItem('jira_summary_data', JSON.stringify(data));
  }

  if (dbRef && !isRemoteUpdate) {
    pushLocalStateToCloud();
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
  setupSummaryControls();
  setupCalendarControls();
  
  // Render default active tab
  renderActiveTab();
});

// Sidebar navigation switcher
function setupSidebarNavigation() {
  const tabs = {
    'tab-home': 'home',
    'tab-calendar': 'calendar',
    'tab-roadmap': 'roadmap',
    'tab-backlog': 'backlog',
    'tab-board': 'board',
    'tab-summary': 'summary',
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
  if (activeTab === 'home') {
    document.getElementById('view-home').classList.add('active');
    renderHomeView();
  } else if (activeTab === 'calendar') {
    document.getElementById('view-calendar').classList.add('active');
    renderCalendarView();
  } else if (activeTab === 'roadmap') {
    document.getElementById('view-roadmap').classList.add('active');
    renderRoadmapView();
  } else if (activeTab === 'backlog') {
    document.getElementById('view-backlog').classList.add('active');
    renderBacklogView();
  } else if (activeTab === 'board') {
    document.getElementById('view-board').classList.add('active');
    renderActiveBoardView();
  } else if (activeTab === 'summary') {
    document.getElementById('view-summary').classList.add('active');
    renderSummaryView();
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
        if (dbRef && !isRemoteUpdate) {
          pushLocalStateToCloud();
        }
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

  // Real-Time Sync Bindings
  const syncCheckbox = document.getElementById('sync-enabled-checkbox');
  const syncRoomInput = document.getElementById('sync-room-input');
  const btnConnectSync = document.getElementById('btn-connect-sync');
  
  const toggleKeysBtn = document.getElementById('toggle-firebase-keys-btn');
  const keysContainer = document.getElementById('firebase-keys-container');
  const btnSaveKeys = document.getElementById('btn-save-firebase-keys');

  // Input Fields
  const apikeyInput = document.getElementById('sync-firebase-apikey');
  const dburlInput = document.getElementById('sync-firebase-dburl');
  const projidInput = document.getElementById('sync-firebase-projid');
  const appidInput = document.getElementById('sync-firebase-appid');

  if (syncCheckbox) {
    // Load saved settings
    const savedEnabled = localStorage.getItem('sync_enabled') === 'true';
    const savedRoomId = localStorage.getItem('sync_room_id') || '';

    syncCheckbox.checked = savedEnabled;
    if (syncRoomInput) syncRoomInput.value = savedRoomId;

    // Load saved Firebase keys
    if (apikeyInput) apikeyInput.value = localStorage.getItem('sync_firebase_apikey') || '';
    if (dburlInput) dburlInput.value = localStorage.getItem('sync_firebase_dburl') || '';
    if (projidInput) projidInput.value = localStorage.getItem('sync_firebase_projid') || '';
    if (appidInput) appidInput.value = localStorage.getItem('sync_firebase_appid') || '';

    // Trigger initial state
    if (savedEnabled) {
      document.getElementById('sync-config-row').style.display = 'flex';
      document.getElementById('sync-status-box').style.display = 'block';
      setTimeout(initFirebaseSync, 800); // Allow firebase script to be loaded
    }

    syncCheckbox.addEventListener('change', () => {
      initFirebaseSync();
    });

    if (btnConnectSync) {
      btnConnectSync.addEventListener('click', () => {
        initFirebaseSync();
      });
    }

    if (toggleKeysBtn && keysContainer) {
      toggleKeysBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const isHidden = keysContainer.style.display === 'none';
        keysContainer.style.display = isHidden ? 'flex' : 'none';
      });
    }

    if (btnSaveKeys) {
      btnSaveKeys.addEventListener('click', () => {
        localStorage.setItem('sync_firebase_apikey', (apikeyInput ? apikeyInput.value.trim() : ''));
        localStorage.setItem('sync_firebase_dburl', (dburlInput ? dburlInput.value.trim() : ''));
        localStorage.setItem('sync_firebase_projid', (projidInput ? projidInput.value.trim() : ''));
        localStorage.setItem('sync_firebase_appid', (appidInput ? appidInput.value.trim() : ''));
        alert("บันทึกกุญแจคลาวด์ Firebase สำเร็จ!");
        initFirebaseSync();
      });
    }
  }
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
const btnFilterBlockers = document.getElementById('filter-blockers');
const btnFilterReadyQA = document.getElementById('filter-ready-qa');
if (btnFilterBlockers) {
  btnFilterBlockers.addEventListener('click', () => {
    activeEpicFilter = "blockers";
    renderActiveTab();
  });
}
if (btnFilterReadyQA) {
  btnFilterReadyQA.addEventListener('click', () => {
    activeEpicFilter = "ready-qa";
    renderActiveTab();
  });
}
document.getElementById('filter-my-issues').addEventListener('click', () => {
  activeEpicFilter = "my-issues";
  renderActiveTab();
});

const btnFilterDueSoon = document.getElementById('filter-due-soon');
if (btnFilterDueSoon) {
  btnFilterDueSoon.addEventListener('click', () => {
    activeEpicFilter = "due-soon";
    renderActiveTab();
  });
}

const testerSelect = document.getElementById('filter-tester-select');
if (testerSelect) {
  testerSelect.addEventListener('change', () => {
    renderActiveTab();
  });
}

document.getElementById('filter-clear').addEventListener('click', () => {
  activeEpicFilter = null;
  if (testerSelect) testerSelect.value = '';
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

// ==========================================================================
// 3.5 HOME PORTFOLIO VIEW RENDERING
// ==========================================================================
function renderHomeView() {
  const totalProj = projects.length;
  const countEl = document.getElementById('home-total-projects-count');
  if (countEl) countEl.textContent = totalProj;

  const allIssues = JSON.parse(localStorage.getItem('jira_issues') || '[]');
  const blockedCount = allIssues.filter(i => i.status === 'Blocked').length;
  const blockedEl = document.getElementById('home-total-blocked-count');
  if (blockedEl) blockedEl.textContent = blockedCount;

  const doneIssuesCount = allIssues.filter(i => i.status === 'Done').length;
  const totalIssuesCount = allIssues.length;
  const donePct = totalIssuesCount > 0 ? Math.round((doneIssuesCount / totalIssuesCount) * 100) : 0;
  const doneEl = document.getElementById('home-total-done-pct');
  if (doneEl) doneEl.textContent = `${donePct}%`;

  renderGlobalRoadmap();
  renderHomeProjectCards();
}

function renderGlobalRoadmap() {
  const headerMonths = document.getElementById('home-roadmap-timeline-header-months');
  const rowsContainer = document.getElementById('home-roadmap-rows-container');
  if (!headerMonths || !rowsContainer) return;

  headerMonths.innerHTML = '<div class="month-col" style="border-left:none;">แผนงานพอร์ตโฟลิโอ (Portfolio Plan)</div>';
  rowsContainer.innerHTML = '';

  const months = [];
  const currDate = new Date();
  currDate.setDate(1);
  currDate.setMonth(currDate.getMonth() - 2);
  
  for (let i = 0; i < 5; i++) {
    months.push(new Date(currDate));
    currDate.setMonth(currDate.getMonth() + 1);
  }

  months.forEach(m => {
    const monthLabel = m.toLocaleString('th-TH', { month: 'short', year: 'numeric' });
    headerMonths.innerHTML += `<div class="month-col" style="grid-column: span 2;">${monthLabel}</div>`;
  });

  const timelineStartDate = new Date(months[0]);
  const timelineEndDate = new Date(months[months.length - 1]);
  timelineEndDate.setMonth(timelineEndDate.getMonth() + 1);
  timelineEndDate.setDate(timelineEndDate.getDate() - 1);
  const totalDays = Math.round((timelineEndDate - timelineStartDate) / (1000 * 60 * 60 * 24));

  function getPositionPct(startStr, endStr) {
    const start = new Date(startStr || formatDateOffset(0));
    const end = new Date(endStr || formatDateOffset(1));
    let offsetDays = Math.round((start - timelineStartDate) / (1000 * 60 * 60 * 24));
    let durationDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
    if (offsetDays < 0) { durationDays += offsetDays; offsetDays = 0; }
    if (offsetDays > totalDays) return null;
    if (offsetDays + durationDays > totalDays) durationDays = totalDays - offsetDays;
    if (durationDays <= 0) durationDays = 1;
    return { left: (offsetDays / totalDays) * 100, width: (durationDays / totalDays) * 100 };
  }

  const allEpics = JSON.parse(localStorage.getItem('jira_epics') || '[]');
  const allSprints = JSON.parse(localStorage.getItem('jira_sprints') || '[]');

  projects.forEach(p => {
    // Project Row Header
    const projRow = document.createElement('div');
    projRow.className = 'roadmap-row';
    projRow.style.background = 'rgba(99, 102, 241, 0.05)';
    projRow.style.borderLeft = '4px solid #6366f1';
    projRow.innerHTML = `
      <div class="roadmap-row-label" style="font-weight:700; color:var(--color-text); font-size:0.8rem;">
        <i data-lucide="briefcase" style="width:14px; height:14px; color:#6366f1; margin-right:0.3rem; vertical-align:middle;"></i>
        <span>${escapeHTML(p.name)}</span>
      </div>
      <div class="roadmap-timeline-cells"></div>
    `;
    rowsContainer.appendChild(projRow);

    // Epics for this project
    const pEpics = allEpics.filter(e => e.projectId === p.id);
    pEpics.forEach(ep => {
      const pos = getPositionPct(ep.startDate, ep.endDate);
      const row = document.createElement('div');
      row.className = 'roadmap-row';
      let barHtml = '';
      if (pos) {
        barHtml = `<div class="roadmap-bar epic-bar" style="left: calc(${pos.left}% + 10px); width: calc(${pos.width}% - 20px); background:linear-gradient(90deg, ${ep.color || '#3b82f6'}, rgba(99, 102, 241, 0.5));" onclick="selectProjectAndRedirect('${p.id}', 'roadmap')">⚡ Epic: ${escapeHTML(ep.name)}</div>`;
      }
      row.innerHTML = `
        <div class="roadmap-row-label" style="padding-left:1.5rem; font-size:0.75rem;">
          <span class="epic-color-dot" style="background:${ep.color || '#3b82f6'};"></span>
          <span>${escapeHTML(ep.name)}</span>
        </div>
        <div class="roadmap-timeline-cells">${barHtml}</div>
      `;
      rowsContainer.appendChild(row);
    });

    // Sprints for this project
    const pSprints = allSprints.filter(s => s.projectId === p.id);
    pSprints.forEach(sp => {
      const pos = getPositionPct(sp.startDate, sp.endDate);
      const row = document.createElement('div');
      row.className = 'roadmap-row';
      let barHtml = '';
      if (pos) {
        barHtml = `<div class="roadmap-bar sprint-bar" style="left: calc(${pos.left}% + 10px); width: calc(${pos.width}% - 20px);" onclick="selectProjectAndRedirect('${p.id}', 'board')">🏃 Sprint: ${escapeHTML(sp.name)}</div>`;
      }
      row.innerHTML = `
        <div class="roadmap-row-label" style="padding-left:1.5rem; font-size:0.75rem;">
          <i data-lucide="refresh-cw" style="width:12px; height:12px; color:#3b82f6; margin-right:0.3rem; vertical-align:middle;"></i>
          <span>${escapeHTML(sp.name)}</span>
        </div>
        <div class="roadmap-timeline-cells">${barHtml}</div>
      `;
      rowsContainer.appendChild(row);
    });
  });

  if (projects.length === 0) {
    rowsContainer.innerHTML = '<div style="text-align:center; padding:3rem; color:var(--color-text-muted);">ยังไม่มีโครงการในระบบ</div>';
  }
}

function renderHomeProjectCards() {
  const container = document.getElementById('home-project-cards-grid');
  if (!container) return;
  container.innerHTML = '';

  const allIssues = JSON.parse(localStorage.getItem('jira_issues') || '[]');
  const allSprints = JSON.parse(localStorage.getItem('jira_sprints') || '[]');

  projects.forEach(p => {
    const pIssues = allIssues.filter(i => i.projectId === p.id);
    const totalCount = pIssues.length;
    const doneCount = pIssues.filter(i => i.status === 'Done').length;
    const blockedCount = pIssues.filter(i => i.status === 'Blocked').length;
    const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    const activeSprint = allSprints.find(s => s.projectId === p.id && s.status === 'active');
    const sprintText = activeSprint ? `🏃 Active: ${activeSprint.name}` : '⚪ ไม่มี Active Sprint';

    const card = document.createElement('div');
    card.className = 'glassmorphism';
    card.style.padding = '1rem';
    card.style.borderRadius = '10px';
    card.style.border = '1px solid #dfe1e6';
    card.style.background = '#f4f5f7';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '0.5rem';

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <h5 style="margin:0; font-weight:700; color:var(--color-text); font-size:0.85rem; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:200px;" title="${escapeHTML(p.name)}">${escapeHTML(p.name)}</h5>
        <span style="font-size:0.65rem; color:#6366f1; background:rgba(99, 102, 241, 0.1); padding:0.15rem 0.4rem; border-radius:4px; font-weight:700;">ID: ${p.id}</span>
      </div>
      
      <div style="font-size:0.75rem; color:var(--color-text-muted);">
        <span>ความก้าวหน้าโครงการ: ${progress}%</span>
        <div style="background:rgba(0,0,0,0.08); height:8px; border-radius:4px; overflow:hidden; margin-top:0.25rem;">
          <div style="background:#10b981; width:${progress}%; height:100%; border-radius:4px;"></div>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--color-text-muted); margin-top:0.2rem;">
        <span>${sprintText}</span>
        <span style="color:#ef4444; font-weight:600;">⚠️ ติดขัด: ${blockedCount} ใบ</span>
      </div>

      <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--color-text-muted);">
        <span>เสร็จสิ้น: <strong style="color:var(--color-text);">${doneCount}/${totalCount} ใบ</strong></span>
      </div>

      <div style="display:flex; gap:0.4rem; margin-top:0.4rem;">
        <button class="btn btn-secondary btn-sm" onclick="selectProjectAndRedirect('${p.id}', 'roadmap')" style="flex:1; font-size:0.7rem; padding:0.3rem 0.5rem; border:1px solid #dfe1e6; background:#fff; color:var(--color-text); cursor:pointer; border-radius:4px;">แผนงาน (Roadmap)</button>
        <button class="btn btn-primary btn-sm" onclick="selectProjectAndRedirect('${p.id}', 'board')" style="flex:1; font-size:0.7rem; padding:0.3rem 0.5rem; border:none; background:#3b82f6; color:#fff; cursor:pointer; border-radius:4px;">บอร์ดคัมบัง</button>
      </div>
    `;
    container.appendChild(card);
  });
}

window.selectProjectAndRedirect = function(projId, tabId) {
  activeProjectId = projId;
  localStorage.setItem('jira_active_project_id', projId);
  
  const selector = document.getElementById('project-selector');
  if (selector) selector.value = projId;

  loadAllState();
  
  const tabBtn = document.getElementById(`tab-${tabId}`);
  if (tabBtn) tabBtn.click();
};

// ==========================================================================
// 3.6 PORTFOLIO CALENDAR RENDERING
// ==========================================================================
function renderCalendarView() {
  const titleEl = document.getElementById('calendar-month-year-title');
  const daysGrid = document.getElementById('calendar-days-grid');
  if (!titleEl || !daysGrid) return;

  // Set month title (Thai style)
  const monthName = currentCalendarDate.toLocaleString('th-TH', { month: 'long', year: 'numeric' });
  titleEl.textContent = monthName;

  // Clear previous grid cells
  daysGrid.innerHTML = '';

  // Get filter values
  const assigneeSelect = document.getElementById('calendar-assignee-filter');
  const projectSelect = document.getElementById('calendar-project-filter');
  const assigneeFilter = assigneeSelect ? assigneeSelect.value : '';
  const projectFilter = projectSelect ? projectSelect.value : '';

  // Get calendar date variables
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth(); // 0-indexed

  // First day of month and total days
  const firstDay = new Date(year, month, 1).getDay(); // Sunday=0, Monday=1, ...
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Load all issues from local storage
  const allIssues = JSON.parse(localStorage.getItem('jira_issues') || '[]');

  // Empty cells before first day of month
  for (let i = 0; i < firstDay; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.style.background = '#fcfcfc';
    emptyCell.style.borderBottom = '1px solid #dfe1e6';
    emptyCell.style.borderRight = '1px solid #dfe1e6';
    emptyCell.style.minHeight = '100px';
    daysGrid.appendChild(emptyCell);
  }

  // Draw day cells
  for (let day = 1; day <= totalDays; day++) {
    const cell = document.createElement('div');
    cell.style.background = '#fff';
    cell.style.borderBottom = '1px solid #dfe1e6';
    cell.style.borderRight = '1px solid #dfe1e6';
    cell.style.minHeight = '100px';
    cell.style.padding = '0.3rem';
    cell.style.display = 'flex';
    cell.style.flexDirection = 'column';
    cell.style.gap = '0.2rem';
    cell.style.position = 'relative';

    // Highlight today
    const today = new Date();
    if (today.getDate() === day && today.getMonth() === month && today.getFullYear() === year) {
      cell.style.background = 'rgba(99, 102, 241, 0.04)';
      cell.style.border = '2px solid #6366f1';
    }

    // Day number container
    const numDiv = document.createElement('div');
    numDiv.style.fontSize = '0.75rem';
    numDiv.style.fontWeight = '700';
    numDiv.style.color = 'var(--color-text-muted)';
    numDiv.style.textAlign = 'right';
    numDiv.textContent = day;
    cell.appendChild(numDiv);

    // Find issues active on this date or ending/due on this date
    const dayIssues = allIssues.filter(i => {
      // Filter by assignee
      if (assigneeFilter && i.assignee !== assigneeFilter) return false;
      // Filter by project
      if (projectFilter && i.projectId !== projectFilter) return false;

      // Dates matching logic
      if (!i.endDate) return false;
      const startD = i.startDate ? new Date(i.startDate) : null;
      const endD = new Date(i.endDate);

      // Normalize date objects to midnight for clean comparison
      const checkDate = new Date(year, month, day);
      checkDate.setHours(0,0,0,0);

      if (startD) {
        startD.setHours(0,0,0,0);
        endD.setHours(0,0,0,0);
        return checkDate >= startD && checkDate <= endD;
      } else {
        endD.setHours(0,0,0,0);
        return checkDate.getTime() === endD.getTime();
      }
    });

    // Draw task pills inside day cell
    dayIssues.forEach(i => {
      const proj = projects.find(p => p.id === i.projectId);
      const projShort = proj ? proj.name.substring(0, 5) : 'Proj';

      let bgColor = 'rgba(99, 102, 241, 0.1)';
      let textColor = '#6366f1';

      if (i.status === 'Done') {
        bgColor = 'rgba(16, 185, 129, 0.1)';
        textColor = '#10b981';
      } else if (i.status === 'Blocked') {
        bgColor = 'rgba(239, 68, 68, 0.1)';
        textColor = '#ef4444';
      }

      const pill = document.createElement('div');
      pill.style.fontSize = '0.62rem';
      pill.style.padding = '0.15rem 0.25rem';
      pill.style.borderRadius = '3px';
      pill.style.background = bgColor;
      pill.style.color = textColor;
      pill.style.textOverflow = 'ellipsis';
      pill.style.overflow = 'hidden';
      pill.style.whiteSpace = 'nowrap';
      pill.style.cursor = 'pointer';
      pill.style.fontWeight = '600';
      pill.title = `${projShort}: ${i.title} (${i.assignee || 'Unassigned'}) - ${i.status}`;
      pill.innerHTML = `<strong>${escapeHTML(projShort)}</strong>: ${escapeHTML(i.title)}`;

      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        selectProjectAndOpenDrawer(i.projectId, i.id);
      });

      cell.appendChild(pill);
    });

    daysGrid.appendChild(cell);
  }

  // Populate filter dropdowns if empty
  populateCalendarFilters();
}

function populateCalendarFilters() {
  const assigneeSelect = document.getElementById('calendar-assignee-filter');
  const projectSelect = document.getElementById('calendar-project-filter');
  if (!assigneeSelect || !projectSelect) return;

  const currentAssigneeVal = assigneeSelect.value;
  const currentProjectVal = projectSelect.value;

  assigneeSelect.innerHTML = '<option value="">👤 เลือกตาม Tester</option>';
  mockAssignees.forEach(name => {
    assigneeSelect.innerHTML += `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`;
  });

  projectSelect.innerHTML = '<option value="">📁 เลือกตามโครงการ</option>';
  projects.forEach(p => {
    projectSelect.innerHTML += `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)}</option>`;
  });

  assigneeSelect.value = currentAssigneeVal;
  projectSelect.value = currentProjectVal;
}

function setupCalendarControls() {
  const prevBtn = document.getElementById('calendar-prev-month-btn');
  const nextBtn = document.getElementById('calendar-next-month-btn');
  const assigneeSelect = document.getElementById('calendar-assignee-filter');
  const projectSelect = document.getElementById('calendar-project-filter');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
      renderCalendarView();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
      renderCalendarView();
    });
  }

  if (assigneeSelect) {
    assigneeSelect.addEventListener('change', () => {
      renderCalendarView();
    });
  }

  if (projectSelect) {
    projectSelect.addEventListener('change', () => {
      renderCalendarView();
    });
  }
}

window.selectProjectAndOpenDrawer = function(projId, issueId) {
  // Select project
  activeProjectId = projId;
  localStorage.setItem('jira_active_project_id', projId);
  const selector = document.getElementById('project-selector');
  if (selector) selector.value = projId;

  loadAllState();

  // Redirect to active board
  const tabBoard = document.getElementById('tab-board');
  if (tabBoard) {
    tabBoard.click();
    
    // Open drawer
    setTimeout(() => {
      const issue = issues.find(i => i.id === issueId);
      if (issue) openDrawer(issue);
    }, 200);
  }
};

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

        // If moved to Blocked, prompt for blocker reason
        if (status === 'Blocked' && !issue.blockerReason) {
          const reason = prompt("กรุณาระบุสาเหตุที่ติด Blocker:");
          issue.blockerReason = reason ? reason.trim() : "ติดปัญหา";
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

  // Populate tester dropdown filters
  populateTesterFilterOptions();

  // Filter issues in active sprint
  let boardIssues = issues.filter(i => i.sprintId === 'active-sprint');
  
  if (activeEpicFilter === 'my-issues') {
    boardIssues = boardIssues.filter(i => i.assignee && (i.assignee.includes("QA") || i.assignee.includes("สมชาย")));
  } else if (activeEpicFilter === 'blockers') {
    boardIssues = boardIssues.filter(i => i.status === 'Blocked' || i.priority === 'Highest' || (i.remark && i.remark.toLowerCase().includes('ติด')) || i.blockerReason);
  } else if (activeEpicFilter === 'ready-qa') {
    boardIssues = boardIssues.filter(i => i.status === 'In Review' || i.status === 'To Do');
  } else if (activeEpicFilter === 'due-soon') {
    const today = new Date();
    today.setHours(0,0,0,0);
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(today.getDate() + 2);
    twoDaysFromNow.setHours(23,59,59,999);
    
    boardIssues = boardIssues.filter(i => {
      if (!i.endDate) return false;
      const endD = new Date(i.endDate);
      return endD >= today && endD <= twoDaysFromNow;
    });
  } else if (activeEpicFilter) {
    boardIssues = boardIssues.filter(i => i.epicId === activeEpicFilter);
  }

  const testerFilterVal = document.getElementById('filter-tester-select').value;
  if (testerFilterVal) {
    boardIssues = boardIssues.filter(i => i.assignee === testerFilterVal);
  }

  const containers = {
    'To Do': document.getElementById('board-todo-container'),
    'In Progress': document.getElementById('board-inprogress-container'),
    'Blocked': document.getElementById('board-blocked-container'),
    'In Review': document.getElementById('board-review-container'),
    'Done': document.getElementById('board-done-container')
  };

  const counts = { 'To Do': 0, 'In Progress': 0, 'Blocked': 0, 'In Review': 0, 'Done': 0 };

  // Clear containers
  Object.values(containers).forEach(c => { if(c) c.innerHTML = ''; });

  boardIssues.forEach(i => {
    const col = i.status || 'To Do';
    if (containers[col]) {
      counts[col]++;
      
      let cardClasses = `kanban-card ${i.priority.toLowerCase()}`;
      if (col === 'Blocked') cardClasses += ' blocked-active';
      if (i.isHelpRequested) cardClasses += ' help-requested';

      const card = document.createElement('div');
      card.className = cardClasses;
      card.setAttribute('draggable', 'true');
      card.setAttribute('id', `board-card-${i.id}`);
      card.setAttribute('data-id', i.id);

      const assigneeInitials = i.assignee ? i.assignee.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() : 'UA';
      const capStatus = getTesterCapacityStatus(i.assignee);
      const statusIndicator = capStatus === 'overloaded' ? '🔴' : (i.assignee ? '🟢' : '⚪');

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="card-issue-key" onclick="openDefectDrawer('${i.id}')" style="cursor:pointer; font-weight:700; color:#3b82f6;">${i.id}</span>
          <span class="badge-status ${i.type.toLowerCase().replace(/[^a-zA-Z]/g, '-')}">${i.type}</span>
        </div>
        <h3 onclick="openDefectDrawer('${i.id}')" style="cursor:pointer;">${escapeHTML(i.title)}</h3>
        <div class="card-detail-text">${escapeHTML(i.detail || 'ไม่มีคำอธิบาย')}</div>
        
        <!-- Progress Bar -->
        <div style="margin-top:0.4rem; font-size:0.7rem; color:var(--color-text-muted);">
          <span>ความคืบหน้า: ${i.progress || 0}%</span>
          <div class="card-progress-bar-bg" title="ความคืบหน้า ${i.progress || 0}%">
            <div class="card-progress-bar-fill" style="width: ${i.progress || 0}%;"></div>
          </div>
        </div>

        <div class="card-dates-row" style="margin-top:0.4rem;">
          <span>เริ่ม: ${i.startDate || '-'}</span>
          <span>End: ${i.endDate || '-'}</span>
        </div>

        <!-- Blocker Reason & Help Request Badge -->
        ${col === 'Blocked' && i.blockerReason ? `<div style="font-size:0.72rem; background:rgba(239, 68, 68, 0.05); border:1px solid #ef4444; border-radius:6px; padding:0.3rem; margin-top:0.3rem; color:#ef4444; font-weight:700;">⚠️ Blocker: ${escapeHTML(i.blockerReason)}</div>` : ''}
        ${i.isHelpRequested ? `<div style="font-size:0.72rem; background:rgba(245, 158, 11, 0.1); border:1px solid #f59e0b; border-radius:6px; padding:0.3rem; margin-top:0.3rem; color:#f59e0b; font-weight:700; display:inline-flex; align-items:center; gap:0.2rem;"><i data-lucide="help-circle" style="width:12px; height:12px;"></i> ขอคนช่วย (Request Help)</div>` : ''}
        
        ${i.remark ? `<div class="card-remark" style="margin-top:0.4rem;">Remark: ${escapeHTML(i.remark)}</div>` : ''}

        <div class="card-footer-meta" style="margin-top:0.6rem; display:flex; justify-content:space-between; align-items:center;">
          <span class="badge-tag ${i.priority.toLowerCase()}">${i.priority}</span>
          
          <div style="display:flex; align-items:center; gap:0.4rem;">
            <!-- Quick Action Buttons -->
            <button onclick="toggleCardBlocked('${i.id}', event)" title="ติดธง/ยกเลิก Blocker" style="background:transparent; border:none; padding:0.15rem; cursor:pointer; color:${col === 'Blocked' ? '#ff5630' : '#8993a4'}; display:flex; align-items:center;">
              <i data-lucide="flag" style="width:12px; height:12px;"></i>
            </button>
            <button onclick="toggleCardHelp('${i.id}', event)" title="ขอคนช่วย/ยกเลิก" style="background:transparent; border:none; padding:0.15rem; cursor:pointer; color:${i.isHelpRequested ? '#ffab00' : '#8993a4'}; display:flex; align-items:center;">
              <i data-lucide="help-circle" style="width:12px; height:12px;"></i>
            </button>
            
            <span class="badge-count" style="font-size:0.65rem; background:rgba(0,0,0,0.06); padding:0.1rem 0.3rem; border-radius:4px;" title="เวลาทำจริง / แผนงาน">${i.actualHours || 0}h / ${i.estHours || 8}h</span>
            <div class="card-assignee-initials" style="position:relative;" title="${escapeHTML(i.assignee || 'Unassigned')} (${capStatus === 'overloaded' ? '🔴 งานล้น' : '🟢 ว่าง'})">
              ${assigneeInitials}
              <span style="font-size:0.5rem; vertical-align:middle; margin-left:0.1rem;">${statusIndicator}</span>
            </div>
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
  if (document.getElementById('count-todo')) document.getElementById('count-todo').textContent = counts['To Do'];
  if (document.getElementById('count-inprogress')) document.getElementById('count-inprogress').textContent = counts['In Progress'];
  if (document.getElementById('count-blocked')) document.getElementById('count-blocked').textContent = counts['Blocked'];
  if (document.getElementById('count-review')) document.getElementById('count-review').textContent = counts['In Review'];
  if (document.getElementById('count-done')) document.getElementById('count-done').textContent = counts['Done'];

  setupDragAndDropHandlers();
  if (window.lucide) window.lucide.createIcons();
}

// Tester Helper Functions
window.getTesterCapacityStatus = function(testerName) {
  if (!testerName) return '';
  const activeSprintIssues = issues.filter(i => i.sprintId === 'active-sprint' && i.assignee === testerName && i.status !== 'Done');
  const totalSP = activeSprintIssues.reduce((sum, i) => sum + (parseInt(i.sp, 10) || 0), 0);
  const activeTasksCount = activeSprintIssues.length;
  
  if (totalSP > 8 || activeTasksCount > 3) {
    return 'overloaded';
  }
  return 'available';
};

window.populateTesterFilterOptions = function() {
  const select = document.getElementById('filter-tester-select');
  if (!select) return;
  const currentVal = select.value;
  select.innerHTML = '<option value="">👤 Tester ทั้งหมด</option>';
  mockAssignees.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    const cap = getTesterCapacityStatus(name);
    opt.textContent = `${name} (${cap === 'overloaded' ? '🔴 ล้นงาน' : '🟢 ว่าง'})`;
    if (name === currentVal) opt.selected = true;
    select.appendChild(opt);
  });
};

window.toggleCardBlocked = function(issueId, event) {
  if (event) event.stopPropagation();
  const iss = issues.find(i => i.id === issueId);
  if (iss) {
    if (iss.status === 'Blocked') {
      iss.status = 'In Progress';
      iss.blockerReason = '';
    } else {
      iss.status = 'Blocked';
      const reason = prompt("กรุณาระบุสาเหตุที่ติด Blocker:");
      iss.blockerReason = reason ? reason.trim() : "ติดปัญหา";
    }
    saveGlobalState('issues', issues);
    renderActiveTab();
  }
};

window.toggleCardHelp = function(issueId, event) {
  if (event) event.stopPropagation();
  const iss = issues.find(i => i.id === issueId);
  if (iss) {
    iss.isHelpRequested = !iss.isHelpRequested;
    saveGlobalState('issues', issues);
    renderActiveTab();
  }
};

// ==========================================================================
// 6. DASHBOARD MANAGER (Burndown Chart & Stats calculation)
// ==========================================================================
function renderDashboardView() {
  renderStatusDonutChart();
  renderWorkloadBars();
  renderVelocityHistory();
  renderBurndownChart();
  renderBlockedTasksSummary();
}

function renderBlockedTasksSummary() {
  const container = document.getElementById('blocked-tasks-summary-container');
  if (!container) return;
  container.innerHTML = '';

  const blockedIssues = issues.filter(i => i.status === 'Blocked');
  if (blockedIssues.length === 0) {
    container.innerHTML = `
      <div style="grid-column: span 3; text-align:center; padding:1.5rem; background:#f4f5f7; border:1px dashed #dfe1e6; border-radius:8px;">
        <span style="font-size:0.8rem; color:var(--color-text-muted);"><i data-lucide="check-circle" style="width:15px; height:15px; color:#36b37e; vertical-align:middle; margin-right:0.3rem;"></i> ทีมงานกำลังทำงานอย่างราบรื่น ไม่มีงานใดติด Blocker ในเวลานี้</span>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  blockedIssues.forEach(i => {
    const card = document.createElement('div');
    card.style.background = 'rgba(239, 68, 68, 0.04)';
    card.style.border = '1px solid rgba(239, 68, 68, 0.2)';
    card.style.borderRadius = '8px';
    card.style.padding = '0.8rem';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '0.4rem';
    
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong style="color:#ff5630; font-size:0.8rem; cursor:pointer;" onclick="openDefectDrawer('${i.id}')">${i.id}</strong>
        <span style="font-size:0.65rem; color:var(--color-text-muted); background:rgba(0,0,0,0.05); padding:0.1rem 0.3rem; border-radius:4px;">${i.type}</span>
      </div>
      <h6 style="font-weight:700; color:var(--color-text); margin:0; font-size:0.8rem;">${escapeHTML(i.title)}</h6>
      <div style="font-size:0.75rem; color:#b91c1c; background:rgba(239, 68, 68, 0.08); border-radius:4px; padding:0.3rem; font-weight:600;">
        ⚠️ Blocker: ${escapeHTML(i.blockerReason || 'ไม่ได้ระบุสาเหตุ')}
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.7rem; color:var(--color-text-muted); margin-top:0.2rem;">
        <span>ผู้รับผิดชอบ: <strong>${escapeHTML(i.assignee || 'Unassigned')}</strong></span>
        <span>เวลาแผน: <strong>${i.estHours || 8} ชั่วโมง</strong></span>
      </div>
    `;
    container.appendChild(card);
  });
  if (window.lucide) window.lucide.createIcons();
}

function renderStatusDonutChart() {
  const container = document.getElementById('status-donut-chart');
  const legend = document.getElementById('status-donut-legend-list');
  if (!container || !legend) return;
  container.innerHTML = '';
  legend.innerHTML = '';

  const total = issues.length;
  if (total === 0) {
    container.innerHTML = '<div style="font-size:0.8rem; color:var(--color-text-muted);">ไม่มีข้อมูลสรุป</div>';
    return;
  }

  const counts = { 'To Do': 0, 'In Progress': 0, 'Blocked': 0, 'In Review': 0, 'Done': 0 };
  issues.forEach(i => {
    counts[i.status || 'To Do']++;
  });

  const todoPct = (counts['To Do'] / total) * 360;
  const ipPct = (counts['In Progress'] / total) * 360;
  const blockedPct = (counts['Blocked'] / total) * 360;
  const reviewPct = (counts['In Review'] / total) * 360;
  const donePct = (counts['Done'] / total) * 360;

  // Pie CSS conic gradient
  container.style.width = '120px';
  container.style.height = '120px';
  container.style.borderRadius = '50%';
  container.style.background = `conic-gradient(
    #64748b 0deg ${todoPct}deg,
    #eab308 ${todoPct}deg ${todoPct + ipPct}deg,
    #ef4444 ${todoPct + ipPct}deg ${todoPct + ipPct + blockedPct}deg,
    #a855f7 ${todoPct + ipPct + blockedPct}deg ${todoPct + ipPct + blockedPct + reviewPct}deg,
    #10b981 ${todoPct + ipPct + blockedPct + reviewPct}deg 360deg
  )`;
  container.style.position = 'relative';
  container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.15)';
  
  container.innerHTML = `
    <div style="position:absolute; width:70px; height:70px; background:#fff; border:1px solid #dfe1e6; border-radius:50%; top:25px; left:25px; display:flex; flex-direction:column; justify-content:center; align-items:center; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <span style="font-size:1.1rem; font-weight:700; color:var(--color-text);">${total}</span>
      <span style="font-size:0.55rem; color:var(--color-text-muted); text-transform:uppercase;">งานทั้งหมด</span>
    </div>
  `;

  const keys = [
    { label: 'Backlog / Plan', color: '#64748b', count: counts['To Do'] },
    { label: 'In Progress', color: '#eab308', count: counts['In Progress'] },
    { label: 'Blocked / Waiting', color: '#ef4444', count: counts['Blocked'] },
    { label: 'Lead Verify', color: '#a855f7', count: counts['In Review'] },
    { label: 'Done', color: '#10b981', count: counts['Done'] }
  ];

  keys.forEach(k => {
    const pct = total > 0 ? Math.round((k.count / total) * 100) : 0;
    legend.innerHTML += `
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; padding:0.2rem 0; border-bottom:1px solid rgba(0,0,0,0.05);">
        <span style="display:flex; align-items:center; gap:0.4rem;">
          <span style="width:7px; height:7px; border-radius:50%; background:${k.color}; display:inline-block;"></span>
          <span style="color:var(--color-text-muted);">${k.label}</span>
        </span>
        <strong style="color:var(--color-text);">${k.count} (${pct}%)</strong>
      </div>
    `;
  });
}

function renderWorkloadBars() {
  const container = document.getElementById('workload-bars-container');
  if (!container) return;
  container.innerHTML = '';

  const workloads = {};
  mockAssignees.forEach(name => workloads[name] = 0);
  workloads['Unassigned'] = 0;

  issues.forEach(i => {
    if (i.sprintId === 'active-sprint' && i.status !== 'Done') {
      const name = i.assignee || 'Unassigned';
      if (workloads[name] !== undefined) {
        workloads[name] += (i.sp || 3);
      } else {
        workloads[name] = (i.sp || 3);
      }
    }
  });

  const maxSP = Math.max(...Object.values(workloads), 1);

  Object.keys(workloads).forEach(name => {
    const sp = workloads[name];
    const pct = (sp / maxSP) * 100;
    const cap = getTesterCapacityStatus(name);
    const badge = cap === 'overloaded' ? '<span class="tester-status-badge overloaded">🔴 ล้นงาน (Overloaded)</span>' : (name !== 'Unassigned' ? '<span class="tester-status-badge available">🟢 พร้อม (Available)</span>' : '');

    container.innerHTML += `
      <div class="workload-bar-row" style="display:flex; align-items:center; gap:0.8rem; margin-bottom:0.4rem;">
        <div style="width:120px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; display:flex; flex-direction:column;">
          <strong style="color:var(--color-text); font-size:0.8rem;">${escapeHTML(name)}</strong>
          ${badge}
        </div>
        <div class="workload-bar-wrapper" style="flex:1; background:#e2e8f0; height:12px; border-radius:6px; overflow:hidden; position:relative;">
          <div class="workload-bar-fill" style="width: ${pct}%; background:${cap === 'overloaded' ? '#ff5630' : '#36b37e'}; height:100%; border-radius:6px; transition:width 0.3s ease;"></div>
        </div>
        <span style="font-weight:700; color:var(--color-text); text-align:right; width:60px; font-size:0.8rem;">${sp} SP</span>
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
      <div style="font-size:0.75rem; display:flex; flex-direction:column; gap:0.2rem; border-bottom:1px solid rgba(0,0,0,0.05); padding-bottom:0.4rem;">
        <div style="display:flex; justify-content:space-between;">
          <strong style="color:var(--color-text);">${escapeHTML(s.name)}</strong>
          <span style="color:var(--color-text-muted);">${completedSP} / ${totalSP} SP Completed</span>
        </div>
        <div style="background:rgba(0,0,0,0.05); height:8px; border-radius:4px; overflow:hidden; width:100%;">
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
    line.setAttribute("stroke", "rgba(0,0,0,0.06)");
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
    line.setAttribute("stroke", "rgba(0,0,0,0.04)");
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
  const issueEstHoursInput = document.getElementById('issue-est-hours-input');
  const issueActualHoursInput = document.getElementById('issue-actual-hours-input');
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
    issueTypeInput.value = 'Test Planning & Design';
    issuePriorityInput.value = 'High';
    issueSpInput.value = '3';
    if (issueEstHoursInput) issueEstHoursInput.value = '8';
    if (issueActualHoursInput) issueActualHoursInput.value = '0';
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
    const estVal = parseInt(issueEstHoursInput ? issueEstHoursInput.value : '8', 10) || 8;
    const actVal = parseInt(issueActualHoursInput ? issueActualHoursInput.value : '0', 10) || 0;

    if (id) {
      // Edit mode
      const iss = issues.find(i => i.id === id);
      if (iss) {
        iss.title = title;
        iss.type = issueTypeInput.value;
        iss.priority = issuePriorityInput.value;
        iss.sp = parseInt(issueSpInput.value, 10) || Math.ceil(estVal / 8) * 3;
        iss.estHours = estVal;
        iss.actualHours = actVal;
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
        sp: parseInt(issueSpInput.value, 10) || Math.ceil(estVal / 8) * 3,
        estHours: estVal,
        actualHours: actVal,
        progress: 0,
        isHelpRequested: false,
        blockerReason: "",
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

  // New Tester Fields
  const fieldEstHours = document.getElementById('drawer-est-hours-field');
  const fieldActualHours = document.getElementById('drawer-actual-hours-field');
  const fieldProgressSlider = document.getElementById('drawer-progress-slider');
  const labelProgressVal = document.getElementById('drawer-progress-val');
  const fieldHelpCheckbox = document.getElementById('drawer-help-checkbox');
  const fieldBlockerReason = document.getElementById('drawer-blocker-field');
  const groupBlocker = document.getElementById('drawer-blocker-group');

  const labelReporter = document.getElementById('drawer-reporter-label');
  const labelCreatedDate = document.getElementById('drawer-created-date-label');
  const subtasksList = document.getElementById('drawer-subtasks-list');
  const btnAddSubtask = document.getElementById('btn-add-subtask');

  const commentForm = document.getElementById('comment-add-form');
  const commentAuthor = document.getElementById('comment-author-input');
  const commentText = document.getElementById('comment-text-input');
  const commentsContainer = document.getElementById('drawer-comments-container');

  if (fieldProgressSlider && labelProgressVal) {
    fieldProgressSlider.addEventListener('input', (e) => {
      labelProgressVal.textContent = e.target.value;
    });
  }

  if (fieldStatus) {
    fieldStatus.addEventListener('change', () => {
      if (fieldStatus.value === 'Blocked') {
        if (groupBlocker) groupBlocker.style.display = 'block';
      } else {
        if (groupBlocker) groupBlocker.style.display = 'none';
      }
    });
  }

  window.openDefectDrawer = function(issueId) {
    const iss = issues.find(i => i.id === issueId);
    if (!iss) return;

    activeIssueForDrawer = issueId;

    // Set fields
    fieldKey.textContent = iss.id;
    fieldTypeBadge.textContent = iss.type;
    fieldTypeBadge.className = `badge-status ${iss.type.toLowerCase().replace(/[^a-zA-Z]/g, '-')}`;

    fieldTitle.value = iss.title;
    fieldDetail.value = iss.detail || '';
    fieldRemark.value = iss.remark || '';
    fieldStatus.value = iss.status || 'To Do';
    fieldAssignee.value = iss.assignee || '';
    fieldStartDate.value = iss.startDate || '';
    fieldEndDate.value = iss.endDate || '';
    fieldPriority.value = iss.priority || 'High';
    fieldSP.value = iss.sp || 0;

    // Tester specific values
    if (fieldEstHours) fieldEstHours.value = iss.estHours || 8;
    if (fieldActualHours) fieldActualHours.value = iss.actualHours || 0;
    if (fieldProgressSlider) {
      fieldProgressSlider.value = iss.progress || 0;
      if (labelProgressVal) labelProgressVal.textContent = iss.progress || 0;
    }
    if (fieldHelpCheckbox) fieldHelpCheckbox.checked = iss.isHelpRequested || false;
    if (fieldBlockerReason) fieldBlockerReason.value = iss.blockerReason || '';
    if (groupBlocker) {
      groupBlocker.style.display = iss.status === 'Blocked' ? 'block' : 'none';
    }

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

      // Save Tester Fields
      if (fieldEstHours) {
        iss.estHours = parseInt(fieldEstHours.value, 10) || 8;
        // Keep Story Points synced for compatibility (e.g. 8 hours = 3 SP)
        iss.sp = Math.ceil(iss.estHours / 8) * 3;
      }
      if (fieldActualHours) iss.actualHours = parseInt(fieldActualHours.value, 10) || 0;
      if (fieldProgressSlider) iss.progress = parseInt(fieldProgressSlider.value, 10) || 0;
      if (fieldHelpCheckbox) iss.isHelpRequested = fieldHelpCheckbox.checked;
      if (fieldBlockerReason) iss.blockerReason = fieldBlockerReason.value.trim();

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

// ==========================================================================
// 10. TEST CASE SUMMARY REPORT CONTROLS & RENDERING (Act-Budget Excel Feature)
// ==========================================================================
function setupSummaryControls() {
  const btnAdd = document.getElementById('btn-add-summary-row');
  const btnExport = document.getElementById('btn-export-summary-csv');
  const btnImport = document.getElementById('btn-import-summary-csv');
  const btnPrint = document.getElementById('btn-print-summary');
  const fileInput = document.getElementById('summary-file-input');

  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      const newIdNumber = (summaryData.length + 1).toString().padStart(3, '0');
      const newRow = {
        id: `ACTbudget-${newIdNumber}`,
        name: "โมดูลใหม่ / Feature",
        env: "UAT",
        assignedTo: "QA",
        status: "Not Start",
        total: 10,
        pass: 0,
        fail: 0,
        inprogress: 0,
        notStart: 10
      };
      summaryData.push(newRow);
      saveGlobalState('summary', summaryData);
      renderSummaryView();
    });
  }

  if (btnExport) {
    btnExport.addEventListener('click', exportSummaryCSV);
  }

  if (btnImport && fileInput) {
    btnImport.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', importSummaryCSV);
  }

  if (btnPrint) {
    btnPrint.addEventListener('click', () => window.print());
  }
}

function renderSummaryView() {
  const tbody = document.getElementById('summary-table-body');
  const tfoot = document.getElementById('summary-table-foot');
  if (!tbody || !tfoot) return;

  tbody.innerHTML = '';
  tfoot.innerHTML = '';

  let totalExecuteSum = 0;
  let passSum = 0;
  let failSum = 0;
  let inprogressSum = 0;
  let notStartSum = 0;

  summaryData.forEach((row, index) => {
    totalExecuteSum += (parseInt(row.total, 10) || 0);
    passSum += (parseInt(row.pass, 10) || 0);
    failSum += (parseInt(row.fail, 10) || 0);
    inprogressSum += (parseInt(row.inprogress, 10) || 0);
    notStartSum += (parseInt(row.notStart, 10) || 0);

    const passRatePct = row.total > 0 ? ((row.pass / row.total) * 100).toFixed(2) : '0.00';

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #dfe1e6';
    tr.style.background = index % 2 === 0 ? '#fff' : '#f4f5f7';

    tr.innerHTML = `
      <td style="padding:0.4rem 0.6rem; border:1px solid #dfe1e6;">
        <input type="text" value="${escapeHTML(row.id)}" onchange="updateSummaryField(${index}, 'id', this.value)" style="width:100%; background:transparent; border:none; color:#3b82f6; font-weight:600; font-size:0.8rem;">
      </td>
      <td style="padding:0.4rem 0.6rem; border:1px solid #dfe1e6;">
        <input type="text" value="${escapeHTML(row.name)}" onchange="updateSummaryField(${index}, 'name', this.value)" style="width:100%; background:transparent; border:none; color:var(--color-text); font-size:0.8rem;">
      </td>
      <td style="padding:0.4rem 0.6rem; border:1px solid #dfe1e6;">
        <input type="text" value="${escapeHTML(row.env || 'UAT')}" onchange="updateSummaryField(${index}, 'env', this.value)" style="width:100%; background:transparent; border:none; color:var(--color-text-muted); font-size:0.8rem;">
      </td>
      <td style="padding:0.4rem 0.6rem; border:1px solid #dfe1e6;">
        <input type="text" value="${escapeHTML(row.assignedTo || '')}" onchange="updateSummaryField(${index}, 'assignedTo', this.value)" style="width:100%; background:transparent; border:none; color:var(--color-text-muted); font-size:0.8rem;">
      </td>
      <td style="padding:0.4rem 0.6rem; border:1px solid #dfe1e6;">
        <select onchange="updateSummaryField(${index}, 'status', this.value)" style="width:100%; background:#fff; border:1px solid #dfe1e6; color:var(--color-text); padding:0.2rem; font-size:0.75rem; border-radius:4px;">
          <option value="Pass" ${row.status === 'Pass' ? 'selected' : ''}>Pass</option>
          <option value="In Progress" ${row.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
          <option value="Not Start" ${row.status === 'Not Start' ? 'selected' : ''}>Not Start</option>
          <option value="Fail" ${row.status === 'Fail' ? 'selected' : ''}>Fail</option>
        </select>
      </td>
      <td style="padding:0.4rem 0.6rem; border:1px solid #dfe1e6; text-align:center;">
        <input type="number" min="0" value="${row.total || 0}" onchange="updateSummaryField(${index}, 'total', parseInt(this.value, 10))" style="width:100%; text-align:center; background:transparent; border:none; color:var(--color-text); font-weight:600; font-size:0.8rem;">
      </td>
      <td style="padding:0.4rem 0.6rem; border:1px solid #dfe1e6; text-align:center;">
        <input type="number" min="0" value="${row.pass || 0}" onchange="updateSummaryField(${index}, 'pass', parseInt(this.value, 10))" style="width:100%; text-align:center; background:transparent; border:none; color:#10b981; font-weight:600; font-size:0.8rem;">
      </td>
      <td style="padding:0.4rem 0.6rem; border:1px solid #dfe1e6; text-align:center;">
        <input type="number" min="0" value="${row.fail || 0}" onchange="updateSummaryField(${index}, 'fail', parseInt(this.value, 10))" style="width:100%; text-align:center; background:transparent; border:none; color:#ef4444; font-weight:600; font-size:0.8rem;">
      </td>
      <td style="padding:0.4rem 0.6rem; border:1px solid #dfe1e6; text-align:center;">
        <input type="number" min="0" value="${row.inprogress || 0}" onchange="updateSummaryField(${index}, 'inprogress', parseInt(this.value, 10))" style="width:100%; text-align:center; background:transparent; border:none; color:#f59e0b; font-weight:600; font-size:0.8rem;">
      </td>
      <td style="padding:0.4rem 0.6rem; border:1px solid #dfe1e6; text-align:center;">
        <input type="number" min="0" value="${row.notStart || 0}" onchange="updateSummaryField(${index}, 'notStart', parseInt(this.value, 10))" style="width:100%; text-align:center; background:transparent; border:none; color:#64748b; font-weight:600; font-size:0.8rem;">
      </td>
      <td style="padding:0.4rem 0.6rem; border:1px solid #dfe1e6; text-align:center; font-weight:700; color:#a855f7;">
        ${passRatePct}%
      </td>
      <td style="padding:0.4rem 0.6rem; border:1px solid #dfe1e6; text-align:center;">
        <button class="btn btn-defect btn-icon-sm" onclick="deleteSummaryRow(${index})" style="padding:0.2rem 0.35rem; background:#ff5630; border:none; color:#fff;" title="ลบแถว">
          <i data-lucide="trash-2" style="width:12px; height:12px;"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Calculate Overall Totals
  const overallPassRatePct = totalExecuteSum > 0 ? ((passSum / totalExecuteSum) * 100).toFixed(2) : '0.00';
  const notStartPct = totalExecuteSum > 0 ? ((notStartSum / totalExecuteSum) * 100).toFixed(2) : '0.00';

  tfoot.innerHTML = `
    <tr>
      <td colspan="5" style="padding:0.6rem; border:1px solid var(--glass-border); text-align:right;">TOTAL (สรุปรวมทั้งหมด):</td>
      <td style="padding:0.6rem; border:1px solid var(--glass-border); text-align:center; color:#3b82f6;">${totalExecuteSum}</td>
      <td style="padding:0.6rem; border:1px solid var(--glass-border); text-align:center; color:#10b981;">${passSum}</td>
      <td style="padding:0.6rem; border:1px solid var(--glass-border); text-align:center; color:#ef4444;">${failSum}</td>
      <td style="padding:0.6rem; border:1px solid var(--glass-border); text-align:center; color:#f59e0b;">${inprogressSum}</td>
      <td style="padding:0.6rem; border:1px solid var(--glass-border); text-align:center; color:#94a3b8;">${notStartSum}</td>
      <td style="padding:0.6rem; border:1px solid var(--glass-border); text-align:center; color:#a855f7;">${overallPassRatePct}%</td>
      <td style="padding:0.6rem; border:1px solid var(--glass-border);"></td>
    </tr>
  `;

  // Update KPI Cards
  const kpiTotal = document.getElementById('kpi-total-execute');
  const kpiPassed = document.getElementById('kpi-passed');
  const kpiNotStart = document.getElementById('kpi-not-start');
  const kpiPassRate = document.getElementById('kpi-pass-rate');

  if (kpiTotal) kpiTotal.textContent = totalExecuteSum;
  if (kpiPassed) kpiPassed.innerHTML = `${passSum} <span style="font-size:0.85rem; font-weight:normal;">(${overallPassRatePct}%)</span>`;
  if (kpiNotStart) kpiNotStart.innerHTML = `${notStartSum} <span style="font-size:0.85rem; font-weight:normal;">(${notStartPct}%)</span>`;
  if (kpiPassRate) kpiPassRate.textContent = `${overallPassRatePct}%`;

  if (window.lucide) window.lucide.createIcons();
}

window.updateSummaryField = function(index, field, value) {
  if (summaryData[index]) {
    summaryData[index][field] = value;
    saveGlobalState('summary', summaryData);
    renderSummaryView();
  }
};

window.deleteSummaryRow = function(index) {
  if (confirm("คุณต้องการลบรายการแถวนี้ใช่หรือไม่?")) {
    summaryData.splice(index, 1);
    saveGlobalState('summary', summaryData);
    renderSummaryView();
  }
};

function exportSummaryCSV() {
  let csv = "TC ID,Test Case Name,Environment,Assigned To,Status,Total Execute,Pass,Fail,Inprogress,Not Start,Pass Rate (%)\r\n";
  summaryData.forEach(row => {
    const rate = row.total > 0 ? ((row.pass / row.total) * 100).toFixed(2) : '0.00';
    csv += `"${row.id}","${row.name.replace(/"/g, '""')}","${row.env || 'UAT'}","${row.assignedTo || ''}","${row.status}",${row.total || 0},${row.pass || 0},${row.fail || 0},${row.inprogress || 0},${row.notStart || 0},"${rate}%"\r\n`;
  });
  downloadCSV(csv, `TestCase_Summary_Report_${activeProjectId}.csv`);
}

function importSummaryCSV(evt) {
  const file = evt.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    try {
      if (file.name.endsWith('.json')) {
        summaryData = JSON.parse(text);
      } else {
        // Parse CSV
        const lines = text.split(/\r\n|\n/);
        const parsed = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
          if (cols.length >= 5) {
            parsed.push({
              id: cols[0] || `TC-${i}`,
              name: cols[1] || 'Test Case',
              env: cols[2] || 'UAT',
              assignedTo: cols[3] || '',
              status: cols[4] || 'Not Start',
              total: parseInt(cols[5], 10) || 0,
              pass: parseInt(cols[6], 10) || 0,
              fail: parseInt(cols[7], 10) || 0,
              inprogress: parseInt(cols[8], 10) || 0,
              notStart: parseInt(cols[9], 10) || 0
            });
          }
        }
        if (parsed.length > 0) summaryData = parsed;
      }
      saveGlobalState('summary', summaryData);
      renderSummaryView();
      alert("นำเข้าข้อมูล Test Case Summary สำเร็จเรียบร้อย!");
    } catch (err) {
      alert("อ่านไฟล์นำเข้าผิดพลาด: " + err.message);
    }
  };
  reader.readAsText(file);
}
