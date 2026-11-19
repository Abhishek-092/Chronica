// Chronica Core Engine - Deterministic JavaScript Mirror
// Matches C++20 Core algorithms: SHA-256, 2D DP LCS, 3-Way Merge, Conflict Classification, Commit DAG

class ChronicaSHA256 {
    static rotr(x, n) {
        return (x >>> n) | (x << (32 - n));
    }
    static ch(x, y, z) {
        return (x & y) ^ (~x & z);
    }
    static maj(x, y, z) {
        return (x & y) ^ (x & z) ^ (y & z);
    }
    static sig0(x) {
        return ChronicaSHA256.rotr(x, 2) ^ ChronicaSHA256.rotr(x, 13) ^ ChronicaSHA256.rotr(x, 22);
    }
    static sig1(x) {
        return ChronicaSHA256.rotr(x, 6) ^ ChronicaSHA256.rotr(x, 11) ^ ChronicaSHA256.rotr(x, 25);
    }
    static gam0(x) {
        return ChronicaSHA256.rotr(x, 7) ^ ChronicaSHA256.rotr(x, 18) ^ (x >>> 3);
    }
    static gam1(x) {
        return ChronicaSHA256.rotr(x, 17) ^ ChronicaSHA256.rotr(x, 19) ^ (x >>> 10);
    }

    static hash(str) {
        const utf8 = new TextEncoder().encode(str);
        const totalBits = utf8.length * 8;
        const paddedLen = Math.ceil((utf8.length + 9) / 64) * 64;
        const buffer = new Uint8Array(paddedLen);
        buffer.set(utf8);
        buffer[utf8.length] = 0x80;

        const view = new DataView(buffer.buffer);
        view.setBigUint64(paddedLen - 8, BigInt(totalBits), false);

        let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
        let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

        const K = [
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
        ];

        const w = new Uint32Array(64);
        for (let chunk = 0; chunk < paddedLen; chunk += 64) {
            for (let i = 0; i < 16; i++) {
                w[i] = view.getUint32(chunk + i * 4, false);
            }
            for (let i = 16; i < 64; i++) {
                w[i] = (ChronicaSHA256.gam1(w[i - 2]) + w[i - 7] + ChronicaSHA256.gam0(w[i - 15]) + w[i - 16]) >>> 0;
            }

            let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
            for (let i = 0; i < 64; i++) {
                const t1 = (h + ChronicaSHA256.sig1(e) + ChronicaSHA256.ch(e, f, g) + K[i] + w[i]) >>> 0;
                const t2 = (ChronicaSHA256.sig0(a) + ChronicaSHA256.maj(a, b, c)) >>> 0;
                h = g;
                g = f;
                f = e;
                e = (d + t1) >>> 0;
                d = c;
                c = b;
                b = a;
                a = (t1 + t2) >>> 0;
            }

            h0 = (h0 + a) >>> 0;
            h1 = (h1 + b) >>> 0;
            h2 = (h2 + c) >>> 0;
            h3 = (h3 + d) >>> 0;
            h4 = (h4 + e) >>> 0;
            h5 = (h5 + f) >>> 0;
            h6 = (h6 + g) >>> 0;
            h7 = (h7 + h) >>> 0;
        }

        const toHex = n => n.toString(16).padStart(8, '0');
        return toHex(h0) + toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4) + toHex(h5) + toHex(h6) + toHex(h7);
    }
}

class LCSEngine {
    static splitLines(text) {
        if (!text) return [];
        const lines = text.split(/\r?\n/);
        if (lines.length > 0 && lines[lines.length - 1] === '') {
            lines.pop();
        }
        return lines;
    }

    static joinLines(lines) {
        return lines.join('\n') + (lines.length > 0 ? '\n' : '');
    }

    static computeTable(seqA, seqB) {
        const m = seqA.length;
        const n = seqB.length;
        const table = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (seqA[i - 1] === seqB[j - 1]) {
                    table[i][j] = table[i - 1][j - 1] + 1;
                } else {
                    table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
                }
            }
        }
        return table;
    }

    static backtrack(seqA, seqB, table) {
        const revOps = [];
        let i = seqA.length;
        let j = seqB.length;

        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && seqA[i - 1] === seqB[j - 1]) {
                revOps.push({ type: 'KEEP', line: seqA[i - 1], oldIdx: i - 1, newIdx: j - 1 });
                i--;
                j--;
            } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
                revOps.push({ type: 'INSERT', line: seqB[j - 1], oldIdx: i, newIdx: j - 1 });
                j--;
            } else if (i > 0 && (j === 0 || table[i - 1][j] >= table[i][j - 1])) {
                revOps.push({ type: 'DELETE', line: seqA[i - 1], oldIdx: i - 1, newIdx: j });
                i--;
            }
        }

        revOps.reverse();
        return revOps;
    }

    static diff(seqA, seqB) {
        const table = LCSEngine.computeTable(seqA, seqB);
        return LCSEngine.backtrack(seqA, seqB, table);
    }
}

class MergeEngine {
    static extractChanges(base, ops) {
        const changes = [];
        let bIdx = 0;
        let k = 0;

        while (k < ops.length) {
            if (ops[k].type === 'KEEP') {
                bIdx++;
                k++;
                continue;
            }

            const ch = {
                baseStart: bIdx,
                baseEnd: bIdx,
                newLines: [],
                baseLines: []
            };

            while (k < ops.length && ops[k].type !== 'KEEP') {
                if (ops[k].type === 'DELETE') {
                    ch.baseLines.push(ops[k].line);
                    bIdx++;
                } else if (ops[k].type === 'INSERT') {
                    ch.newLines.push(ops[k].line);
                }
                k++;
            }
            ch.baseEnd = bIdx;
            changes.push(ch);
        }
        return changes;
    }

    static arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    static mergeText(baseText, currentText, incomingText, filePath = 'file') {
        const baseLines = LCSEngine.splitLines(baseText);
        const currentLines = LCSEngine.splitLines(currentText);
        const incomingLines = LCSEngine.splitLines(incomingText);

        const opsCurrent = LCSEngine.diff(baseLines, currentLines);
        const opsIncoming = LCSEngine.diff(baseLines, incomingLines);

        const changesCurrent = MergeEngine.extractChanges(baseLines, opsCurrent);
        const changesIncoming = MergeEngine.extractChanges(baseLines, opsIncoming);

        const result = {
            hasConflicts: false,
            chunks: [],
            conflicts: [],
            mergedText: '',
            caseCounts: {
                CASE_1: 0,
                CASE_2: 0,
                CASE_3: 0,
                CASE_4: 0,
                CASE_5: 0,
                CASE_6: 0
            }
        };

        let cIdx = 0;
        let iIdx = 0;
        let basePos = 0;
        let conflictCounter = 1;

        let curLineNum = 1;
        let incLineNum = 1;

        while (basePos < baseLines.length || cIdx < changesCurrent.length || iIdx < changesIncoming.length) {
            const nextCStart = (cIdx < changesCurrent.length) ? changesCurrent[cIdx].baseStart : baseLines.length;
            const nextIStart = (iIdx < changesIncoming.length) ? changesIncoming[iIdx].baseStart : baseLines.length;
            const nextChangeStart = Math.min(nextCStart, nextIStart);

            // Case 1: Identical regions
            if (basePos < nextChangeStart) {
                const chunk = {
                    classification: 'CASE_1_IDENTICAL',
                    caseCode: 'CASE_1',
                    isConflict: false,
                    baseLineStart: basePos + 1,
                    baseLineEnd: nextChangeStart,
                    baseLines: [],
                    currentLines: [],
                    incomingLines: [],
                    resolvedLines: []
                };

                for (let b = basePos; b < nextChangeStart; b++) {
                    chunk.baseLines.push(baseLines[b]);
                    chunk.currentLines.push(baseLines[b]);
                    chunk.incomingLines.push(baseLines[b]);
                    chunk.resolvedLines.push(baseLines[b]);
                }
                curLineNum += chunk.baseLines.length;
                incLineNum += chunk.baseLines.length;

                result.chunks.push(chunk);
                result.caseCounts.CASE_1++;
                basePos = nextChangeStart;
                continue;
            }

            const hasC = (cIdx < changesCurrent.length && changesCurrent[cIdx].baseStart <= basePos);
            const hasI = (iIdx < changesIncoming.length && changesIncoming[iIdx].baseStart <= basePos);

            // Independent changes / single branch changes
            if (hasC && !hasI && (iIdx === changesIncoming.length || changesIncoming[iIdx].baseStart > changesCurrent[cIdx].baseEnd)) {
                const ch = changesCurrent[cIdx++];
                const isIndependent = changesIncoming.length > 0;
                const chunk = {
                    classification: isIndependent ? 'CASE_3_INDEPENDENT' : 'CASE_2_CURRENT_ONLY',
                    caseCode: isIndependent ? 'CASE_3' : 'CASE_2',
                    isConflict: false,
                    baseLineStart: ch.baseStart + 1,
                    baseLineEnd: ch.baseEnd,
                    baseLines: ch.baseLines,
                    currentLines: ch.newLines,
                    incomingLines: ch.baseLines,
                    resolvedLines: ch.newLines
                };

                if (isIndependent) result.caseCounts.CASE_3++;
                else result.caseCounts.CASE_2++;

                curLineNum += ch.newLines.length;
                incLineNum += ch.baseLines.length;
                basePos = Math.max(basePos, ch.baseEnd);
                result.chunks.push(chunk);
                continue;
            }

            if (hasI && !hasC && (cIdx === changesCurrent.length || changesCurrent[cIdx].baseStart > changesIncoming[iIdx].baseEnd)) {
                const ch = changesIncoming[iIdx++];
                const isIndependent = changesCurrent.length > 0;
                const chunk = {
                    classification: isIndependent ? 'CASE_3_INDEPENDENT' : 'CASE_2_INCOMING_ONLY',
                    caseCode: isIndependent ? 'CASE_3' : 'CASE_2',
                    isConflict: false,
                    baseLineStart: ch.baseStart + 1,
                    baseLineEnd: ch.baseEnd,
                    baseLines: ch.baseLines,
                    currentLines: ch.baseLines,
                    incomingLines: ch.newLines,
                    resolvedLines: ch.newLines
                };

                if (isIndependent) result.caseCounts.CASE_3++;
                else result.caseCounts.CASE_2++;

                curLineNum += ch.baseLines.length;
                incLineNum += ch.newLines.length;
                basePos = Math.max(basePos, ch.baseEnd);
                result.chunks.push(chunk);
                continue;
            }

            // Cluster overlapping change groups
            const clusterBaseStart = basePos;
            let clusterBaseEnd = basePos;
            const cClusterLines = [];
            const iClusterLines = [];
            const bClusterLines = [];

            if (hasC) clusterBaseEnd = Math.max(clusterBaseEnd, changesCurrent[cIdx].baseEnd);
            if (hasI) clusterBaseEnd = Math.max(clusterBaseEnd, changesIncoming[iIdx].baseEnd);

            let expanded = true;
            while (expanded) {
                expanded = false;
                if (cIdx < changesCurrent.length && changesCurrent[cIdx].baseStart <= clusterBaseEnd) {
                    clusterBaseEnd = Math.max(clusterBaseEnd, changesCurrent[cIdx].baseEnd);
                    cClusterLines.push(...changesCurrent[cIdx].newLines);
                    cIdx++;
                    expanded = true;
                }
                if (iIdx < changesIncoming.length && changesIncoming[iIdx].baseStart <= clusterBaseEnd) {
                    clusterBaseEnd = Math.max(clusterBaseEnd, changesIncoming[iIdx].baseEnd);
                    iClusterLines.push(...changesIncoming[iIdx].newLines);
                    iIdx++;
                    expanded = true;
                }
            }

            for (let b = clusterBaseStart; b < clusterBaseEnd && b < baseLines.length; b++) {
                bClusterLines.push(baseLines[b]);
            }
            basePos = Math.max(basePos, clusterBaseEnd);

            const chunk = {
                baseLineStart: clusterBaseStart + 1,
                baseLineEnd: clusterBaseEnd,
                baseLines: bClusterLines,
                currentLines: cClusterLines,
                incomingLines: iClusterLines,
                resolvedLines: []
            };

            if (MergeEngine.arraysEqual(cClusterLines, iClusterLines)) {
                // Case 4: Identical modifications on both branches
                chunk.classification = 'CASE_4_IDENTICAL_MODS';
                chunk.caseCode = 'CASE_4';
                chunk.isConflict = false;
                chunk.resolvedLines = [...cClusterLines];
                result.caseCounts.CASE_4++;
            } else {
                // Case 6 check: Delete vs Modify collision
                const cDeleted = cClusterLines.length === 0 && bClusterLines.length > 0;
                const iDeleted = iClusterLines.length === 0 && bClusterLines.length > 0;
                const cModified = cClusterLines.length > 0 && !MergeEngine.arraysEqual(cClusterLines, bClusterLines);
                const iModified = iClusterLines.length > 0 && !MergeEngine.arraysEqual(iClusterLines, bClusterLines);

                const diagId = `conflict-${conflictCounter++}`;
                chunk.isConflict = true;
                result.hasConflicts = true;

                if ((cDeleted && iModified) || (iDeleted && cModified)) {
                    chunk.classification = 'CASE_6_DELETE_VS_MODIFY';
                    chunk.caseCode = 'CASE_6';
                    result.caseCounts.CASE_6++;
                    chunk.diagnostic = {
                        id: diagId,
                        filePath,
                        baseLineStart: chunk.baseLineStart,
                        baseLineEnd: chunk.baseLineEnd,
                        currentLineStart: curLineNum,
                        currentLineEnd: curLineNum + cClusterLines.length,
                        incomingLineStart: incLineNum,
                        incomingLineEnd: incLineNum + iClusterLines.length,
                        baseSnippet: bClusterLines.join('\n'),
                        currentSnippet: cClusterLines.join('\n'),
                        incomingSnippet: iClusterLines.join('\n'),
                        reason: 'Delete vs Modify collision: one branch deleted this region while the other branch modified it.',
                        caseType: 'CASE_6'
                    };
                } else {
                    chunk.classification = 'CASE_5_OVERLAPPING_DIFF';
                    chunk.caseCode = 'CASE_5';
                    result.caseCounts.CASE_5++;
                    chunk.diagnostic = {
                        id: diagId,
                        filePath,
                        baseLineStart: chunk.baseLineStart,
                        baseLineEnd: chunk.baseLineEnd,
                        currentLineStart: curLineNum,
                        currentLineEnd: curLineNum + cClusterLines.length,
                        incomingLineStart: incLineNum,
                        incomingLineEnd: incLineNum + iClusterLines.length,
                        baseSnippet: bClusterLines.join('\n'),
                        currentSnippet: cClusterLines.join('\n'),
                        incomingSnippet: iClusterLines.join('\n'),
                        reason: 'Both branches modified the same region differently.',
                        caseType: 'CASE_5'
                    };
                }

                result.conflicts.push(chunk.diagnostic);
                chunk.resolvedLines.push('<<<<<<< CURRENT');
                chunk.resolvedLines.push(...cClusterLines);
                chunk.resolvedLines.push('||||||| BASE');
                chunk.resolvedLines.push(...bClusterLines);
                chunk.resolvedLines.push('=======');
                chunk.resolvedLines.push(...iClusterLines);
                chunk.resolvedLines.push('>>>>>>> INCOMING');
            }

            curLineNum += cClusterLines.length;
            incLineNum += iClusterLines.length;
            result.chunks.push(chunk);
        }

        const finalLines = [];
        for (const chunk of result.chunks) {
            finalLines.push(...chunk.resolvedLines);
        }
        result.mergedText = LCSEngine.joinLines(finalLines);
        return result;
    }

    static applyResolution(mergeResult, resolutions) {
        const finalLines = [];
        for (const chunk of mergeResult.chunks) {
            if (!chunk.isConflict) {
                finalLines.push(...chunk.resolvedLines);
                continue;
            }

            const res = resolutions[chunk.diagnostic.id];
            if (res) {
                if (res.action === 'ACCEPT_CURRENT') {
                    finalLines.push(...chunk.currentLines);
                } else if (res.action === 'ACCEPT_INCOMING') {
                    finalLines.push(...chunk.incomingLines);
                } else if (res.action === 'KEEP_BASE') {
                    finalLines.push(...chunk.baseLines);
                } else if (res.action === 'CUSTOM_EDIT') {
                    const custom = LCSEngine.splitLines(res.customText || '');
                    finalLines.push(...custom);
                }
            } else {
                finalLines.push(...chunk.resolvedLines);
            }
        }
        return LCSEngine.joinLines(finalLines);
    }
}

class ChronicaRepository {
    constructor() {
        this.currentBranch = 'main';
        this.headCommit = '';
        this.branches = {};
        this.commits = {};
        this.blobs = {};
        this.staged = {};
        this.workingTree = {};
    }

    init(defaultBranch = 'main') {
        this.currentBranch = defaultBranch;
        this.headCommit = '';
        this.branches = {};
        this.commits = {};
        this.blobs = {};
        this.staged = {};
        this.workingTree = {};
    }

    storeBlob(content) {
        const hash = ChronicaSHA256.hash(content);
        this.blobs[hash] = content;
        return hash;
    }

    getBlob(hash) {
        return this.blobs[hash] || '';
    }

    createBranch(name) {
        if (!name || this.branches[name]) return false;
        this.branches[name] = this.headCommit;
        return true;
    }

    checkout(branchOrCommit) {
        if (this.branches[branchOrCommit] !== undefined) {
            this.currentBranch = branchOrCommit;
            this.headCommit = this.branches[branchOrCommit];
            this.workingTree = {};
            this.staged = {};
            if (this.headCommit && this.commits[this.headCommit]) {
                const c = this.commits[this.headCommit];
                for (const [path, bHash] of Object.entries(c.files)) {
                    this.workingTree[path] = this.getBlob(bHash);
                }
            }
            return true;
        }

        if (this.commits[branchOrCommit]) {
            this.headCommit = branchOrCommit;
            this.workingTree = {};
            this.staged = {};
            const c = this.commits[branchOrCommit];
            for (const [path, bHash] of Object.entries(c.files)) {
                this.workingTree[path] = this.getBlob(bHash);
            }
            return true;
        }
        return false;
    }

    stageFile(path, content) {
        this.workingTree[path] = content;
        const bHash = this.storeBlob(content);
        this.staged[path] = bHash;
    }

    commit(message, author = 'systems-engineer') {
        const fileBlobs = {};
        if (this.headCommit && this.commits[this.headCommit]) {
            Object.assign(fileBlobs, this.commits[this.headCommit].files);
        }
        Object.assign(fileBlobs, this.staged);

        const treeEntries = Object.keys(fileBlobs).sort().map(k => `${k}:${fileBlobs[k]}`).join('\n');
        const treeHash = ChronicaSHA256.hash(treeEntries);

        const parents = this.headCommit ? [this.headCommit] : [];
        const timestamp = Date.now();

        const rawCommit = `tree ${treeHash}\n${parents.map(p => `parent ${p}`).join('\n')}\nauthor ${author}\ntimestamp ${timestamp}\nmessage ${message}\n`;
        const commitHash = ChronicaSHA256.hash(rawCommit);

        this.commits[commitHash] = {
            hash: commitHash,
            treeHash,
            author,
            timestamp,
            message,
            parents,
            files: fileBlobs
        };

        this.headCommit = commitHash;
        this.branches[this.currentBranch] = commitHash;
        this.staged = {};
        return commitHash;
    }

    findCommonAncestor(hashA, hashB) {
        if (!hashA || !hashB) return '';
        if (hashA === hashB) return hashA;

        const ancestorsA = new Set();
        const qA = [hashA];
        ancestorsA.add(hashA);

        while (qA.length > 0) {
            const cur = qA.shift();
            const c = this.commits[cur];
            if (!c) continue;
            for (const p of c.parents) {
                if (!ancestorsA.has(p)) {
                    ancestorsA.add(p);
                    qA.push(p);
                }
            }
        }

        const qB = [hashB];
        const visitedB = new Set([hashB]);

        while (qB.length > 0) {
            const cur = qB.shift();
            if (ancestorsA.has(cur)) return cur;
            const c = this.commits[cur];
            if (!c) continue;
            for (const p of c.parents) {
                if (!visitedB.has(p)) {
                    visitedB.add(p);
                    qB.push(p);
                }
            }
        }
        return '';
    }

    simulateMerge(incomingRef) {
        const incHash = this.branches[incomingRef] || incomingRef;
        const baseHash = this.findCommonAncestor(this.headCommit, incHash);

        const report = {
            baseRef: baseHash ? baseHash.substring(0, 8) : 'empty',
            currentRef: `${this.currentBranch} (${this.headCommit ? this.headCommit.substring(0, 8) : 'empty'})`,
            incomingRef: `${incomingRef} (${incHash ? incHash.substring(0, 8) : 'empty'})`,
            filesAnalyzed: 0,
            cleanlyMergedFiles: 0,
            conflictingFiles: 0,
            totalConflicts: 0,
            caseDistribution: {
                CASE_1: 0,
                CASE_2: 0,
                CASE_3: 0,
                CASE_4: 0,
                CASE_5: 0,
                CASE_6: 0
            },
            allConflicts: [],
            changedFiles: []
        };

        const cBase = this.commits[baseHash];
        const cHead = this.commits[this.headCommit];
        const cInc = this.commits[incHash];

        const allFiles = new Set();
        if (cBase) Object.keys(cBase.files).forEach(f => allFiles.add(f));
        if (cHead) Object.keys(cHead.files).forEach(f => allFiles.add(f));
        if (cInc) Object.keys(cInc.files).forEach(f => allFiles.add(f));

        for (const path of allFiles) {
            const baseT = cBase && cBase.files[path] ? this.getBlob(cBase.files[path]) : '';
            const headT = cHead && cHead.files[path] ? this.getBlob(cHead.files[path]) : '';
            const incT = cInc && cInc.files[path] ? this.getBlob(cInc.files[path]) : '';

            if (headT === incT && headT === baseT) continue;

            report.filesAnalyzed++;
            report.changedFiles.push(path);

            const res = MergeEngine.mergeText(baseT, headT, incT, path);

            for (const [k, v] of Object.entries(res.caseCounts)) {
                report.caseDistribution[k] += v;
            }

            if (res.hasConflicts) {
                report.conflictingFiles++;
                report.totalConflicts += res.conflicts.length;
                report.allConflicts.push(...res.conflicts);
            } else {
                report.cleanlyMergedFiles++;
            }
        }

        return report;
    }

    merge(incomingRef, fileResolutions = {}) {
        const incHash = this.branches[incomingRef] || incomingRef;
        const baseHash = this.findCommonAncestor(this.headCommit, incHash);

        const cBase = this.commits[baseHash];
        const cHead = this.commits[this.headCommit];
        const cInc = this.commits[incHash];

        const allFiles = new Set();
        if (cBase) Object.keys(cBase.files).forEach(f => allFiles.add(f));
        if (cHead) Object.keys(cHead.files).forEach(f => allFiles.add(f));
        if (cInc) Object.keys(cInc.files).forEach(f => allFiles.add(f));

        const combinedResult = {
            hasConflicts: false,
            conflicts: [],
            fileResults: {},
            caseCounts: { CASE_1: 0, CASE_2: 0, CASE_3: 0, CASE_4: 0, CASE_5: 0, CASE_6: 0 }
        };

        const resolvedContents = {};

        for (const path of allFiles) {
            const baseT = cBase && cBase.files[path] ? this.getBlob(cBase.files[path]) : '';
            const headT = cHead && cHead.files[path] ? this.getBlob(cHead.files[path]) : '';
            const incT = cInc && cInc.files[path] ? this.getBlob(cInc.files[path]) : '';

            const fileRes = MergeEngine.mergeText(baseT, headT, incT, path);
            combinedResult.fileResults[path] = fileRes;

            for (const [k, v] of Object.entries(fileRes.caseCounts)) {
                combinedResult.caseCounts[k] += v;
            }

            const resolutions = fileResolutions[path] || {};
            let finalContent = fileRes.mergedText;

            if (fileRes.hasConflicts) {
                if (Object.keys(resolutions).length >= fileRes.conflicts.length) {
                    finalContent = MergeEngine.applyResolution(fileRes, resolutions);
                } else {
                    combinedResult.hasConflicts = true;
                    combinedResult.conflicts.push(...fileRes.conflicts);
                }
            }

            resolvedContents[path] = finalContent;
        }

        if (!combinedResult.hasConflicts) {
            for (const [path, content] of Object.entries(resolvedContents)) {
                this.stageFile(path, content);
            }

            const fileBlobs = {};
            if (cHead) Object.assign(fileBlobs, cHead.files);
            Object.assign(fileBlobs, this.staged);

            const treeEntries = Object.keys(fileBlobs).sort().map(k => `${k}:${fileBlobs[k]}`).join('\n');
            const treeHash = ChronicaSHA256.hash(treeEntries);

            const parents = [this.headCommit, incHash].filter(Boolean);
            const timestamp = Date.now();
            const msg = `Merge branch '${incomingRef}' into ${this.currentBranch}`;

            const rawCommit = `tree ${treeHash}\n${parents.map(p => `parent ${p}`).join('\n')}\nauthor merge-optimizer\ntimestamp ${timestamp}\nmessage ${msg}\n`;
            const commitHash = ChronicaSHA256.hash(rawCommit);

            this.commits[commitHash] = {
                hash: commitHash,
                treeHash,
                author: 'merge-optimizer',
                timestamp,
                message: msg,
                parents,
                files: fileBlobs
            };

            this.headCommit = commitHash;
            this.branches[this.currentBranch] = commitHash;
            this.staged = {};
        }

        return combinedResult;
    }

    cherryPick(commitHash, fileResolutions = {}) {
        const target = this.commits[commitHash];
        if (!target) return { hasConflicts: true, conflicts: [] };

        const baseHash = target.parents[0] || '';
        const cBase = this.commits[baseHash];
        const cHead = this.commits[this.headCommit];

        const allFiles = new Set([...Object.keys(target.files), ...(cBase ? Object.keys(cBase.files) : [])]);
        const combinedResult = {
            hasConflicts: false,
            conflicts: [],
            caseCounts: { CASE_1: 0, CASE_2: 0, CASE_3: 0, CASE_4: 0, CASE_5: 0, CASE_6: 0 }
        };

        const resolvedContents = {};

        for (const path of allFiles) {
            const baseT = cBase && cBase.files[path] ? this.getBlob(cBase.files[path]) : '';
            const headT = cHead && cHead.files[path] ? this.getBlob(cHead.files[path]) : '';
            const incT = target.files[path] ? this.getBlob(target.files[path]) : '';

            const fileRes = MergeEngine.mergeText(baseT, headT, incT, path);
            for (const [k, v] of Object.entries(fileRes.caseCounts)) {
                combinedResult.caseCounts[k] += v;
            }

            const resolutions = fileResolutions[path] || {};
            let finalContent = fileRes.mergedText;

            if (fileRes.hasConflicts) {
                if (Object.keys(resolutions).length >= fileRes.conflicts.length) {
                    finalContent = MergeEngine.applyResolution(fileRes, resolutions);
                } else {
                    combinedResult.hasConflicts = true;
                    combinedResult.conflicts.push(...fileRes.conflicts);
                }
            }
            resolvedContents[path] = finalContent;
        }

        if (!combinedResult.hasConflicts) {
            for (const [path, content] of Object.entries(resolvedContents)) {
                this.stageFile(path, content);
            }
            this.commit(`Cherry-pick: ${target.message} (${commitHash.substring(0, 7)})`, 'cherry-pick-engine');
        }

        return combinedResult;
    }

    getCommitDelta(commitHash) {
        const target = this.commits[commitHash];
        if (!target) return null;

        const baseHash = target.parents[0] || '';
        const cBase = this.commits[baseHash];
        const allFiles = new Set([...Object.keys(target.files), ...(cBase ? Object.keys(cBase.files) : [])]);

        const delta = {
            commitHash,
            shortHash: commitHash.substring(0, 7),
            message: target.message,
            author: target.author,
            timestamp: target.timestamp,
            parentHash: baseHash,
            files: []
        };

        for (const path of allFiles) {
            const baseT = cBase && cBase.files[path] ? this.getBlob(cBase.files[path]) : '';
            const incT = target.files[path] ? this.getBlob(target.files[path]) : '';

            if (baseT === incT) continue;

            const baseLines = LCSEngine.splitLines(baseT);
            const incLines = LCSEngine.splitLines(incT);
            const ops = LCSEngine.diff(baseLines, incLines);

            let added = 0;
            let deleted = 0;
            for (const op of ops) {
                if (op.type === 'INSERT') added++;
                else if (op.type === 'DELETE') deleted++;
            }

            delta.files.push({
                filePath: path,
                added,
                deleted,
                ops,
                baseText: baseT,
                targetText: incT
            });
        }

        return delta;
    }

    getCommitDepth(hash) {
        let depth = 0;
        let cur = hash;
        const visited = new Set();
        while (cur && !visited.has(cur)) {
            visited.add(cur);
            const c = this.commits[cur];
            if (!c || c.parents.length === 0) break;
            depth++;
            cur = c.parents[0];
        }
        return depth;
    }

    cherryPickBatch(commitHashes, fileResolutions = {}) {
        const sortedCommits = commitHashes
            .map(h => this.commits[h])
            .filter(Boolean)
            .sort((a, b) => {
                const da = this.getCommitDepth(a.hash);
                const db = this.getCommitDepth(b.hash);
                if (da !== db) return da - db;
                return a.timestamp - b.timestamp;
            });

        const applied = [];
        for (const c of sortedCommits) {
            const res = this.cherryPick(c.hash, fileResolutions);
            if (res.hasConflicts) {
                return {
                    success: false,
                    conflictingCommit: c.hash,
                    appliedCount: applied.length,
                    appliedCommits: applied,
                    conflicts: res.conflicts
                };
            }
            applied.push(c.hash);
        }

        return {
            success: true,
            appliedCount: applied.length,
            appliedCommits: applied
        };
    }

    buildCommitGraph() {
        const nodes = [];
        const visited = new Set();
        const queue = [this.headCommit];
        const allCommits = [];

        // Collect all reachable commits from all branch tips
        for (const tip of Object.values(this.branches)) {
            if (tip && !queue.includes(tip)) queue.push(tip);
        }

        while (queue.length > 0) {
            const h = queue.shift();
            if (!h || visited.has(h)) continue;
            visited.add(h);
            const c = this.commits[h];
            if (!c) continue;
            allCommits.push(c);
            for (const p of c.parents) {
                if (!visited.has(p)) queue.push(p);
            }
        }

        allCommits.sort((a, b) => (this.getCommitDepth(b.hash) - this.getCommitDepth(a.hash)) || (b.timestamp - a.timestamp));

        const branchMap = {};
        for (const [bName, bHash] of Object.entries(this.branches)) {
            if (!branchMap[bHash]) branchMap[bHash] = [];
            branchMap[bHash].push(bName);
        }

        const laneAssignments = {};
        let nextLane = 0;

        for (const c of allCommits) {
            if (laneAssignments[c.hash] === undefined) {
                laneAssignments[c.hash] = nextLane++;
            }
            const lane = laneAssignments[c.hash];

            for (let pIdx = 0; pIdx < c.parents.length; pIdx++) {
                const p = c.parents[pIdx];
                if (laneAssignments[p] === undefined) {
                    laneAssignments[p] = (pIdx === 0) ? lane : nextLane++;
                }
            }

            nodes.push({
                hash: c.hash,
                shortHash: c.hash.substring(0, 7),
                parents: c.parents,
                author: c.author,
                timestamp: c.timestamp,
                message: c.message,
                branches: branchMap[c.hash] || [],
                isHead: c.hash === this.headCommit,
                lane
            });
        }

        return nodes;
    }

    toJSON() {
        return {
            currentBranch: this.currentBranch,
            headCommit: this.headCommit,
            branches: this.branches,
            commits: this.commits,
            blobs: this.blobs
        };
    }

    fromJSON(obj) {
        this.currentBranch = obj.currentBranch || 'main';
        this.headCommit = obj.headCommit || '';
        this.branches = obj.branches || {};
        this.commits = obj.commits || {};
        this.blobs = obj.blobs || {};
        this.staged = {};
        this.workingTree = {};
        if (this.headCommit && this.commits[this.headCommit]) {
            for (const [p, h] of Object.entries(this.commits[this.headCommit].files)) {
                this.workingTree[p] = this.getBlob(h);
            }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ChronicaSHA256, LCSEngine, MergeEngine, ChronicaRepository };
}
