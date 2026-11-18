# Chronica: Version Control Merge Optimizer

An interactive, deterministic three-way merge and lightweight version control engine based on the Longest Common Subsequence (LCS) algorithm.

---

## 1. System Architecture

Chronica consists of two interchangeable, deterministic implementations designed with clean separation of concerns:
- **Core C++ Engine**: Standard C++20 implementation (`include/chronica/`, `src/`) with zero external library dependencies.
- **Client & Web UI**: Plain HTML5, CSS3, and modern Vanilla ES6+ mirror (`web/`) providing an interactive developer interface with zero setup friction.

```text
+------------------------------------------------------------------------+
|                          CHRONICA ARCHITECTURE                         |
+------------------------------------------------------------------------+
|                                                                        |
|  [ Data Structures ]                                                   |
|  * SHA256 Content Hashing (Blobs, Trees, Commits)                      |
|  * Commit DAG (Lanes, Parents, History, Common Ancestor)               |
|  * Branch & Head Management, Staging Index                             |
|                                                                        |
|  [ LCS Engine ]                                                        |
|  * 2D DP Recurrence L[i][j] = L[i-1][j-1]+1 or max(L[i-1][j], L[i][j-1])|
|  * Backtracking for Edit Operations: KEEP, DELETE, INSERT              |
|  * Hunk & Unified Diff Generation                                      |
|                                                                        |
|  [ Three-Way Merge Engine ]                                            |
|  * Base-Aligned Diff Analysis: BASE -> CURRENT & BASE -> INCOMING      |
|  * Deterministic Region Clustering & Conflict Classification          |
|    - Case 1: Identical regions (retain base)                           |
|    - Case 2: Only one branch modified (auto-accept)                    |
|    - Case 3: Independent non-overlapping regions (auto-combine)        |
|    - Case 4: Identical modifications on both branches (accept once)    |
|    - Case 5: Overlapping modifications with differing content (conflict)|
|    - Case 6: Delete vs Modify collision (conflict)                    |
|  * Conflict Explainer with structured diagnostics                      |
|  * Merge Simulation (dry-run reports)                                  |
|  * Cherry-Picking via LCS delta application                            |
|                                                                        |
+------------------------------------------------------------------------+
```

---

## 2. Algorithmic Specifications

### 2.1 Dynamic Programming LCS Table Recurrence

For sequence $X$ of length $m$ and sequence $Y$ of length $n$:
$$L[i][j] = \begin{cases} 0 & \text{if } i = 0 \lor j = 0 \\ L[i-1][j-1] + 1 & \text{if } X[i-1] = Y[j-1] \\ \max(L[i-1][j], L[i][j-1]) & \text{otherwise} \end{cases}$$

Backtracking traverses from $(m, n)$ to $(0, 0)$ to reconstruct the edit script:
- `KEEP`: Matched line in both versions.
- `DELETE`: Line present in source but removed in target.
- `INSERT`: Line absent in source and added in target.

### 2.2 Three-Way Merge Chunking & Alignment

Given base sequence $B$, current sequence $C$, and incoming sequence $I$:
1. $E_{C} = \text{diff}(B, C)$
2. $E_{I} = \text{diff}(B, I)$
3. Changes from $E_{C}$ and $E_{I}$ are indexed against base line intervals $[s, e)$.
4. Non-overlapping base intervals are combined automatically.
5. Overlapping intervals are classified into Cases 1 through 6.

### 2.3 Conflict Diagnostic Data Structure

Every detected conflict generates a structured diagnostic record:
```json
{
  "id": "conflict-1",
  "file_path": "src/config.cpp",
  "base_line_start": 2,
  "base_line_end": 4,
  "current_line_start": 2,
  "current_line_end": 4,
  "incoming_line_start": 2,
  "incoming_line_end": 4,
  "base_snippet": "int timeout = 30;\nint max_retries = 3;",
  "current_snippet": "int timeout = 60;\nint max_retries = 5;",
  "incoming_snippet": "int timeout = 120;\nint max_retries = 5;",
  "reason": "Both branches modified the same region differently.",
  "case_type": "CASE_5"
}
```

---

## 3. Directory Layout

```text
c:\Chronica\
|-- CMakeLists.txt                # CMake build definition
|-- include\chronica\
|   |-- sha256.hpp                # SHA-256 cryptographic hasher
|   |-- lcs.hpp                   # 2D DP LCS table & diff engine
|   |-- merge_engine.hpp          # Three-way merge & conflict explainer
|   +-- repository.hpp            # In-memory/JSON commit DAG & branch manager
|-- src\
|   |-- sha256.cpp                # Pure C++ SHA-256 implementation
|   |-- lcs.cpp                   # Dynamic programming table & backtracking
|   |-- merge_engine.cpp          # Region classification & merge optimizer
|   |-- repository.cpp            # Commit DAG, cherry-pick, and serialization
|   +-- main.cpp                  # CLI entry point and verification suites
|-- web\
|   |-- index.html                # Standalone UI interface
|   |-- css\chronica.css          # Developer-tool slate dark design system
|   +-- js\
|       |-- chronica_core.js      # Deterministic ES6+ core engine mirror
|       +-- app.js                # UI controller, DAG renderer & split viewer
|-- server.py                     # Lightweight Python static server (port 7070)
+-- server.js                     # Lightweight Node static server (port 7070)
```

---

## 4. Building and Running

### 4.1 Native C++ CLI

#### Build with g++:
```bash
g++ -std=c++20 -I include src/sha256.cpp src/lcs.cpp src/merge_engine.cpp src/repository.cpp src/main.cpp -o chronica.exe
```

#### Build with CMake:
```bash
cmake -B build
cmake --build build --config Release
```

#### Run Algorithmic Verification Test Suite:
```bash
./chronica.exe test
```

Verification suite checks:
1. SHA-256 content addressing
2. 2D DP LCS table computation and backtracking
3. Case 1: Identical regions (retain base)
4. Case 2: Only one branch modified (auto-accept)
5. Case 3: Independent non-overlapping regions (auto-combine)
6. Case 4: Identical modifications on both branches (accept once)
7. Case 5: Overlapping modifications with differing content (marked conflict)
8. Case 6: Delete vs Modify collision (marked conflict)
9. Cherry-picking with LCS delta application
10. Read-only merge simulation reporting

### 4.2 Web User Interface

The web interface is standalone and can be opened directly or served locally.

#### Option A: Run with Node.js
```bash
node server.js
```
Open `http://localhost:7070` in any browser.

#### Option B: Run with Python
```bash
python server.py
```
Open `http://localhost:7070` in any browser.

#### Option C: Direct File Access
Open `web/index.html` directly in any web browser without needing any server.

---

## 5. Web UI & Multi-Page Architecture

The web interface provides an original, minimalist white developer-tool layout organized across dedicated pages:

- **Landing Page: My Repositories (`#repositories`)**:
  - Displays all 8 pre-configured benchmark repositories matching the project documentation cases:
    1. `case-1-identical-regions`: Base retention for unchanged sections.
    2. `case-2-single-branch-mod`: Auto-accepting unilateral branch modifications.
    3. `case-3-independent-regions`: Auto-combining independent non-overlapping line ranges.
    4. `case-4-identical-modifications`: Single-acceptance of identical edits on both branches.
    5. `case-5-overlapping-differing`: Flagging conflicting modifications on same lines with structured diagnostics.
    6. `case-6-delete-vs-modify`: Delete vs modify collision detection and structured diagnostics.
    7. `case-7-multi-file-system`: Complex multi-file service benchmark.
    8. `cherry-pick-workbench`: Dedicated workbench specifically designed for cherry-picking experiments.
  - Search filter and direct action shortcuts ("Explore Code", "Cherry-Pick", "Merge").

- **Page: Code & Files (`#repo/<id>/code`)**:
  - Branch switcher and tree explorer.
  - Source editor with working tree staging capability.

- **Page: Commit Graph (`#repo/<id>/graph`)**:
  - Full-screen visual commit DAG with branch lanes, parent connectors, and commit metadata.

- **Page: Three-Way Merge Optimizer (`#repo/<id>/merge`)**:
  - Synchronized three-way split diff viewer (Base Ancestor, Current HEAD, Incoming).
  - Dry-run merge simulation report with Case 1 through Case 6 distribution metrics.
  - Structured conflict explainer diagnostic cards with one-click resolution actions:
    `[Accept Current]`, `[Accept Incoming]`, `[Keep Base]`, `[Custom Edit]`.

- **Page: Cherry-Pick Studio (`#repo/<id>/cherry-pick`)**:
  - Dedicated workbench focusing on cherry-picking operations:
    - Target branch and source branch selection.
    - Individual commit selection via checkboxes.
    - Range commit selection: click start commit, click end commit to span all intermediate commits.
    - Commit delta inspector showing line-by-line insertions, deletions, and unified diff preview before applying.
    - Batch cherry-pick execution: applies selected commits in topological chronological order via three-way merge.
