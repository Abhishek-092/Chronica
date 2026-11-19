// Chronica Application Controller - Interactive Multi-Page Architecture

let currentRepoId = 'repo-cherry-pick-workbench';
let repo = new ChronicaRepository();
let activeFile = '';
let activeView = 'three-way';
let selectedIncomingBranch = '';
let activeResolutions = {};
let currentSimulationReport = null;

// Graph inspection state
let activeGraphCommitHash = '';
let activeGraphDiffFile = '';

// Cherry-pick state
let cherryPickSelectedHashes = new Set();
let cherryPickRangeStart = null;
let cherryPickRangeEnd = null;
let cherryPickSelectedBranch = '';
let lastCheckedCommitIndex = -1;

// -----------------------------------------------------------------
// PAGE ROUTING
// -----------------------------------------------------------------
function navigateTo(hash) {
    if (!hash || hash === '#' || hash === '#repositories') {
        showPage('page-repositories');
        window.location.hash = '#repositories';
        renderRepositoriesPage();
        return;
    }

    const parts = hash.replace(/^#/, '').split('/');
    if (parts[0] === 'repo') {
        const repoId = parts[1] || currentRepoId;
        const pageTab = parts[2] || 'code';

        if (repoId !== currentRepoId) {
            selectRepository(repoId, false);
        }

        updateRepoSubheader();
        showPage(`page-${pageTab}`);
        setActiveTab(pageTab);

        if (pageTab === 'code') {
            updateFileList();
            renderCodeView();
        } else if (pageTab === 'graph') {
            renderCommitGraph();
        } else if (pageTab === 'merge') {
            setupMergeView();
            renderThreeWayDiff();
        } else if (pageTab === 'cherry-pick') {
            renderCherryPickStudio();
        }
    }
}

function showPage(pageId) {
    document.querySelectorAll('.view-page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(pageId);
    if (target) target.classList.add('active');

    const subheader = document.getElementById('repo-subheader-bar');
    if (subheader) {
        if (pageId === 'page-repositories') {
            subheader.style.display = 'none';
        } else {
            subheader.style.display = 'block';
        }
    }
}

function setActiveTab(tabName) {
    document.querySelectorAll('.tab-item').forEach(t => {
        if (t.getAttribute('data-tab') === tabName) {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });
}

function showToast(msg) {
    const toast = document.getElementById('toast-msg');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3200);
}

function selectRepository(repoId, redirect = true) {
    currentRepoId = repoId;
    activeResolutions = {};
    currentSimulationReport = null;
    cherryPickSelectedHashes.clear();
    cherryPickRangeStart = null;
    cherryPickRangeEnd = null;
    activeGraphCommitHash = '';
    activeGraphDiffFile = '';

    ChronicaCatalog.loadRepository(repoId, repo);

    const catalogList = ChronicaCatalog.getRepositoryList();
    const meta = catalogList.find(c => c.id === repoId);
    if (meta) {
        selectedIncomingBranch = meta.targetBranch;
        cherryPickSelectedBranch = meta.targetBranch;
    }

    const files = repo.list_files ? repo.list_files() : Object.keys(repo.workingTree);
    activeFile = files.length > 0 ? files[0] : '';

    if (redirect) {
        window.location.hash = `#repo/${repoId}/code`;
    }
}

function updateRepoSubheader() {
    const catalogList = ChronicaCatalog.getRepositoryList();
    const meta = catalogList.find(c => c.id === currentRepoId);
    if (!meta) return;

    const nameEl = document.getElementById('current-repo-name-label');
    if (nameEl) nameEl.textContent = meta.name;

    const caseBadge = document.getElementById('current-repo-case-badge');
    if (caseBadge) {
        caseBadge.textContent = meta.caseType;
        caseBadge.className = `badge ${meta.badgeClass}`;
    }

    const commitCountEl = document.getElementById('tab-commits-count');
    if (commitCountEl) {
        commitCountEl.textContent = Object.keys(repo.commits).length;
    }
}

// -----------------------------------------------------------------
// PAGE 1: REPOSITORIES LISTING
// -----------------------------------------------------------------
function renderRepositoriesPage() {
    const container = document.getElementById('repo-catalog-container');
    if (!container) return;
    container.innerHTML = '';

    const repos = ChronicaCatalog.getRepositoryList();
    const filterInput = document.getElementById('repo-search-input');
    const query = filterInput ? filterInput.value.toLowerCase().trim() : '';

    const filtered = repos.filter(r => 
        r.name.toLowerCase().includes(query) || 
        r.title.toLowerCase().includes(query) || 
        r.caseType.toLowerCase().includes(query)
    );

    filtered.forEach(item => {
        const tempRepo = new ChronicaRepository();
        ChronicaCatalog.loadRepository(item.id, tempRepo);
        const branchCount = Object.keys(tempRepo.branches).length;
        const commitCount = Object.keys(tempRepo.commits).length;
        const fileCount = Object.keys(tempRepo.commits[tempRepo.headCommit]?.files || {}).length;

        const row = document.createElement('div');
        row.className = 'repo-row-item';
        row.innerHTML = `
            <div class="repo-meta-col">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <a class="repo-name-link" data-id="${item.id}">${item.name}</a>
                    <span class="badge ${item.badgeClass}">${item.caseType}</span>
                </div>
                <div class="repo-desc-text">${item.desc}</div>
                <div class="repo-stats-row">
                    <span>Default: <strong style="font-family: var(--font-mono);">${item.defaultBranch}</strong></span>
                    <span>${branchCount} branches</span>
                    <span>${commitCount} commits</span>
                    <span>${fileCount} files</span>
                </div>
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn btn-sm btn-action" data-id="${item.id}" data-page="code">Explore Code</button>
                <button class="btn btn-sm ${item.caseType === 'Cherry-Pick' ? 'btn-primary' : ''}" data-id="${item.id}" data-page="cherry-pick">Cherry-Pick Studio</button>
                <button class="btn btn-sm" data-id="${item.id}" data-page="merge">Merge</button>
            </div>
        `;

        row.querySelectorAll('[data-id]').forEach(btn => {
            btn.onclick = () => {
                const rId = btn.getAttribute('data-id');
                const page = btn.getAttribute('data-page') || 'code';
                currentRepoId = rId;
                ChronicaCatalog.loadRepository(rId, repo);
                const catalogList = ChronicaCatalog.getRepositoryList();
                const m = catalogList.find(c => c.id === rId);
                if (m) {
                    selectedIncomingBranch = m.targetBranch;
                    cherryPickSelectedBranch = m.targetBranch;
                }
                window.location.hash = `#repo/${rId}/${page}`;
            };
        });

        container.appendChild(row);
    });
}

// -----------------------------------------------------------------
// PAGE 2: CODE & FILES VIEW
// -----------------------------------------------------------------
function updateFileList() {
    const treeContainer = document.getElementById('code-file-tree');
    if (!treeContainer) return;
    treeContainer.innerHTML = '';

    const curCommit = repo.commits[repo.headCommit];
    const files = new Set();
    if (curCommit) Object.keys(curCommit.files).forEach(f => files.add(f));
    Object.keys(repo.workingTree).forEach(f => files.add(f));

    const fileList = Array.from(files).sort();
    if (!fileList.includes(activeFile) && fileList.length > 0) {
        activeFile = fileList[0];
    }

    fileList.forEach(path => {
        const item = document.createElement('div');
        item.className = `file-item-entry ${path === activeFile ? 'active' : ''}`;
        item.innerHTML = `
            <span>${path}</span>
            <span style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">${getFileSize(path)} lines</span>
        `;
        item.onclick = () => {
            activeFile = path;
            updateFileList();
            renderCodeView();
        };
        treeContainer.appendChild(item);
    });
}

function getFileSize(path) {
    const curCommit = repo.commits[repo.headCommit];
    const text = curCommit && curCommit.files[path] ? repo.getBlob(curCommit.files[path]) : (repo.workingTree[path] || '');
    return text.split('\n').length;
}

function renderCodeView() {
    const titleEl = document.getElementById('code-active-file-title');
    const textarea = document.getElementById('code-file-editor');
    const branchSelector = document.getElementById('code-branch-selector');

    if (branchSelector) {
        branchSelector.innerHTML = '';
        Object.keys(repo.branches).forEach(b => {
            const opt = document.createElement('option');
            opt.value = b;
            opt.textContent = b;
            if (b === repo.currentBranch) opt.selected = true;
            branchSelector.appendChild(opt);
        });
        branchSelector.onchange = (e) => {
            repo.checkout(e.target.value);
            updateFileList();
            renderCodeView();
            showToast(`Switched to branch: ${e.target.value}`);
        };
    }

    if (titleEl) titleEl.textContent = activeFile || 'No files tracked';

    if (textarea) {
        const curCommit = repo.commits[repo.headCommit];
        const text = curCommit && curCommit.files[activeFile] ? repo.getBlob(curCommit.files[activeFile]) : (repo.workingTree[activeFile] || '');
        textarea.value = text;
    }
}

// -----------------------------------------------------------------
// PAGE 3: COMMIT GRAPH (DAG) - INTERACTIVE WORKBENCH
// -----------------------------------------------------------------
function renderCommitGraph() {
    const canvas = document.getElementById('dag-canvas');
    const rowsContainer = document.getElementById('graph-commit-rows-list');
    const branchBadge = document.getElementById('graph-branch-badge');
    if (!canvas || !rowsContainer) return;

    if (branchBadge) {
        branchBadge.textContent = repo.currentBranch;
    }

    const nodes = repo.buildCommitGraph();
    if (!activeGraphCommitHash && nodes.length > 0) {
        activeGraphCommitHash = repo.headCommit || nodes[0].hash;
    }

    const rowHeight = 48;
    const laneWidth = 24;
    const padX = 24;
    const padY = 24;

    canvas.width = 220;
    canvas.height = Math.max(240, nodes.length * rowHeight);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const laneColors = ['#2563eb', '#10b981', '#7c3aed', '#d97706', '#dc2626'];
    const positions = {};

    nodes.forEach((n, idx) => {
        const x = padX + (n.lane * laneWidth);
        const y = padY + (idx * rowHeight);
        positions[n.hash] = { x, y, lane: n.lane, idx };
    });

    // 1. Draw parent connection curves
    nodes.forEach(n => {
        const from = positions[n.hash];
        if (!from) return;

        n.parents.forEach(pHash => {
            const to = positions[pHash];
            if (!to) return;

            ctx.beginPath();
            ctx.strokeStyle = laneColors[from.lane % laneColors.length];
            ctx.lineWidth = 2.5;

            if (from.x === to.x) {
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(to.x, to.y);
            } else {
                ctx.moveTo(from.x, from.y);
                const midY = (from.y + to.y) / 2;
                ctx.bezierCurveTo(from.x, midY, to.x, midY, to.x, to.y);
            }
            ctx.stroke();
        });
    });

    // 2. Draw commit nodes on canvas
    nodes.forEach(n => {
        const pos = positions[n.hash];
        const color = laneColors[n.lane % laneColors.length];
        const isActive = (n.hash === activeGraphCommitHash);

        if (isActive) {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(37, 99, 235, 0.2)';
            ctx.fill();
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = n.isHead ? '#ffffff' : color;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        if (n.isHead) {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#2563eb';
            ctx.fill();
        }
    });

    // 3. Render synchronized interactive commit rows
    rowsContainer.innerHTML = '';
    nodes.forEach(n => {
        const row = document.createElement('div');
        row.className = `graph-commit-row ${n.hash === activeGraphCommitHash ? 'active' : ''}`;
        row.setAttribute('data-hash', n.hash);

        let branchTagsHtml = '';
        if (n.branches && n.branches.length > 0) {
            branchTagsHtml = n.branches.map(b => `<span class="badge ${b === repo.currentBranch ? 'badge-green' : 'badge-purple'}" style="font-size: 10px;">${b}</span>`).join(' ');
        }
        if (n.isHead) {
            branchTagsHtml += ` <span class="badge badge-blue" style="font-size: 10px;">HEAD</span>`;
        }

        row.innerHTML = `
            <div style="font-family: var(--font-mono); font-weight: 600; color: var(--primary-blue); width: 75px;">${n.shortHash}</div>
            <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(n.message)}</span>
                    ${branchTagsHtml}
                </div>
                <div style="font-size: 11px; color: var(--text-muted);">${n.author} · ${new Date(n.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
            <div>
                <button class="btn btn-sm btn-select-node" data-hash="${n.hash}">Inspect</button>
            </div>
        `;

        row.onclick = () => {
            activeGraphCommitHash = n.hash;
            activeGraphDiffFile = '';
            renderCommitGraph();
        };

        rowsContainer.appendChild(row);
    });

    // Canvas click selects closest node
    canvas.onclick = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        const rowIdx = Math.floor((clickY - padY + (rowHeight / 2)) / rowHeight);
        if (rowIdx >= 0 && rowIdx < nodes.length) {
            activeGraphCommitHash = nodes[rowIdx].hash;
            activeGraphDiffFile = '';
            renderCommitGraph();
        }
    };

    renderGraphCommitInspector();
}

function renderGraphCommitInspector() {
    const container = document.getElementById('graph-inspector-content');
    const shortLabel = document.getElementById('inspector-commit-short');
    if (!container) return;

    const c = repo.commits[activeGraphCommitHash];
    if (!c) {
        container.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 30px;">Select a commit from the graph to inspect details.</div>`;
        return;
    }

    if (shortLabel) shortLabel.textContent = c.hash.substring(0, 7);

    const delta = repo.getCommitDelta(c.hash);
    const branchMap = {};
    Object.entries(repo.branches).forEach(([bName, bHash]) => {
        if (!branchMap[bHash]) branchMap[bHash] = [];
        branchMap[bHash].push(bName);
    });
    const branchesAtCommit = branchMap[c.hash] || [];

    let parentsHtml = 'None (root commit)';
    if (c.parents.length > 0) {
        parentsHtml = c.parents.map(p => `<a class="parent-jump-link" data-hash="${p}" style="color: var(--primary-blue); font-family: var(--font-mono); font-weight: 600; cursor: pointer;">${p.substring(0, 7)}</a>`).join(', ');
    }

    let filesHtml = '<div style="color: var(--text-muted); font-size: 12px;">No file modifications.</div>';
    if (delta && delta.files.length > 0) {
        if (!activeGraphDiffFile || !delta.files.some(f => f.filePath === activeGraphDiffFile)) {
            activeGraphDiffFile = delta.files[0].filePath;
        }

        filesHtml = delta.files.map(f => `
            <div class="file-item-entry ${f.filePath === activeGraphDiffFile ? 'active' : ''}" data-file="${f.filePath}">
                <span>${f.filePath}</span>
                <span>
                    <span style="color: var(--diff-add-text); font-weight: 600;">+${f.added}</span>
                    <span style="color: var(--diff-del-text); font-weight: 600;">-${f.deleted}</span>
                </span>
            </div>
        `).join('');
    }

    // Build diff preview for active file in this commit
    let diffViewHtml = '';
    if (delta && activeGraphDiffFile) {
        const fileDelta = delta.files.find(f => f.filePath === activeGraphDiffFile);
        if (fileDelta) {
            diffViewHtml = `
                <div style="border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden; margin-top: 10px;">
                    <div style="padding: 6px 10px; background-color: var(--bg-subtle); border-bottom: 1px solid var(--border-color); font-weight: 600; font-size: 11px; font-family: var(--font-mono);">
                        ${activeGraphDiffFile}
                    </div>
                    <div style="max-height: 200px; overflow: auto; padding: 8px; font-family: var(--font-mono); font-size: 11px; background-color: #ffffff;">
            `;
            fileDelta.ops.forEach(op => {
                let bg = '#ffffff';
                let sign = ' ';
                if (op.type === 'INSERT') { bg = 'var(--diff-add-bg)'; sign = '+'; }
                else if (op.type === 'DELETE') { bg = 'var(--diff-del-bg)'; sign = '-'; }
                diffViewHtml += `<div style="background-color: ${bg}; white-space: pre;">${sign} ${escapeHtml(op.line)}</div>`;
            });
            diffViewHtml += `</div></div>`;
        }
    }

    container.innerHTML = `
        <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
            <div style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">${escapeHtml(c.message)}</div>
            <div style="font-size: 12px; color: var(--text-muted); display: flex; flex-direction: column; gap: 2px;">
                <div>Author: <strong>${c.author}</strong></div>
                <div>Date: ${new Date(c.timestamp).toLocaleString()}</div>
                <div>Hash: <span style="font-family: var(--font-mono); font-size: 11px;">${c.hash}</span></div>
                <div>Parents: ${parentsHtml}</div>
                <div>Branches: ${branchesAtCommit.length > 0 ? branchesAtCommit.map(b => `<span class="badge badge-purple">${b}</span>`).join(' ') : 'None'}</div>
            </div>
        </div>

        <div>
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">Commit Actions:</div>
            <div class="graph-actions-grid">
                <button id="btn-graph-checkout" class="btn btn-sm">Checkout Commit</button>
                <button id="btn-graph-cherry-pick" class="btn btn-sm btn-action">Cherry-Pick to HEAD</button>
                <button id="btn-graph-set-start" class="btn btn-sm">Set Range Start</button>
                <button id="btn-graph-set-end" class="btn btn-sm">Set Range End</button>
            </div>
        </div>

        <div style="flex: 1; display: flex; flex-direction: column;">
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">Modified Files (${delta ? delta.files.length : 0}):</div>
            <div style="border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden;">
                ${filesHtml}
            </div>
            ${diffViewHtml}
        </div>
    `;

    // Click parent hash jumps to parent
    container.querySelectorAll('.parent-jump-link').forEach(link => {
        link.onclick = () => {
            activeGraphCommitHash = link.getAttribute('data-hash');
            activeGraphDiffFile = '';
            renderCommitGraph();
        };
    });

    // File click switches diff view
    container.querySelectorAll('.file-item-entry[data-file]').forEach(el => {
        el.onclick = () => {
            activeGraphDiffFile = el.getAttribute('data-file');
            renderGraphCommitInspector();
        };
    });

    // Action button clicks
    const btnCheckout = document.getElementById('btn-graph-checkout');
    if (btnCheckout) {
        btnCheckout.onclick = () => {
            repo.checkout(c.hash);
            updateRepoSubheader();
            renderCommitGraph();
            showToast(`Checked out commit ${c.hash.substring(0, 7)}`);
        };
    }

    const btnCP = document.getElementById('btn-graph-cherry-pick');
    if (btnCP) {
        btnCP.onclick = () => {
            const res = repo.cherryPick(c.hash);
            if (res.hasConflicts) {
                showToast(`Conflict detected when cherry-picking ${c.hash.substring(0, 7)}. Switching to Merge Optimizer...`);
                window.location.hash = `#repo/${currentRepoId}/merge`;
            } else {
                showToast(`Cherry-picked commit ${c.hash.substring(0, 7)} successfully!`);
                updateRepoSubheader();
                renderCommitGraph();
            }
        };
    }

    const btnSetStart = document.getElementById('btn-graph-set-start');
    if (btnSetStart) {
        btnSetStart.onclick = () => {
            cherryPickRangeStart = c.hash;
            cherryPickSelectedHashes.add(c.hash);
            showToast(`Set ${c.hash.substring(0, 7)} as Cherry-Pick Range Start.`);
            window.location.hash = `#repo/${currentRepoId}/cherry-pick`;
        };
    }

    const btnSetEnd = document.getElementById('btn-graph-set-end');
    if (btnSetEnd) {
        btnSetEnd.onclick = () => {
            cherryPickRangeEnd = c.hash;
            cherryPickSelectedHashes.add(c.hash);
            showToast(`Set ${c.hash.substring(0, 7)} as Cherry-Pick Range End.`);
            window.location.hash = `#repo/${currentRepoId}/cherry-pick`;
        };
    }
}

// -----------------------------------------------------------------
// PAGE 4: THREE-WAY MERGE OPTIMIZER
// -----------------------------------------------------------------
function setupMergeView() {
    const incSelect = document.getElementById('merge-incoming-branch');
    if (!incSelect) return;
    incSelect.innerHTML = '';

    const curBranch = repo.currentBranch;
    Object.keys(repo.branches).forEach(b => {
        if (b !== curBranch) {
            const opt = document.createElement('option');
            opt.value = b;
            opt.textContent = b;
            if (b === selectedIncomingBranch) opt.selected = true;
            incSelect.appendChild(opt);
        }
    });

    if (incSelect.options.length > 0 && !selectedIncomingBranch) {
        selectedIncomingBranch = incSelect.options[0].value;
    }

    incSelect.onchange = (e) => {
        selectedIncomingBranch = e.target.value;
        activeResolutions = {};
        currentSimulationReport = null;
        renderThreeWayDiff();
    };

    const curLabel = document.getElementById('merge-current-branch-label');
    if (curLabel) curLabel.textContent = curBranch;
}

function getThreeWayContent() {
    const curCommit = repo.commits[repo.headCommit];
    const currentText = curCommit && curCommit.files[activeFile] ? repo.getBlob(curCommit.files[activeFile]) : (repo.workingTree[activeFile] || '');

    let incomingText = '';
    let baseText = '';

    if (selectedIncomingBranch) {
        const incHash = repo.branches[selectedIncomingBranch] || selectedIncomingBranch;
        const cInc = repo.commits[incHash];
        if (cInc && cInc.files[activeFile]) {
            incomingText = repo.getBlob(cInc.files[activeFile]);
        }
        const baseHash = repo.findCommonAncestor(repo.headCommit, incHash);
        const cBase = repo.commits[baseHash];
        if (cBase && cBase.files[activeFile]) {
            baseText = repo.getBlob(cBase.files[activeFile]);
        }
    }

    return { baseText, currentText, incomingText };
}

function renderThreeWayDiff() {
    const { baseText, currentText, incomingText } = getThreeWayContent();
    const result = MergeEngine.mergeText(baseText, currentText, incomingText, activeFile);

    const baseCol = document.getElementById('split-base-lines');
    const curCol = document.getElementById('split-current-lines');
    const incCol = document.getElementById('split-incoming-lines');

    if (!baseCol || !curCol || !incCol) return;

    baseCol.innerHTML = '';
    curCol.innerHTML = '';
    incCol.innerHTML = '';

    let baseLineNum = 1;
    let curLineNum = 1;
    let incLineNum = 1;

    for (const chunk of result.chunks) {
        const bCount = chunk.baseLines.length;
        const cCount = chunk.currentLines.length;
        const iCount = chunk.incomingLines.length;
        const maxRows = Math.max(bCount, cCount, iCount, 1);

        let rowClass = '';
        if (chunk.isConflict) {
            rowClass = 'row-conflict';
        } else if (chunk.caseCode === 'CASE_2') {
            rowClass = (chunk.classification === 'CASE_2_CURRENT_ONLY') ? 'row-add' : 'row-mod';
        } else if (chunk.caseCode === 'CASE_3') {
            rowClass = 'row-add';
        } else if (chunk.caseCode === 'CASE_4') {
            rowClass = 'row-mod';
        }

        for (let r = 0; r < maxRows; r++) {
            const bLine = r < bCount ? chunk.baseLines[r] : '';
            const bRow = document.createElement('div');
            bRow.className = `diff-row ${r < bCount ? rowClass : 'row-empty'}`;
            bRow.innerHTML = `
                <div class="line-num-cell">${r < bCount ? baseLineNum++ : ''}</div>
                <div class="line-text-cell">${escapeHtml(bLine)}</div>
            `;
            baseCol.appendChild(bRow);

            const cLine = r < cCount ? chunk.currentLines[r] : '';
            const cRow = document.createElement('div');
            cRow.className = `diff-row ${r < cCount ? rowClass : 'row-empty'}`;
            cRow.innerHTML = `
                <div class="line-num-cell">${r < cCount ? curLineNum++ : ''}</div>
                <div class="line-text-cell">${escapeHtml(cLine)}</div>
            `;
            curCol.appendChild(cRow);

            const iLine = r < iCount ? chunk.incomingLines[r] : '';
            const iRow = document.createElement('div');
            iRow.className = `diff-row ${r < iCount ? rowClass : 'row-empty'}`;
            iRow.innerHTML = `
                <div class="line-num-cell">${r < iCount ? incLineNum++ : ''}</div>
                <div class="line-text-cell">${escapeHtml(iLine)}</div>
            `;
            incCol.appendChild(iRow);
        }
    }

    renderConflictCardList(result.conflicts);
}

function renderConflictCardList(conflicts) {
    const container = document.getElementById('conflict-list-panel');
    if (!container) return;
    container.innerHTML = '';

    if (!conflicts || conflicts.length === 0) {
        container.innerHTML = `
            <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 13px;">
                No unresolved conflicts in ${activeFile}.
            </div>
        `;
        return;
    }

    if (!activeResolutions[activeFile]) {
        activeResolutions[activeFile] = {};
    }

    conflicts.forEach(diag => {
        const card = document.createElement('div');
        card.className = 'conflict-card-item';

        const curRes = activeResolutions[activeFile][diag.id];
        const statusText = curRes ? `Resolved (${curRes.action})` : 'Action Required';

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-family: var(--font-mono); font-weight: 700; color: #7e22ce;">${diag.id}</span>
                <span class="badge ${diag.caseType === 'CASE_6' ? 'badge-red' : 'badge-purple'}">${diag.caseType}</span>
            </div>
            <div class="conflict-explainer-banner">
                <strong>Explainer:</strong> ${diag.reason}
            </div>
            <div>
                <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">Base (Lines ${diag.baseLineStart}-${diag.baseLineEnd}):</div>
                <div class="snippet-display">${escapeHtml(diag.baseSnippet || '[empty]')}</div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                <div>
                    <div style="font-size: 10px; color: var(--diff-add-text); text-transform: uppercase;">Current:</div>
                    <div class="snippet-display">${escapeHtml(diag.currentSnippet || '[empty]')}</div>
                </div>
                <div>
                    <div style="font-size: 10px; color: #7e22ce; text-transform: uppercase;">Incoming:</div>
                    <div class="snippet-display">${escapeHtml(diag.incomingSnippet || '[empty]')}</div>
                </div>
            </div>
            <div style="font-size: 11px; font-weight: 600; color: ${curRes ? 'var(--diff-add-text)' : '#b45309'};">
                Status: ${statusText}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                <button class="btn btn-sm ${curRes && curRes.action === 'ACCEPT_CURRENT' ? 'btn-action' : ''}" data-act="ACCEPT_CURRENT">Accept Current</button>
                <button class="btn btn-sm ${curRes && curRes.action === 'ACCEPT_INCOMING' ? 'btn-action' : ''}" data-act="ACCEPT_INCOMING">Accept Incoming</button>
                <button class="btn btn-sm ${curRes && curRes.action === 'KEEP_BASE' ? 'btn-action' : ''}" data-act="KEEP_BASE">Keep Base</button>
                <button class="btn btn-sm ${curRes && curRes.action === 'CUSTOM_EDIT' ? 'btn-action' : ''}" data-act="CUSTOM_EDIT">Custom Edit</button>
            </div>
        `;

        card.querySelectorAll('button[data-act]').forEach(b => {
            b.onclick = () => {
                const act = b.getAttribute('data-act');
                if (act === 'CUSTOM_EDIT') {
                    openModalCustomEdit(diag);
                } else {
                    activeResolutions[activeFile][diag.id] = { action: act, customText: '' };
                    renderThreeWayDiff();
                    showToast(`Conflict ${diag.id} set to ${act}`);
                }
            };
        });

        container.appendChild(card);
    });
}

function openModalCustomEdit(diag) {
    const modal = document.getElementById('custom-edit-modal-dialog');
    const textarea = document.getElementById('modal-edit-textarea');
    const label = document.getElementById('modal-conflict-label');
    if (!modal || !textarea) return;

    label.textContent = `${diag.id} (${diag.filePath})`;
    textarea.value = diag.currentSnippet || diag.incomingSnippet || diag.baseSnippet || '';
    modal.style.display = 'flex';

    document.getElementById('btn-apply-custom-modal').onclick = () => {
        if (!activeResolutions[activeFile]) activeResolutions[activeFile] = {};
        activeResolutions[activeFile][diag.id] = {
            action: 'CUSTOM_EDIT',
            customText: textarea.value
        };
        modal.style.display = 'none';
        renderThreeWayDiff();
        showToast(`Saved custom edit for ${diag.id}`);
    };

    document.getElementById('btn-cancel-custom-modal').onclick = () => {
        modal.style.display = 'none';
    };
}

function triggerMergeSimulation() {
    if (!selectedIncomingBranch) return;
    const sim = repo.simulateMerge(selectedIncomingBranch);
    currentSimulationReport = sim;

    document.getElementById('sim-stat-ancestor').textContent = sim.baseRef;
    document.getElementById('sim-stat-files').textContent = sim.filesAnalyzed;
    document.getElementById('sim-stat-clean').textContent = sim.cleanlyMergedFiles;
    document.getElementById('sim-stat-conflicts').textContent = sim.totalConflicts;

    const tbody = document.getElementById('sim-cases-breakdown-body');
    if (tbody) {
        tbody.innerHTML = '';
        const caseDesc = {
            CASE_1: 'Case 1: Identical regions (retain base)',
            CASE_2: 'Case 2: Single branch change (auto-accept)',
            CASE_3: 'Case 3: Independent regions (auto-combine)',
            CASE_4: 'Case 4: Identical modifications (accept once)',
            CASE_5: 'Case 5: Overlapping differing content (conflict)',
            CASE_6: 'Case 6: Delete vs Modify collision (conflict)'
        };

        Object.entries(sim.caseDistribution).forEach(([k, count]) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 4px 6px; border-bottom: 1px solid var(--border-color); font-size: 11px;">${caseDesc[k] || k}</td>
                <td style="padding: 4px 6px; border-bottom: 1px solid var(--border-color); font-family: var(--font-mono); text-align: right; font-weight: 600;">${count}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    showToast(`Simulation dry-run finished: ${sim.totalConflicts} conflicts across ${sim.conflictingFiles} files.`);
}

function triggerMergeExecution() {
    if (!selectedIncomingBranch) return;
    const res = repo.merge(selectedIncomingBranch, activeResolutions);

    if (res.hasConflicts) {
        showToast(`Merge blocked: ${res.conflicts.length} unresolved conflicts remain.`);
        renderConflictCardList(res.conflicts);
    } else {
        showToast(`Branch '${selectedIncomingBranch}' merged into ${repo.currentBranch}!`);
        activeResolutions = {};
        currentSimulationReport = null;
        updateRepoSubheader();
        setupMergeView();
        renderThreeWayDiff();
    }
}

// -----------------------------------------------------------------
// PAGE 5: CHERRY-PICK STUDIO (FIRST-CLASS DEDICATED WORKBENCH)
// -----------------------------------------------------------------
function renderCherryPickStudio() {
    const targetSelect = document.getElementById('cp-target-branch-select');
    const sourceSelect = document.getElementById('cp-source-branch-select');
    const tableBody = document.getElementById('cp-commit-rows-body');
    const rangeFromSelect = document.getElementById('cp-range-from-select');
    const rangeToSelect = document.getElementById('cp-range-to-select');

    if (!targetSelect || !sourceSelect || !tableBody) return;

    // Populate branches
    targetSelect.innerHTML = '';
    sourceSelect.innerHTML = '';

    const branches = Object.keys(repo.branches);
    
    // Default cherryPickSelectedBranch if invalid
    if (!cherryPickSelectedBranch || !branches.includes(cherryPickSelectedBranch) || cherryPickSelectedBranch === repo.currentBranch) {
        const other = branches.find(b => b !== repo.currentBranch);
        cherryPickSelectedBranch = other || repo.currentBranch;
    }

    branches.forEach(b => {
        const optT = document.createElement('option');
        optT.value = b;
        optT.textContent = b;
        if (b === repo.currentBranch) optT.selected = true;
        targetSelect.appendChild(optT);

        const optS = document.createElement('option');
        optS.value = b;
        optS.textContent = b;
        if (b === cherryPickSelectedBranch) optS.selected = true;
        sourceSelect.appendChild(optS);
    });

    targetSelect.onchange = (e) => {
        repo.checkout(e.target.value);
        if (cherryPickSelectedBranch === e.target.value) {
            const other = branches.find(b => b !== e.target.value);
            if (other) cherryPickSelectedBranch = other;
        }
        updateRepoSubheader();
        renderCherryPickStudio();
    };

    sourceSelect.onchange = (e) => {
        cherryPickSelectedBranch = e.target.value;
        cherryPickSelectedHashes.clear();
        cherryPickRangeStart = null;
        cherryPickRangeEnd = null;
        lastCheckedCommitIndex = -1;
        renderCherryPickStudio();
    };

    // Collect source branch history
    const srcTip = repo.branches[cherryPickSelectedBranch] || cherryPickSelectedBranch;
    const history = repo.getHistory(srcTip, 50);

    // Compute target branch ancestors to identify commits already on target
    const targetTip = repo.headCommit;
    const targetAncestors = new Set();
    const qT = [targetTip];
    while (qT.length > 0) {
        const cur = qT.shift();
        if (!cur || targetAncestors.has(cur)) continue;
        targetAncestors.add(cur);
        const c = repo.commits[cur];
        if (c) c.parents.forEach(p => qT.push(p));
    }

    // Populate Range From and Range To dropdowns
    if (rangeFromSelect && rangeToSelect) {
        rangeFromSelect.innerHTML = '';
        rangeToSelect.innerHTML = '';

        history.forEach((c) => {
            const isUnmerged = !targetAncestors.has(c.hash);
            const prefix = isUnmerged ? '' : '[Already on target] ';

            const optF = document.createElement('option');
            optF.value = c.hash;
            optF.textContent = `${prefix}${c.hash.substring(0, 7)} - ${c.message.substring(0, 32)}`;
            if (cherryPickRangeStart === c.hash) optF.selected = true;
            rangeFromSelect.appendChild(optF);

            const optT = document.createElement('option');
            optT.value = c.hash;
            optT.textContent = `${prefix}${c.hash.substring(0, 7)} - ${c.message.substring(0, 32)}`;
            if (cherryPickRangeEnd === c.hash) optT.selected = true;
            rangeToSelect.appendChild(optT);
        });
    }

    tableBody.innerHTML = '';

    if (history.length === 0) {
        tableBody.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">No commits found on source branch.</div>';
        updateCherryPickPlanAndActions(history);
        return;
    }

    history.forEach((c, idx) => {
        const isAlreadyOnTarget = targetAncestors.has(c.hash);
        const isSelected = cherryPickSelectedHashes.has(c.hash);
        const isStart = (cherryPickRangeStart === c.hash);
        const isEnd = (cherryPickRangeEnd === c.hash);

        const row = document.createElement('div');
        row.className = `cp-row ${isSelected ? 'selected' : ''}`;
        row.setAttribute('data-hash', c.hash);

        let badgesHtml = '';
        if (isAlreadyOnTarget) {
            badgesHtml = '<span class="badge badge-gray">Already on target</span>';
        } else {
            if (isStart) badgesHtml += '<span class="badge cp-badge-start">RANGE START</span> ';
            if (isEnd) badgesHtml += '<span class="badge cp-badge-end">RANGE END</span> ';
            badgesHtml += `
                <button class="btn btn-sm btn-set-start" data-hash="${c.hash}" title="Set as range start">Set Start</button>
                <button class="btn btn-sm btn-set-end" data-hash="${c.hash}" title="Set as range end">Set End</button>
            `;
        }

        row.innerHTML = `
            <input type="checkbox" class="cp-commit-check" data-hash="${c.hash}" data-idx="${idx}" ${isSelected ? 'checked' : ''} ${isAlreadyOnTarget ? 'disabled' : ''} />
            <div style="font-family: var(--font-mono); font-weight: 700; color: var(--primary-blue); width: 75px;">${c.hash.substring(0, 7)}</div>
            <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                <div style="font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(c.message)}</div>
                <div style="font-size: 11px; color: var(--text-muted);">${c.author} · ${new Date(c.timestamp).toLocaleString()}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                ${badgesHtml}
            </div>
        `;

        // Checkbox click with Shift-Click range support
        const chk = row.querySelector('.cp-commit-check');
        if (chk) {
            chk.onclick = (e) => {
                e.stopPropagation();
                if (e.shiftKey && lastCheckedCommitIndex !== -1) {
                    const minIdx = Math.min(lastCheckedCommitIndex, idx);
                    const maxIdx = Math.max(lastCheckedCommitIndex, idx);
                    for (let i = minIdx; i <= maxIdx; i++) {
                        if (!targetAncestors.has(history[i].hash)) {
                            cherryPickSelectedHashes.add(history[i].hash);
                        }
                    }
                } else {
                    if (chk.checked) {
                        cherryPickSelectedHashes.add(c.hash);
                    } else {
                        cherryPickSelectedHashes.delete(c.hash);
                    }
                }
                lastCheckedCommitIndex = idx;
                updateCherryPickPlanAndActions(history);
                inspectCommitDelta(c.hash);
                renderCherryPickStudio();
            };
        }

        // Set Start button
        const btnStart = row.querySelector('.btn-set-start');
        if (btnStart) {
            btnStart.onclick = (e) => {
                e.stopPropagation();
                cherryPickRangeStart = c.hash;
                cherryPickSelectedHashes.add(c.hash);
                if (rangeFromSelect) rangeFromSelect.value = c.hash;
                showToast(`Set ${c.hash.substring(0, 7)} as section start.`);
                if (cherryPickRangeEnd) applySectionRangeSelection(history, targetAncestors);
                renderCherryPickStudio();
            };
        }

        // Set End button
        const btnEnd = row.querySelector('.btn-set-end');
        if (btnEnd) {
            btnEnd.onclick = (e) => {
                e.stopPropagation();
                cherryPickRangeEnd = c.hash;
                cherryPickSelectedHashes.add(c.hash);
                if (rangeToSelect) rangeToSelect.value = c.hash;
                showToast(`Set ${c.hash.substring(0, 7)} as section end.`);
                if (cherryPickRangeStart) applySectionRangeSelection(history, targetAncestors);
                renderCherryPickStudio();
            };
        }

        // Row click opens delta preview
        row.onclick = () => {
            inspectCommitDelta(c.hash);
        };

        tableBody.appendChild(row);
    });

    updateCherryPickPlanAndActions(history);

    // Inspect first commit delta by default
    if (history.length > 0) {
        const firstInspect = cherryPickSelectedHashes.size > 0 ? Array.from(cherryPickSelectedHashes)[0] : history[0].hash;
        inspectCommitDelta(firstInspect);
    }
}

function applySectionRangeSelection(history, targetAncestors) {
    if (!cherryPickRangeStart || !cherryPickRangeEnd) return;

    const startIdx = history.findIndex(h => h.hash === cherryPickRangeStart);
    const endIdx = history.findIndex(h => h.hash === cherryPickRangeEnd);

    if (startIdx === -1 || endIdx === -1) return;

    const minIdx = Math.min(startIdx, endIdx);
    const maxIdx = Math.max(startIdx, endIdx);

    cherryPickSelectedHashes.clear();
    for (let i = minIdx; i <= maxIdx; i++) {
        if (!targetAncestors.has(history[i].hash)) {
            cherryPickSelectedHashes.add(history[i].hash);
        }
    }
    showToast(`Selected section of ${cherryPickSelectedHashes.size} commit(s).`);
}

function updateCherryPickPlanAndActions(history) {
    const count = cherryPickSelectedHashes.size;
    const btn = document.getElementById('btn-apply-selected-cp');
    const planCard = document.getElementById('cp-plan-summary-card');
    const planTitle = document.getElementById('cp-plan-title');
    const planDelta = document.getElementById('cp-plan-delta-stats');
    const planSeq = document.getElementById('cp-plan-sequence');

    if (btn) {
        btn.textContent = `Cherry-Pick Section (${count})`;
        btn.disabled = count === 0;
    }

    if (!planCard || !planSeq) return;

    if (count === 0) {
        planCard.style.display = 'none';
        return;
    }

    planCard.style.display = 'flex';

    // Sort commits in topological order (ancestors applied first)
    const selectedCommits = Array.from(cherryPickSelectedHashes)
        .map(h => repo.commits[h])
        .filter(Boolean)
        .sort((a, b) => {
            const da = repo.getCommitDepth(a.hash);
            const db = repo.getCommitDepth(b.hash);
            if (da !== db) return da - db;
            return a.timestamp - b.timestamp;
        });

    if (planTitle) {
        planTitle.textContent = `Section Execution Plan: ${selectedCommits.length} Commit(s) to Apply onto '${repo.currentBranch}'`;
    }

    let totalAdded = 0;
    let totalDeleted = 0;
    const touchedFiles = new Set();

    selectedCommits.forEach(c => {
        const delta = repo.getCommitDelta(c.hash);
        if (delta) {
            delta.files.forEach(f => {
                totalAdded += f.added;
                totalDeleted += f.deleted;
                touchedFiles.add(f.filePath);
            });
        }
    });

    if (planDelta) {
        planDelta.innerHTML = `
            <span style="color: var(--diff-add-text);">+${totalAdded}</span> 
            <span style="color: var(--diff-del-text);">-${totalDeleted}</span> across ${touchedFiles.size} file(s)
        `;
    }

    planSeq.innerHTML = selectedCommits.map((c, i) => `
        <span class="cp-sequence-badge">${i + 1}. ${c.hash.substring(0, 7)} (${escapeHtml(c.message.substring(0, 24))})</span>
        ${i + 1 < selectedCommits.length ? '<span style="color: var(--text-muted);">&rarr;</span>' : ''}
    `).join(' ');
}

function inspectCommitDelta(hash) {
    const deltaContainer = document.getElementById('cp-delta-view-content');
    const headerEl = document.getElementById('cp-delta-target-hash');
    if (!deltaContainer) return;

    const delta = repo.getCommitDelta(hash);
    if (!delta) {
        deltaContainer.innerHTML = '<div style="color: var(--text-muted);">Select a commit to inspect its changes.</div>';
        return;
    }

    if (headerEl) headerEl.textContent = `${delta.shortHash}: ${delta.message}`;

    let html = `
        <div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color);">
            <div style="font-weight: 600; font-size: 13px;">${escapeHtml(delta.message)}</div>
            <div style="font-size: 11px; color: var(--text-muted);">Author: ${delta.author} · Commit: ${delta.commitHash}</div>
        </div>
    `;

    if (delta.files.length === 0) {
        html += '<div style="color: var(--text-muted); font-size: 12px;">No file modifications in this commit relative to parent.</div>';
    } else {
        delta.files.forEach(f => {
            html += `
                <div style="border: 1px solid var(--border-color); border-radius: 4px; margin-bottom: 12px; overflow: hidden;">
                    <div style="padding: 6px 10px; background-color: var(--bg-subtle); border-bottom: 1px solid var(--border-color); font-weight: 600; font-size: 12px; display: flex; justify-content: space-between;">
                        <span>${f.filePath}</span>
                        <span><span style="color: var(--diff-add-text);">+${f.added}</span> <span style="color: var(--diff-del-text);">-${f.deleted}</span></span>
                    </div>
                    <div style="padding: 8px 10px; font-family: var(--font-mono); font-size: 11px; max-height: 220px; overflow-y: auto; background-color: #ffffff;">
            `;

            f.ops.forEach(op => {
                let rowBg = '#ffffff';
                let sign = ' ';
                if (op.type === 'INSERT') {
                    rowBg = 'var(--diff-add-bg)';
                    sign = '+';
                } else if (op.type === 'DELETE') {
                    rowBg = 'var(--diff-del-bg)';
                    sign = '-';
                }
                html += `<div style="background-color: ${rowBg}; white-space: pre;">${sign} ${escapeHtml(op.line)}</div>`;
            });

            html += `</div></div>`;
        });
    }

    deltaContainer.innerHTML = html;
}

function executeSelectedCherryPick() {
    if (cherryPickSelectedHashes.size === 0) {
        showToast('Please select at least one commit to cherry-pick.');
        return;
    }

    const hashes = Array.from(cherryPickSelectedHashes);
    const result = repo.cherryPickBatch(hashes, activeResolutions);

    const alertBox = document.getElementById('cp-conflict-alert-box');
    const alertContent = document.getElementById('cp-conflict-alert-content');

    if (!result.success) {
        if (alertBox && alertContent) {
            alertBox.style.display = 'block';
            alertContent.innerHTML = `
                <div style="font-size: 13px; font-weight: 600; color: #b91c1c; margin-bottom: 6px;">
                    Conflict encountered on commit ${result.conflictingCommit.substring(0, 7)}!
                </div>
                <div style="font-size: 12px; color: var(--text-main); margin-bottom: 10px;">
                    ${result.conflicts.map(c => `<div><strong>${c.filePath}</strong>: ${c.reason}</div>`).join('')}
                </div>
                <div style="display: flex; gap: 8px;">
                    <a href="#repo/${currentRepoId}/merge" class="btn btn-sm btn-action">Open Three-Way Merge Optimizer to Resolve</a>
                </div>
            `;
        }
        showToast(`Cherry-pick conflicted on commit ${result.conflictingCommit.substring(0, 7)}.`);
    } else {
        if (alertBox) alertBox.style.display = 'none';
        showToast(`Successfully cherry-picked ${result.appliedCount} commit(s) onto ${repo.currentBranch}!`);
        cherryPickSelectedHashes.clear();
        cherryPickRangeStart = null;
        cherryPickRangeEnd = null;
        lastCheckedCommitIndex = -1;
        updateRepoSubheader();
        renderCherryPickStudio();
    }
}

// -----------------------------------------------------------------
// INITIALIZATION AND EVENT LISTENERS
// -----------------------------------------------------------------
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function setupSyncSplitScroll() {
    const cols = [
        document.getElementById('split-base-lines'),
        document.getElementById('split-current-lines'),
        document.getElementById('split-incoming-lines')
    ];

    let syncing = false;
    cols.forEach(c => {
        if (!c) return;
        c.addEventListener('scroll', () => {
            if (syncing) return;
            syncing = true;
            const top = c.scrollTop;
            const left = c.scrollLeft;
            cols.forEach(o => {
                if (o && o !== c) {
                    o.scrollTop = top;
                    o.scrollLeft = left;
                }
            });
            syncing = false;
        });
    });
}

window.addEventListener('DOMContentLoaded', () => {
    // Navigation bar links
    document.querySelectorAll('.nav-link[data-page]').forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            const target = link.getAttribute('data-page');
            window.location.hash = `#${target}`;
        };
    });

    // Subheader tabs
    document.querySelectorAll('.tab-item[data-tab]').forEach(tab => {
        tab.onclick = () => {
            const tabName = tab.getAttribute('data-tab');
            window.location.hash = `#repo/${currentRepoId}/${tabName}`;
        };
    });

    // Code save
    const btnSave = document.getElementById('btn-code-save-working');
    if (btnSave) {
        btnSave.onclick = () => {
            const area = document.getElementById('code-file-editor');
            if (area && activeFile) {
                repo.stageFile(activeFile, area.value);
                showToast(`Staged changes for ${activeFile}`);
                updateFileList();
            }
        };
    }

    // Merge Actions
    const btnSim = document.getElementById('btn-run-merge-sim');
    if (btnSim) btnSim.onclick = triggerMergeSimulation;

    const btnExec = document.getElementById('btn-exec-merge');
    if (btnExec) btnExec.onclick = triggerMergeExecution;

    // Cherry Pick Actions
    const btnApplyCP = document.getElementById('btn-apply-selected-cp');
    if (btnApplyCP) btnApplyCP.onclick = executeSelectedCherryPick;

    const btnClearCP = document.getElementById('btn-clear-cp-selection');
    if (btnClearCP) {
        btnClearCP.onclick = () => {
            cherryPickSelectedHashes.clear();
            cherryPickRangeStart = null;
            cherryPickRangeEnd = null;
            lastCheckedCommitIndex = -1;
            renderCherryPickStudio();
        };
    }

    const btnSelectAllCP = document.getElementById('btn-select-all-cp');
    if (btnSelectAllCP) {
        btnSelectAllCP.onclick = () => {
            const srcTip = repo.branches[cherryPickSelectedBranch] || cherryPickSelectedBranch;
            const history = repo.getHistory(srcTip, 50);
            const targetTip = repo.headCommit;
            const targetAncestors = new Set();
            const qT = [targetTip];
            while (qT.length > 0) {
                const cur = qT.shift();
                if (!cur || targetAncestors.has(cur)) continue;
                targetAncestors.add(cur);
                const c = repo.commits[cur];
                if (c) c.parents.forEach(p => qT.push(p));
            }
            history.forEach(c => {
                if (!targetAncestors.has(c.hash)) {
                    cherryPickSelectedHashes.add(c.hash);
                }
            });
            showToast(`Selected all ${cherryPickSelectedHashes.size} available unmerged commits.`);
            renderCherryPickStudio();
        };
    }

    const btnApplyRangeSelect = document.getElementById('btn-apply-range-select');
    if (btnApplyRangeSelect) {
        btnApplyRangeSelect.onclick = () => {
            const rangeFrom = document.getElementById('cp-range-from-select')?.value;
            const rangeTo = document.getElementById('cp-range-to-select')?.value;
            if (!rangeFrom || !rangeTo) {
                showToast('Please select both From and To commits for the section.');
                return;
            }
            cherryPickRangeStart = rangeFrom;
            cherryPickRangeEnd = rangeTo;

            const srcTip = repo.branches[cherryPickSelectedBranch] || cherryPickSelectedBranch;
            const history = repo.getHistory(srcTip, 50);
            const targetTip = repo.headCommit;
            const targetAncestors = new Set();
            const qT = [targetTip];
            while (qT.length > 0) {
                const cur = qT.shift();
                if (!cur || targetAncestors.has(cur)) continue;
                targetAncestors.add(cur);
                const c = repo.commits[cur];
                if (c) c.parents.forEach(p => qT.push(p));
            }
            applySectionRangeSelection(history, targetAncestors);
            renderCherryPickStudio();
        };
    }

    // Search filter for repositories
    const searchInput = document.getElementById('repo-search-input');
    if (searchInput) {
        searchInput.oninput = renderRepositoriesPage;
    }

    setupSyncSplitScroll();

    // Hash change handler
    window.addEventListener('hashchange', () => {
        navigateTo(window.location.hash);
    });

    // Default entry to landing page #repositories
    if (!window.location.hash || window.location.hash === '#') {
        window.location.hash = '#repositories';
    } else {
        navigateTo(window.location.hash);
    }
});
