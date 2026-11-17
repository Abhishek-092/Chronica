# CHRONICA: VERSION CONTROL MERGE OPTIMIZER USING LONGEST COMMON SUBSEQUENCE

**Created by:**
* Abhishek Kumar Goswami – `25293916005`
* Himanshu Singhal – `25293916042`
* Manish Kumar Meena – `25293916056`

**Contact:**
* +91 9142585002
* +91 9748800440
* +91 7597543130

---

## 1. Introduction

Version control systems allow developers to work on different versions of the same project through branches. One of the more difficult operations is merging these branches when both contain changes to the same files.

**Chronica** is a lightweight version control system focused on improving the merge process. It uses the **Longest Common Subsequence (LCS)** algorithm to identify common portions between different versions of a file and derive the changes made between them. These changes are then used in a three-way merge to determine which modifications can be combined automatically and which require user intervention.

The project combines the algorithmic merge engine with basic version-control features such as commits, branches, checkout, history, and cherry-picking. An optional interactive interface will allow users to visually manage their repository, inspect changes, use an integrated code editor, and resolve merge conflicts.

---

## 2. Problem Statement

When two branches are merged, simply comparing their final versions is not always enough to determine whether their changes conflict.

**For example:**
* **Base:** `ABCDE`

If one branch changes `C` to `X` and another branch adds a line after `E`, both changes can be safely combined.

However, if both branches change `C` differently:
* **Branch A:** `ABXDE`
* **Branch B:** `ABYDE`

The system needs to identify that both modifications originated from the same region of the base version and cannot be automatically combined.

Chronica addresses this problem by using LCS-based difference generation followed by three-way merge analysis.

---

## 3. Objectives

The main objectives of Chronica are:

* Implement the Longest Common Subsequence algorithm using Dynamic Programming.
* Reconstruct the LCS to obtain actual changes between file versions.
* Represent changes as insertions, deletions, and unchanged sections.
* Implement a three-way merge using a common ancestor.
* Automatically combine changes that do not conflict.
* Detect overlapping and conflicting modifications.
* Handle different merge cases such as independent changes, identical changes, same-region modifications, and delete-versus-modify situations.
* Explain why a particular region has been classified as a conflict.
* Design a merge optimizer that reduces unnecessary conflicts while maintaining correctness.
* Implement basic version-control features such as commits, branches, checkout, history, and cherry-picking.
* Provide an optional interactive interface for repository and branch management.
* Provide an integrated code editor and interactive conflict-resolution interface.
* Analyze the time and space complexity of the algorithms and evaluate their practical performance.

---

## 4. Proposed Approach

The main merge pipeline of Chronica is structured as follows:

```
+-----------------------------------+
|           FILE VERSIONS           |
+-----------------------------------+
                  |
                  v
+-----------------------------------+
|                LCS                |
+-----------------------------------+
                  |
                  v
+-----------------------------------+
|      DIFFERENCE / EDIT SCRIPT     |
+-----------------------------------+
                  |
                  v
+-----------------------------------+
|          THREE-WAY MERGE          |
+-----------------------------------+
                  |
                  v
+-----------------------------------+
|         CONFLICT DETECTION        |
+-----------------------------------+
           /             \
          v               v
+-----------------+  +--------------+
| AUTOMATIC MERGE |  | MANUAL MERGE |
+-----------------+  +--------------+
```

The LCS algorithm forms the foundation of the comparison process, while the three-way merge uses the generated differences to make decisions about combining changes.

---

## 5. LCS-Based Difference Generation

The first step is to compare two versions of a file using LCS.

For two sequences $X$ and $Y$, the Dynamic Programming recurrence is:

$$L[i][j] = L[i-1][j-1] + 1 \quad \text{if } X[i] == Y[j]$$

$$L[i][j] = \max(L[i-1][j], L[i][j-1]) \quad \text{otherwise}$$

### Complexity
* **Time Complexity:** $O(n \times m)$
* **Space Complexity:** $O(n \times m)$

*(where $n$ and $m$ are the lengths of the two sequences)*

After calculating the DP table, Chronica backtracks through it to reconstruct the LCS.

**Example:**
* **Version A:** `ABCD`
* **Version B:** `ABXD`
* **LCS:** `ABD`

From this, Chronica constructs an **edit script**:
```text
KEEP   A
KEEP   B
DELETE C
INSERT X
KEEP   D
```

The edit script provides a more useful representation of the changes and is passed to the merge engine.

---

## 6. Three-Way Merge

Chronica uses three versions during a merge:

```
            +--------+
            |  BASE  |
            +--------+
             /      \
            /        \
           v          v
     +---------+  +----------+
     | CURRENT |  | INCOMING |
     +---------+  +----------+
           \          /
            \        /
             v      v
            +-------+
            | MERGE |
            +-------+
```

The base version is the common ancestor of the two branches. The system calculates:
1. $\text{BASE} \rightarrow \text{CURRENT}$
2. $\text{BASE} \rightarrow \text{INCOMING}$

and then compares the resulting changes.

This is critical because the system assesses what each branch changed from the common ancestor, rather than simply comparing the two final files directly.

---

## 7. Handling Different Merge Cases

Chronica explicitly categorizes and handles different types of changes:

### Case 1: No Changes
If neither branch changes a region:
$$\text{BASE} = \text{CURRENT} = \text{INCOMING}$$
* **Result:** Original content is retained.

---

### Case 2: Only One Branch Changes
If only one branch modifies a region, that modification can be automatically accepted.
* **BASE:** `A B C D`
* **CURRENT:** `A B X D`
* **INCOMING:** `A B C D`
* **Result:** `A B X D`

---

### Case 3: Independent Changes
If the branches modify different, non-overlapping regions, both changes can be combined.
* **BASE:** `ABCDE`
* **CURRENT:** `ABXCDE`
* **INCOMING:** `ABCDEY`
* **Result:** `ABXCDEY`
* No conflict is triggered because the modifications do not overlap.

---

### Case 4: Same Change on Both Branches
If both branches make the identical modification:
* **BASE:** `timeout = 30`
* **CURRENT:** `timeout = 60`
* **INCOMING:** `timeout = 60`
* **Result:** Accepted once (`timeout = 60`). No conflict is created when both branches produce identical results.

---

### Case 5: Same Region Modified Differently
If both branches modify the same region differently:
* **BASE:** `timeout = 30`
* **CURRENT:** `timeout = 60`
* **INCOMING:** `timeout = 120`
* **Result:** Conflict identified. The algorithm cannot programmatically determine which modification to prioritize; it is passed to the user for resolution.

---

### Case 6: Delete Versus Modify
If one branch deletes a region while the other modifies it:
* **BASE:** `calculatePrice()`
* **CURRENT:** `[function deleted]`
* **INCOMING:** `calculatePrice()` *(modified)*
* **Result:** Conflict. The system cannot safely choose between deletion and modification without manual intervention.

---

### Case 7: Overlapping Modifications
If both branches make changes over a larger overlapping region, Chronica identifies the entire affected region and presents it for manual review rather than attempting an unreliable automatic merge.

> **Principle:** The objective is not to eliminate every conflict, but to avoid conflicts where changes are compatible while reliably catching cases that require developer intervention.

---

## 8. Merge Optimization

The main algorithmic feature of Chronica is the **Merge Optimizer**.

The optimizer analyzes edit operations generated from the base version and determines how modifications from both branches interact, considering:
* Common subsequences
* Insertions and deletions
* Modified regions and change positions
* Overlapping regions
* Identical changes vs. divergent changes affecting the same base content

> **Core Principle:** Automatic merging should happen **only** when the algorithm can establish that changes are compatible. This keeps the merge process deterministic rather than relying on arbitrary heuristics.

---

## 9. Conflict Explanation

When a conflict is detected, Chronica provides a detailed breakdown explaining why it occurred rather than merely displaying standard conflict markers:

```text
Conflict detected
File: config.cpp
Region: Lines 42-47
Base: timeout = 30
Current: timeout = 60
Incoming: timeout = 120
Reason: Both branches modified the same region differently.
Action: Manual resolution required.
```

---

## 10. Merge Simulation

Before applying a merge, users can perform a dry-run merge simulation:

```text
Current Branch: main
Incoming Branch: feature-auth
Files analyzed: 20
Automatically merged: 17
Conflicting regions: 3
```

This simulation does not modify the current working directory or commit state.

---

## 11. Lightweight Version Control System

Chronica implements a simplified version-control system around the merge engine.

### CLI Commands
* `chronica init`
* `chronica add`
* `chronica commit`
* `chronica status`
* `chronica log`
* `chronica branch`
* `chronica checkout`
* `chronica merge`
* `chronica cherry-pick`

Commits store project snapshots along with their parent commit links.

```
       [ C1 ]
         |
         v
       [ C2 ]
       /    \
      v      v
   [ C3 ]  [ C4 ]
      \      /
       v    v
       [ C5 ]
```

Chronica uses cryptographic hashing (SHA-256) to identify stored objects, providing a simplified content-addressable storage model.

---

## 12. Cherry-Picking

Chronica supports cherry-picking individual commits:

$$C_1 \rightarrow C_2 \rightarrow C_3 \rightarrow C_4$$
$$\uparrow$$
$$\text{Cherry-pick } C_3$$

1. Determines the changes introduced by $C_3$ relative to its parent $C_2$.
2. Applies those changes to the current branch.
3. Uses the same merge and conflict-resolution engine if conflicts arise.

---

## 13. Interactive User Interface

In addition to the CLI, Chronica provides an optional graphical user interface:

```
        +---------------+
        | CHRONICA CORE |
        +---------------+
          /           \
         v             v
     +-------+     +------+
     |  CLI  |     |  UI  |
     +-------+     +------+
          \           /
           v         v
        +---------------+
        |  MERGE ENGINE |
        +---------------+
```

### UI Features:
* View repository status
* Create, switch, delete, or rename branches
* View commits and explore the commit graph
* Compare branches
* Stage, commit, and cherry-pick
* Simulate and perform merges
* Inspect and resolve conflicts

---

## 14. Integrated Code Editor

The interactive interface includes a lightweight code editor with:
* File explorer
* Syntax highlighting
* Search
* Modified-line indicators
* Diff & conflict highlighting
* In-editor editing, saving, and staging

---

## 15. Interactive Conflict Resolution

For conflicting segments, the UI provides a three-way comparison view:

| BASE | CURRENT | INCOMING |
| :--- | :--- | :--- |
| `timeout = 30` | `timeout = 60` | `timeout = 120` |

**Options available to the developer:**
* **Use Current**
* **Use Incoming**
* **Use Base**
* **Edit Manually**

---

## 16. Visual Branch and Commit Graph

The UI displays visual branch and commit trees:

```
  [ C1 ]
    |
  [ C2 ]
  /    \
[ C3 ] [ C4 ]
  |      |
[ C5 ] [ C6 ]
  \    /
  [ C7 ] (MERGE)
```

Selecting a commit displays:
* Commit ID & Parent commit hash
* Commit message & author info
* Changed files, insertions, deletions, and unified diffs

---

## 17. Complexity Analysis

| Component / Operation | Time Complexity | Space Complexity | Notes |
| :--- | :--- | :--- | :--- |
| **Longest Common Subsequence (DP)** | $O(n \times m)$ | $O(n \times m)$ | Table reconstruction requires $O(nm)$ space; length-only can be optimized to $O(\min(n, m))$. |
| **Difference Generation (Backtracking)** | $O(n + m)$ | $O(n + m)$ | Traverses back from cell $(n, m)$ to $(0, 0)$. |
| **Three-Way Merge** | $O(nm + nk)$ | $O(nm + nk)$ | Dominated by two LCS passes from base ($n$) against current ($m$) and incoming ($k$). Region analysis is linear. |
| **Commit Graph Operations** | $O(V + E)$ | $O(V)$ | Graph traversals where $V$ is commits and $E$ is parent relationships. |
| **Hash-Based Object Lookup** | $O(1)$ *(avg)* | $O(N)$ | Hash table storage over $N$ stored objects. |

---

## 18. Tech Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Core / Backend** | C++20 | Implements the version-control system and merge engine |
| **Frontend / UI** | HTML5 | Structures the interactive user interface |
| **Frontend Styling** | CSS3 | Handles layout and visual presentation |
| **Frontend Logic** | Vanilla JavaScript | Interactivity and core communication without external frameworks |
| **Build System** | CMake | Manages compilation and project builds |
| **Repository Storage** | Local File System | Stores repository objects and internal data |
| **Metadata** | JSON | Lightweight structured repository metadata |
| **Object Identification** | SHA-256 | Cryptographic identifiers for repository objects |
| **Version Control** | Git | Manages the development source code |
| **Hosting & Collaboration** | GitHub | Project repository hosting |

---

## 19. Expected Outcome

The final prototype provides a lightweight version control system capable of:
* Tracking files through snapshots and commits.
* Creating and switching branches.
* Comparing versions using dynamic programming LCS.
* Generating human-readable edit scripts.
* Performing three-way merges with automatic resolution for compatible changes.
* Reliably identifying and explaining merge conflicts.
* Simulating merges prior to execution.
* Cherry-picking specific commits across branches.
* Providing a visual commit history graph.
* Providing an integrated code editor with three-way interactive conflict resolution.

---

## 20. Conclusion

**Chronica** uses the Longest Common Subsequence algorithm and Dynamic Programming to compare different versions of files and generate the changes between them. These changes are used in a three-way merge process to combine compatible modifications and identify cases where manual conflict resolution is required.

The system provides the fundamental components of a version-control system—commits, branches, history, checkout, and cherry-picking—complemented by an interactive interface that allows users to inspect differences, simulate merges, and resolve conflicts visually. Chronica unifies Dynamic Programming, sequence comparison, graph traversal, and content hashing into a cohesive, deterministic version-control tool.