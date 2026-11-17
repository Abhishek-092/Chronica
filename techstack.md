# Chronica — Tech Stack

## 1. Core Language

- **C++20**
  - Core application language
  - LCS and Dynamic Programming algorithms
  - Diff generation
  - Three-way merge
  - Conflict detection
  - Repository and object management
  - CLI implementation

## 2. Build System

- **CMake**
  - Cross-platform build configuration
  - Dependency management
  - Debug/Release builds
  - Test and benchmark targets

## 3. Version Control Core

Chronica will implement its own lightweight version-control layer using C++.

### Core Components

- Repository initialization
- File staging
- Commits
- Branches
- Checkout
- Commit history
- Diff generation
- Three-way merge
- Conflict detection
- Conflict resolution
- Cherry-picking
- Repository status

## 4. Algorithms

### Longest Common Subsequence (LCS)

- Dynamic Programming
- Optimized memory usage
- LCS reconstruction
- Edit-script generation

### Diff Engine

- Line-based comparison
- Insertions
- Deletions
- Modifications
- Unchanged regions

### Three-Way Merge

- Base version
- Current branch
- Incoming branch
- Automatic merge
- Conflict detection
- Manual conflict resolution

## 5. Storage

- **Local Filesystem**
- **Content-addressed object storage**
- **SHA-256 hashing**
- **JSON** for lightweight metadata where appropriate

### Repository Structure

.chronica/
├── objects/
├── refs/
├── HEAD
├── index
└── config

### Storage Principles

- Avoid unnecessary duplication
- Reuse identical objects
- Store commits as metadata + references
- Keep branches lightweight
- Avoid loading entire repositories into memory
- Optimize disk and memory usage
- Target Git-like storage efficiency

## 6. CLI

- **Native C++ CLI**
- Terminal-first interface
- No GUI dependency

### Example Commands

```bash
ron init
ron status
ron add <file>
ron commit -m "message"
ron log
ron branch <name>
ron checkout <branch>
ron diff
ron merge <branch>
ron cherry-pick <commit>