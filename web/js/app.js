// Chronica UI Application Controller

let repo = new ChronicaRepository();
let activeFile = 'src/config.cpp';
let activeView = 'three-way';
let selectedIncomingBranch = '';
let activeResolutions = {}; // { filePath: { conflictId: { action, customText } } }
let currentSimulationReport = null;

// Preset Scenarios
const SCENARIOS = {
    auth_config: {
        name: "Distributed Config & Auth (Cases 1, 2, 4, 5)",
        setup: (r) => {
            r.init('main');
            r.stageFile('src/config.cpp',
                '// System Configuration Header\n' +
                'int timeout = 30;\n' +
                'int max_retries = 3;\n' +
                'bool debug_mode = false;\n' +
                'std::string host = "127.0.0.1";\n' +
                'int thread_pool_size = 4;\n' +
                'void initialize_network();\n'
            );
            r.stageFile('src/auth.cpp',
                '// Core Authentication Engine\n' +
                'bool verify_credentials(const std::string& token) {\n' +
                '    if (token.empty()) return false;\n' +
                '    return validate_signature(token);\n' +
                '}\n' +
                'bool check_permissions(int role_id) {\n' +
                '    return role_id > 0;\n' +
                '}\n'
            );
            const c1 = r.commit('Initial repository state with baseline auth and config');

            r.createBranch('feature/auth-refresh');
            r.checkout('feature/auth-refresh');
            r.stageFile('src/config.cpp',
                '// System Configuration Header\n' +
                'int timeout = 60;\n' +
                'int max_retries = 5;\n' +
                'bool debug_mode = true;\n' +
                'std::string host = "127.0.0.1";\n' +
                'int thread_pool_size = 4;\n' +
                'void initialize_network();\n'
            );
            r.stageFile('src/auth.cpp',
                '// Core Authentication Engine\n' +
                'bool verify_credentials(const std::string& token) {\n' +
                '    if (token.empty()) return false;\n' +
                '    if (is_token_expired(token)) return false;\n' +
                '    return validate_signature(token);\n' +
                '}\n' +
                'void refresh_session(const std::string& refresh_token) {\n' +
                '    issue_new_token(refresh_token);\n' +
                '}\n' +
                'bool check_permissions(int role_id) {\n' +
                '    return role_id > 0;\n' +
                '}\n'
            );
            r.commit('Add token expiration verification and session renewal');

            r.checkout('main');
            r.createBranch('release/v2-prod');
            r.checkout('release/v2-prod');
            r.stageFile('src/config.cpp',
                '// System Configuration Header\n' +
                'int timeout = 120;\n' +
                'int max_retries = 5;\n' +
                'bool debug_mode = false;\n' +
                'std::string host = "0.0.0.0";\n' +
                'int thread_pool_size = 8;\n' +
                'void initialize_network();\n'
            );
            r.commit('Production cluster timeout 120s and thread pool scaling');
            r.checkout('release/v2-prod');
        }
    },
    delete_vs_modify: {
        name: "Service Pricing Engine (Case 6: Delete vs Modify)",
        setup: (r) => {
            r.init('main');
            r.stageFile('services/pricing.cpp',
                '#include "pricing.hpp"\n' +
                '\n' +
                'double calculate_standard_price(double base_rate) {\n' +
                '    double tax = base_rate * 0.15;\n' +
                '    return base_rate + tax;\n' +
                '}\n' +
                '\n' +
                'double calculate_discounted_price(double base_rate, double discount) {\n' +
                '    return base_rate * (1.0 - discount);\n' +
                '}\n'
            );
            r.commit('Initial pricing logic');

            r.createBranch('refactor/remove-legacy');
            r.checkout('refactor/remove-legacy');
            r.stageFile('services/pricing.cpp',
                '#include "pricing.hpp"\n' +
                '\n' +
                'double calculate_discounted_price(double base_rate, double discount) {\n' +
                '    return base_rate * (1.0 - discount);\n' +
                '}\n'
            );
            r.commit('Delete legacy standard price function');

            r.checkout('main');
            r.createBranch('feature/dynamic-tax');
            r.checkout('feature/dynamic-tax');
            r.stageFile('services/pricing.cpp',
                '#include "pricing.hpp"\n' +
                '\n' +
                'double calculate_standard_price(double base_rate) {\n' +
                '    double local_tax = query_jurisdiction_tax();\n' +
                '    return base_rate * (1.0 + local_tax);\n' +
                '}\n' +
                '\n' +
                'double calculate_discounted_price(double base_rate, double discount) {\n' +
                '    return base_rate * (1.0 - discount);\n' +
                '}\n'
            );
            r.commit('Update standard price with dynamic jurisdiction tax');
            r.checkout('refactor/remove-legacy');
        }
    },
    independent_changes: {
        name: "Telemetry Pipeline (Case 3: Independent Auto-Combine)",
        setup: (r) => {
            r.init('main');
            r.stageFile('pipeline/stream.cpp',
                '// Stream Pipeline\n' +
                'void initialize_stream() {\n' +
                '    setup_buffers();\n' +
                '}\n' +
                '\n' +
                'void process_packet(const Packet& p) {\n' +
                '    validate(p);\n' +
                '    dispatch(p);\n' +
                '}\n' +
                '\n' +
                'void shutdown_stream() {\n' +
                '    flush_buffers();\n' +
                '}\n'
            );
            r.commit('Baseline streaming pipeline');

            r.createBranch('feature/metrics');
            r.checkout('feature/metrics');
            r.stageFile('pipeline/stream.cpp',
                '// Stream Pipeline\n' +
                'void initialize_stream() {\n' +
                '    setup_buffers();\n' +
                '    register_metric_counters();\n' +
                '}\n' +
                '\n' +
                'void process_packet(const Packet& p) {\n' +
                '    validate(p);\n' +
                '    dispatch(p);\n' +
                '}\n' +
                '\n' +
                'void shutdown_stream() {\n' +
                '    flush_buffers();\n' +
                '}\n'
            );
            r.commit('Add metrics initialization to stream');

            r.checkout('main');
            r.createBranch('feature/graceful-shutdown');
            r.checkout('feature/graceful-shutdown');
            r.stageFile('pipeline/stream.cpp',
                '// Stream Pipeline\n' +
                'void initialize_stream() {\n' +
                '    setup_buffers();\n' +
                '}\n' +
                '\n' +
                'void process_packet(const Packet& p) {\n' +
                '    validate(p);\n' +
                '    dispatch(p);\n' +
                '}\n' +
                '\n' +
                'void shutdown_stream() {\n' +
                '    drain_in_flight_packets();\n' +
                '    flush_buffers();\n' +
                '    notify_cluster_nodes();\n' +
                '}\n'
            );
            r.commit('Add packet drain and notification on shutdown');
            r.checkout('feature/metrics');
        }
    }
};

function showToast(message) {
    const toast = document.getElementById('toast-bar');
    if (!toast) return;
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3200);
}

function loadScenario(key) {
    const sc = SCENARIOS[key];
    if (!sc) return;
    sc.setup(repo);
    activeResolutions = {};
    currentSimulationReport = null;
    updateBranchDropdowns();
    updateFileList();
    renderCommitGraph();
    renderCommitHistory();
    setupDefaultMergePair();
    refreshView();
    showToast(`Loaded scenario: ${sc.name}`);
}

function setupDefaultMergePair() {
    const branches = Object.keys(repo.branches);
    const incSelect = document.getElementById('incoming-branch-select');
    if (!incSelect) return;
    incSelect.innerHTML = '';

    for (const b of branches) {
        if (b !== repo.currentBranch) {
            const opt = document.createElement('option');
            opt.value = b;
            opt.textContent = b;
            incSelect.appendChild(opt);
        }
    }

    if (incSelect.options.length > 0) {
        selectedIncomingBranch = incSelect.options[0].value;
    } else {
        selectedIncomingBranch = '';
    }
}

function updateBranchDropdowns() {
    const curSelect = document.getElementById('current-branch-select');
    if (curSelect) {
        curSelect.innerHTML = '';
        for (const b of Object.keys(repo.branches)) {
            const opt = document.createElement('option');
            opt.value = b;
            opt.textContent = b;
            if (b === repo.currentBranch) opt.selected = true;
            curSelect.appendChild(opt);
        }
    }
    setupDefaultMergePair();
}

function updateFileList() {
    const container = document.getElementById('file-list-container');
    if (!container) return;
    container.innerHTML = '';

    const files = new Set();
    const curCommit = repo.commits[repo.headCommit];
    if (curCommit) Object.keys(curCommit.files).forEach(f => files.add(f));
    Object.keys(repo.workingTree).forEach(f => files.add(f));

    const fileArr = Array.from(files).sort();
    if (!fileArr.includes(activeFile) && fileArr.length > 0) {
        activeFile = fileArr[0];
    }

    fileArr.forEach(path => {
        const item = document.createElement('div');
        item.className = `file-item ${path === activeFile ? 'active' : ''}`;
        
        let badgeType = 'M';
        let badgeClass = 'status-m';
        if (currentSimulationReport) {
            const hasConflict = currentSimulationReport.allConflicts.some(c => c.filePath === path);
            if (hasConflict) {
                badgeType = 'C';
                badgeClass = 'status-c';
            }
        }

        item.innerHTML = `
            <span>${path}</span>
            <span class="status-badge ${badgeClass}">${badgeType}</span>
        `;
        item.onclick = () => {
            activeFile = path;
            updateFileList();
            refreshView();
        };
        container.appendChild(item);
    });

    const activeTitle = document.getElementById('active-file-name');
    if (activeTitle) activeTitle.textContent = activeFile;
}

function getThreeWayText() {
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
    const { baseText, currentText, incomingText } = getThreeWayText();
    const result = MergeEngine.mergeText(baseText, currentText, incomingText, activeFile);

    const baseCol = document.getElementById('diff-col-base');
    const curCol = document.getElementById('diff-col-current');
    const incCol = document.getElementById('diff-col-incoming');

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
            // Base slot
            const bLine = r < bCount ? chunk.baseLines[r] : '';
            const bRow = document.createElement('div');
            bRow.className = `diff-row ${r < bCount ? rowClass : 'row-empty'}`;
            bRow.innerHTML = `
                <div class="line-no">${r < bCount ? baseLineNum++ : ''}</div>
                <div class="line-text">${escapeHtml(bLine)}</div>
            `;
            baseCol.appendChild(bRow);

            // Current slot
            const cLine = r < cCount ? chunk.currentLines[r] : '';
            const cRow = document.createElement('div');
            cRow.className = `diff-row ${r < cCount ? rowClass : 'row-empty'}`;
            cRow.innerHTML = `
                <div class="line-no">${r < cCount ? curLineNum++ : ''}</div>
                <div class="line-text">${escapeHtml(cLine)}</div>
            `;
            curCol.appendChild(cRow);

            // Incoming slot
            const iLine = r < iCount ? chunk.incomingLines[r] : '';
            const iRow = document.createElement('div');
            iRow.className = `diff-row ${r < iCount ? rowClass : 'row-empty'}`;
            iRow.innerHTML = `
                <div class="line-no">${r < iCount ? incLineNum++ : ''}</div>
                <div class="line-text">${escapeHtml(iLine)}</div>
            `;
            incCol.appendChild(iRow);
        }
    }

    renderConflictCards(result.conflicts);
}

function renderUnifiedDiff() {
    const { currentText, incomingText } = getThreeWayText();
    const curLines = LCSEngine.splitLines(currentText);
    const incLines = LCSEngine.splitLines(incomingText);
    const ops = LCSEngine.diff(curLines, incLines);

    const baseCol = document.getElementById('diff-col-base');
    const curCol = document.getElementById('diff-col-current');
    const incCol = document.getElementById('diff-col-incoming');

    if (!baseCol || !curCol || !incCol) return;

    baseCol.innerHTML = '';
    curCol.innerHTML = '';
    incCol.innerHTML = '';

    let curNo = 1;
    let incNo = 1;

    for (const op of ops) {
        const rowClass = (op.type === 'KEEP') ? '' : (op.type === 'DELETE' ? 'row-del' : 'row-add');
        
        const bRow = document.createElement('div');
        bRow.className = `diff-row ${rowClass}`;
        bRow.innerHTML = `<div class="line-no"></div><div class="line-text"></div>`;
        baseCol.appendChild(bRow);

        const cRow = document.createElement('div');
        cRow.className = `diff-row ${rowClass}`;
        cRow.innerHTML = `
            <div class="line-no">${op.type !== 'INSERT' ? curNo++ : ''}</div>
            <div class="line-text">${op.type !== 'INSERT' ? escapeHtml(op.line) : ''}</div>
        `;
        curCol.appendChild(cRow);

        const iRow = document.createElement('div');
        iRow.className = `diff-row ${rowClass}`;
        iRow.innerHTML = `
            <div class="line-no">${op.type !== 'DELETE' ? incNo++ : ''}</div>
            <div class="line-text">${op.type !== 'DELETE' ? escapeHtml(op.line) : ''}</div>
        `;
        incCol.appendChild(iRow);
    }
}

function renderCodeEditor() {
    const editor = document.getElementById('code-editor-textarea');
    if (!editor) return;

    const { baseText, currentText, incomingText } = getThreeWayText();
    const result = MergeEngine.mergeText(baseText, currentText, incomingText, activeFile);

    // If resolutions applied, show preview with resolutions
    const fileRes = (activeResolutions[activeFile]) || {};
    if (Object.keys(fileRes).length > 0) {
        editor.value = MergeEngine.applyResolution(result, fileRes);
    } else {
        editor.value = result.mergedText;
    }
}

function refreshView() {
    const threeWayContainer = document.getElementById('three-way-diff-view');
    const editorContainer = document.getElementById('code-editor-view');

    if (activeView === 'three-way') {
        if (threeWayContainer) threeWayContainer.style.display = 'flex';
        if (editorContainer) editorContainer.style.display = 'none';
        renderThreeWayDiff();
    } else if (activeView === 'unified') {
        if (threeWayContainer) threeWayContainer.style.display = 'flex';
        if (editorContainer) editorContainer.style.display = 'none';
        renderUnifiedDiff();
    } else if (activeView === 'editor') {
        if (threeWayContainer) threeWayContainer.style.display = 'none';
        if (editorContainer) editorContainer.style.display = 'flex';
        renderCodeEditor();
    }
}

function renderConflictCards(conflicts) {
    const container = document.getElementById('conflict-cards-container');
    if (!container) return;
    container.innerHTML = '';

    if (!conflicts || conflicts.length === 0) {
        container.innerHTML = `
            <div class="card-box" style="text-align: center; color: var(--text-muted); padding: 16px;">
                No unresolved conflicts detected for active file.
            </div>
        `;
        return;
    }

    if (!activeResolutions[activeFile]) {
        activeResolutions[activeFile] = {};
    }

    for (const diag of conflicts) {
        const card = document.createElement('div');
        card.className = 'conflict-card';

        const currentRes = activeResolutions[activeFile][diag.id];
        const statusText = currentRes ? `Resolved: ${currentRes.action}` : 'Resolution Required';

        card.innerHTML = `
            <div class="conflict-card-header">
                <span class="conflict-id">${diag.id}</span>
                <span class="badge-tag" style="color: ${diag.caseType === 'CASE_6' ? 'var(--accent-red)' : 'var(--accent-purple)'}">${diag.caseType}</span>
            </div>
            <div class="conflict-reason">${diag.reason}</div>
            
            <div class="snippet-preview-box">
                <div class="snippet-label">Base (Lines ${diag.baseLineStart}-${diag.baseLineEnd}):</div>
                <div class="snippet-block">${escapeHtml(diag.baseSnippet || '[empty]')}</div>

                <div class="snippet-label">Current:</div>
                <div class="snippet-block" style="border-color: var(--diff-add-border);">${escapeHtml(diag.currentSnippet || '[empty]')}</div>

                <div class="snippet-label">Incoming:</div>
                <div class="snippet-block" style="border-color: var(--diff-conflict-border);">${escapeHtml(diag.incomingSnippet || '[empty]')}</div>
            </div>

            <div style="font-size: 10px; color: ${currentRes ? 'var(--accent-green)' : 'var(--accent-amber)'}; font-family: var(--font-mono);">
                Status: ${statusText}
            </div>

            <div class="conflict-actions-grid">
                <button class="btn-resolve ${currentRes && currentRes.action === 'ACCEPT_CURRENT' ? 'active' : ''}" data-act="ACCEPT_CURRENT">Accept Current</button>
                <button class="btn-resolve ${currentRes && currentRes.action === 'ACCEPT_INCOMING' ? 'active' : ''}" data-act="ACCEPT_INCOMING">Accept Incoming</button>
                <button class="btn-resolve ${currentRes && currentRes.action === 'KEEP_BASE' ? 'active' : ''}" data-act="KEEP_BASE">Keep Base</button>
                <button class="btn-resolve ${currentRes && currentRes.action === 'CUSTOM_EDIT' ? 'active' : ''}" data-act="CUSTOM_EDIT">Custom Edit</button>
            </div>
        `;

        card.querySelectorAll('.btn-resolve').forEach(btn => {
            btn.onclick = () => {
                const action = btn.getAttribute('data-act');
                if (action === 'CUSTOM_EDIT') {
                    openCustomEditModal(diag);
                } else {
                    activeResolutions[activeFile][diag.id] = { action, customText: '' };
                    renderThreeWayDiff();
                    renderCodeEditor();
                    showToast(`Conflict ${diag.id} set to ${action}`);
                }
            };
        });

        container.appendChild(card);
    }
}

function openCustomEditModal(diag) {
    const modal = document.getElementById('custom-edit-modal');
    const textarea = document.getElementById('custom-edit-textarea');
    const targetDiagId = document.getElementById('custom-edit-diag-id');
    if (!modal || !textarea) return;

    targetDiagId.textContent = `${diag.id} (${diag.filePath})`;
    textarea.value = diag.currentSnippet || diag.incomingSnippet || diag.baseSnippet || '';
    modal.style.display = 'flex';

    document.getElementById('btn-save-custom-edit').onclick = () => {
        if (!activeResolutions[activeFile]) activeResolutions[activeFile] = {};
        activeResolutions[activeFile][diag.id] = {
            action: 'CUSTOM_EDIT',
            customText: textarea.value
        };
        modal.style.display = 'none';
        renderThreeWayDiff();
        renderCodeEditor();
        showToast(`Custom resolution saved for ${diag.id}`);
    };

    document.getElementById('btn-close-custom-edit').onclick = () => {
        modal.style.display = 'none';
    };
}

function runMergeSimulation() {
    if (!selectedIncomingBranch) {
        showToast('Select an incoming branch first.');
        return;
    }

    const report = repo.simulateMerge(selectedIncomingBranch);
    currentSimulationReport = report;

    document.getElementById('sim-base-ref').textContent = report.baseRef;
    document.getElementById('sim-files-count').textContent = report.filesAnalyzed;
    document.getElementById('sim-clean-count').textContent = report.cleanlyMergedFiles;
    document.getElementById('sim-conflict-count').textContent = report.totalConflicts;

    const tbody = document.getElementById('case-distribution-tbody');
    if (tbody) {
        tbody.innerHTML = '';
        const caseLabels = {
            CASE_1: "Case 1: Identical regions (retain base)",
            CASE_2: "Case 2: Single branch change (auto-accept)",
            CASE_3: "Case 3: Independent regions (auto-combine)",
            CASE_4: "Case 4: Identical modifications (accept once)",
            CASE_5: "Case 5: Overlapping modifications (conflict)",
            CASE_6: "Case 6: Delete vs Modify collision (conflict)"
        };

        for (const [k, count] of Object.entries(report.caseDistribution)) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${caseLabels[k] || k}</td>
                <td style="font-family: var(--font-mono); font-weight: 600; text-align: right;">${count}</td>
            `;
            tbody.appendChild(tr);
        }
    }

    updateFileList();
    showToast(`Simulation complete: ${report.cleanlyMergedFiles} clean, ${report.conflictingFiles} conflicting files.`);
}

function executeMerge() {
    if (!selectedIncomingBranch) {
        showToast('Select an incoming branch first.');
        return;
    }

    const fileResolutions = activeResolutions;
    const mergeResult = repo.merge(selectedIncomingBranch, fileResolutions);

    if (mergeResult.hasConflicts) {
        showToast(`Cannot merge: ${mergeResult.conflicts.length} unresolved conflicts remain.`);
        renderConflictCards(mergeResult.conflicts);
    } else {
        showToast(`Successfully merged branch '${selectedIncomingBranch}' into ${repo.currentBranch}!`);
        activeResolutions = {};
        currentSimulationReport = null;
        updateBranchDropdowns();
        updateFileList();
        renderCommitGraph();
        renderCommitHistory();
        refreshView();
    }
}

function executeCherryPick() {
    const hash = prompt('Enter commit SHA-256 hash or short hash to cherry-pick:');
    if (!hash) return;

    let targetHash = '';
    for (const h of Object.keys(repo.commits)) {
        if (h.startsWith(hash)) {
            targetHash = h;
            break;
        }
    }

    if (!targetHash) {
        showToast(`Commit not found matching: ${hash}`);
        return;
    }

    const res = repo.cherryPick(targetHash, activeResolutions);
    if (res.hasConflicts) {
        showToast(`Cherry-pick created conflicts: manual resolution required.`);
        renderConflictCards(res.conflicts);
    } else {
        showToast(`Successfully cherry-picked commit ${targetHash.substring(0, 7)}!`);
        updateFileList();
        renderCommitGraph();
        renderCommitHistory();
        refreshView();
    }
}

// Canvas Commit Graph Visualizer
function renderCommitGraph() {
    const canvas = document.getElementById('commit-graph-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const nodes = repo.buildCommitGraph();

    const rowHeight = 36;
    const laneWidth = 24;
    const paddingLeft = 16;
    const paddingTop = 20;

    canvas.width = 300;
    canvas.height = Math.max(160, nodes.length * rowHeight + 40);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const laneColors = [
        '#58a6ff', // blue
        '#3fb950', // green
        '#a371f7', // purple
        '#d29922', // amber
        '#f0883e'  // orange
    ];

    const nodePositions = {};

    // 1. Calculate positions
    nodes.forEach((node, idx) => {
        const x = paddingLeft + (node.lane * laneWidth) + 8;
        const y = paddingTop + (idx * rowHeight);
        nodePositions[node.hash] = { x, y, lane: node.lane };
    });

    // 2. Draw connector lines
    nodes.forEach(node => {
        const fromPos = nodePositions[node.hash];
        if (!fromPos) return;

        node.parents.forEach(pHash => {
            const toPos = nodePositions[pHash];
            if (!toPos) return;

            ctx.beginPath();
            ctx.strokeStyle = laneColors[fromPos.lane % laneColors.length];
            ctx.lineWidth = 2;

            if (fromPos.x === toPos.x) {
                ctx.moveTo(fromPos.x, fromPos.y);
                ctx.lineTo(toPos.x, toPos.y);
            } else {
                ctx.moveTo(fromPos.x, fromPos.y);
                const midY = (fromPos.y + toPos.y) / 2;
                ctx.bezierCurveTo(fromPos.x, midY, toPos.x, midY, toPos.x, toPos.y);
            }
            ctx.stroke();
        });
    });

    // 3. Draw nodes and text
    nodes.forEach((node) => {
        const pos = nodePositions[node.hash];
        const color = laneColors[node.lane % laneColors.length];

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = node.isHead ? '#ffffff' : color;
        ctx.fill();
        ctx.strokeStyle = '#0d1117';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (node.isHead) {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
            ctx.strokeStyle = '#58a6ff';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Draw commit short hash and message
        const textX = paddingLeft + ((Math.max(...nodes.map(n => n.lane)) + 1) * laneWidth) + 12;
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.fillStyle = node.isHead ? '#ffffff' : '#8b949e';
        ctx.fillText(node.shortHash, textX, pos.y + 4);

        if (node.branches && node.branches.length > 0) {
            const bTag = `[${node.branches.join(',')}]`;
            ctx.font = '10px "JetBrains Mono", monospace';
            ctx.fillStyle = '#a371f7';
            ctx.fillText(bTag, textX + 56, pos.y + 4);
        }
    });

    canvas.onclick = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        const row = Math.floor((clickY - paddingTop + (rowHeight / 2)) / rowHeight);
        if (row >= 0 && row < nodes.length) {
            const c = nodes[row];
            showCommitDetails(c.hash);
        }
    };
}

function showCommitDetails(hash) {
    const c = repo.commits[hash];
    if (!c) return;
    showToast(`Commit: ${c.hash.substring(0, 8)} - ${c.message}`);
}

function renderCommitHistory() {
    const container = document.getElementById('commit-history-list');
    if (!container) return;
    container.innerHTML = '';

    const nodes = repo.buildCommitGraph();
    nodes.forEach(c => {
        const item = document.createElement('div');
        item.className = `commit-item ${c.hash === repo.headCommit ? 'active' : ''}`;
        item.innerHTML = `
            <div class="commit-meta">
                <span class="commit-hash">${c.shortHash}</span>
                <span style="color: var(--text-muted); font-size: 10px;">${new Date(c.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
            <div class="commit-msg">${escapeHtml(c.message)}</div>
        `;
        item.onclick = () => {
            showCommitDetails(c.hash);
        };
        container.appendChild(item);
    });
}

// Synchronized scrolling across diff columns
function setupSyncScroll() {
    const cols = [
        document.getElementById('diff-col-base'),
        document.getElementById('diff-col-current'),
        document.getElementById('diff-col-incoming')
    ];

    let isSyncing = false;
    cols.forEach(col => {
        if (!col) return;
        col.addEventListener('scroll', () => {
            if (isSyncing) return;
            isSyncing = true;
            const top = col.scrollTop;
            const left = col.scrollLeft;
            cols.forEach(other => {
                if (other && other !== col) {
                    other.scrollTop = top;
                    other.scrollLeft = left;
                }
            });
            isSyncing = false;
        });
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// DOM Setup on load
window.addEventListener('DOMContentLoaded', () => {
    // Preset scenario selector
    const scenarioSelect = document.getElementById('scenario-select');
    if (scenarioSelect) {
        scenarioSelect.onchange = (e) => loadScenario(e.target.value);
    }

    // Branch switcher
    const curSelect = document.getElementById('current-branch-select');
    if (curSelect) {
        curSelect.onchange = (e) => {
            repo.checkout(e.target.value);
            activeResolutions = {};
            currentSimulationReport = null;
            updateBranchDropdowns();
            updateFileList();
            renderCommitGraph();
            renderCommitHistory();
            refreshView();
            showToast(`Switched to branch '${e.target.value}'`);
        };
    }

    // New Branch button
    const btnNewBranch = document.getElementById('btn-new-branch');
    if (btnNewBranch) {
        btnNewBranch.onclick = () => {
            const name = prompt('Enter new branch name:');
            if (name) {
                if (repo.createBranch(name)) {
                    repo.checkout(name);
                    updateBranchDropdowns();
                    renderCommitGraph();
                    renderCommitHistory();
                    showToast(`Created and checked out branch '${name}'`);
                } else {
                    showToast(`Failed to create branch '${name}'`);
                }
            }
        };
    }

    // Incoming branch select
    const incSelect = document.getElementById('incoming-branch-select');
    if (incSelect) {
        incSelect.onchange = (e) => {
            selectedIncomingBranch = e.target.value;
            activeResolutions = {};
            currentSimulationReport = null;
            refreshView();
        };
    }

    // View tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeView = btn.getAttribute('data-view');
            refreshView();
        };
    });

    // Inspector buttons
    document.getElementById('btn-simulate-merge').onclick = runMergeSimulation;
    document.getElementById('btn-execute-merge').onclick = executeMerge;
    document.getElementById('btn-cherry-pick').onclick = executeCherryPick;

    // Code Editor Save
    const btnSaveEditor = document.getElementById('btn-save-editor');
    if (btnSaveEditor) {
        btnSaveEditor.onclick = () => {
            const editor = document.getElementById('code-editor-textarea');
            if (editor) {
                repo.stageFile(activeFile, editor.value);
                showToast(`Saved and staged changes to ${activeFile}`);
                updateFileList();
                renderThreeWayDiff();
            }
        };
    }

    // New Commit form
    const btnCommit = document.getElementById('btn-create-commit');
    if (btnCommit) {
        btnCommit.onclick = () => {
            const input = document.getElementById('commit-msg-input');
            const msg = input.value.trim();
            if (!msg) {
                showToast('Please enter a commit message.');
                return;
            }
            const hash = repo.commit(msg);
            input.value = '';
            showToast(`Created commit: ${hash.substring(0, 7)}`);
            updateFileList();
            renderCommitGraph();
            renderCommitHistory();
            refreshView();
        };
    }

    setupSyncScroll();
    loadScenario('auth_config');
});
