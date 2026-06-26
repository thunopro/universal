const TARGET_CATEGORIES = ['dp', 'tree', 'graph', 'math', 'geometry', 'interactive', 'string'];
let globalProblems = [];
let groupedProblems = {};
let currentActiveCategory = 'dp';
let problemPages = {};

const DOM = {
    categoryNav: document.getElementById('categoryNav'),
    problemList: document.getElementById('problemList'),
    currentCategoryTitle: document.getElementById('currentCategoryTitle'),
    currentCategoryDesc: document.getElementById('currentCategoryDesc'),
    totalProblems: document.getElementById('totalProblems'),
    refreshBtn: document.getElementById('refreshBtn')
};

// Initialize
async function init() {
    setupEventListeners();
    await loadPdfIndex();
    await loadAllCSVs();
}

async function loadPdfIndex() {
    try {
        const res = await fetch('statements_pages.json');
        if (res.ok) {
            problemPages = await res.json();
        }
    } catch (e) {
        console.error('Failed to load PDF index', e);
    }
}

function setupEventListeners() {
    DOM.refreshBtn.addEventListener('click', loadAllCSVs);
}

// Fetch and Parse CSVs
async function loadAllCSVs() {
    DOM.problemList.innerHTML = `
        <div class="empty-state">
            <div class="spinner"></div>
            <p>Loading your tagged problems from Season 2, 3, 4...</p>
        </div>
    `;
    
    globalProblems = [];
    const files = [
        'Universal_Cup_Season_2.csv',
        'Universal_Cup_Season_3.csv',
        'Universal_Cup_Season_4.csv'
    ];

    try {
        for (const file of files) {
            const response = await fetch(file);
            if (!response.ok) continue; // If file doesn't exist or error
            const csvText = await response.text();
            
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    processRows(results.data);
                }
            });
        }
        
        filterAndGroupProblems();
        renderSidebar();
        renderProblems(currentActiveCategory);
        
    } catch (e) {
        DOM.problemList.innerHTML = `
            <div class="empty-state">
                <p>Error loading CSVs: ${e.message}</p>
                <p>Make sure you are running a local server (e.g. python3 -m http.server).</p>
            </div>
        `;
    }
}

function processRows(rows) {
    for (const row of rows) {
        if (!row.Stage || !row.Problem) continue;
        
        // Extract tag, convert to lowercase, trim
        const rawTag = (row.Tag || '').trim().toLowerCase();
        
        // Filter empty or 'erase'
        if (!rawTag || rawTag === 'erase') continue;
        
        // Parse AC count safely
        const acCount = parseInt(row.AC_Count) || 0;
        
        globalProblems.push({
            stage: row.Stage,
            problem: row.Problem,
            acCount: acCount,
            tag: rawTag
        });
    }
}

function filterAndGroupProblems() {
    // Reset groups
    groupedProblems = {};
    TARGET_CATEGORIES.forEach(cat => groupedProblems[cat] = []);
    
    let totalValid = 0;
    
    // Group
    for (const p of globalProblems) {
        // If tag is exactly one of our targets or contains it
        let matchedCat = null;
        for (const target of TARGET_CATEGORIES) {
            if (p.tag.includes(target)) {
                matchedCat = target;
                break;
            }
        }
        
        if (matchedCat) {
            groupedProblems[matchedCat].push(p);
            totalValid++;
        }
    }
    
    // Sort each group by AC_Count descending
    for (const cat of TARGET_CATEGORIES) {
        groupedProblems[cat].sort((a, b) => b.acCount - a.acCount);
    }
    
    DOM.totalProblems.innerText = totalValid;
}

function renderSidebar() {
    DOM.categoryNav.innerHTML = '';
    
    TARGET_CATEGORIES.forEach(cat => {
        const count = groupedProblems[cat].length;
        const div = document.createElement('div');
        div.className = `nav-item ${cat === currentActiveCategory ? 'active' : ''}`;
        div.onclick = () => switchCategory(cat);
        
        const nameSpan = document.createElement('span');
        nameSpan.innerText = cat.toUpperCase();
        
        const countSpan = document.createElement('span');
        countSpan.className = 'tag-count';
        countSpan.innerText = count;
        
        div.appendChild(nameSpan);
        div.appendChild(countSpan);
        DOM.categoryNav.appendChild(div);
    });
}

function switchCategory(cat) {
    currentActiveCategory = cat;
    renderSidebar(); // Update active state
    renderProblems(cat);
}

function getDifficultyClass(acCount) {
    if (acCount >= 100) return 'diff-easy';
    if (acCount >= 10) return 'diff-med';
    return 'diff-hard';
}

function getDifficultyText(acCount) {
    if (acCount >= 100) return 'EASY';
    if (acCount >= 10) return 'MEDIUM';
    return 'HARD';
}

function formatStageName(stage) {
    const parts = stage.split('-');
    if (parts.length >= 3) {
        return `Univ ${parts[1]} Stage ${parts[2]}`;
    }
    return stage;
}

function renderProblems(cat) {
    DOM.currentCategoryTitle.innerText = cat;
    
    const problems = groupedProblems[cat];
    
    if (!problems || problems.length === 0) {
        DOM.currentCategoryDesc.innerText = `No problems tagged with '${cat}' yet.`;
        DOM.problemList.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" width="48" height="48" stroke="rgba(255,255,255,0.2)" stroke-width="2" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <p style="margin-top: 16px;">It's empty here. Add some tags in your CSV!</p>
            </div>
        `;
        return;
    }
    
    DOM.currentCategoryDesc.innerText = `Showing ${problems.length} problems sorted from easiest to hardest.`;
    
    let html = '<div class="problem-grid">';
    
    problems.forEach(p => {
        const diffClass = getDifficultyClass(p.acCount);
        const diffText = getDifficultyText(p.acCount);
        const season = p.stage.split('-')[1];
        let pdfPath = `UniversalCup_Statements/Season_${season}/${p.stage}.pdf`;
        
        const stagePages = problemPages[p.stage];
        if (stagePages && stagePages[p.problem.toUpperCase()]) {
            const pageNum = stagePages[p.problem.toUpperCase()];
            pdfPath += `#page=${pageNum}`;
        }
        
        const formattedStage = formatStageName(p.stage);
        
        html += `
            <div class="problem-card">
                <div class="card-top">
                    <span class="stage-badge">${formattedStage}</span>
                    <div class="ac-badge ${diffClass}">
                        <div class="ac-icon"></div>
                        ${p.acCount} AC
                    </div>
                </div>
                <h3 class="problem-title">Problem ${p.problem}</h3>
                <div class="card-actions">
                    <span class="tag-label ${cat}">${cat}</span>
                    <span style="font-size: 12px; color: var(--text-secondary);">${diffText}</span>
                </div>
                <button class="view-statement-btn" onclick="openStatement('${pdfPath}', '${formattedStage} - Problem ${p.problem}')">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Read Statement
                </button>
            </div>
        `;
    });
    
    html += '</div>';
    DOM.problemList.innerHTML = html;
}

// Modal View Controls
const pdfModal = document.getElementById('pdfModal');
const pdfFrame = document.getElementById('pdfFrame');
const modalTitle = document.getElementById('modalTitle');
const closeModalBtn = document.getElementById('closeModalBtn');

function openStatement(pdfUrl, title) {
    pdfFrame.src = pdfUrl;
    modalTitle.innerText = title;
    pdfModal.classList.add('active');
}

function closeStatement() {
    pdfModal.classList.remove('active');
    pdfFrame.src = '';
}

if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeStatement);
}
if (pdfModal) {
    pdfModal.addEventListener('click', (e) => {
        if (e.target === pdfModal) {
            closeStatement();
        }
    });
}

// Start app
window.onload = init;

