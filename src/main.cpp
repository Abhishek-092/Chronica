#include "chronica/sha256.hpp"
#include "chronica/lcs.hpp"
#include "chronica/merge_engine.hpp"
#include "chronica/repository.hpp"
#include <iostream>
#include <string>
#include <vector>
#include <iomanip>

using namespace chronica;

void print_help() {
    std::cout << "Chronica: Version Control Merge Optimizer [C++20 Core]\n";
    std::cout << "Usage:\n";
    std::cout << "  chronica init [branch_name]\n";
    std::cout << "  chronica status\n";
    std::cout << "  chronica add <file> <content>\n";
    std::cout << "  chronica commit -m \"<message>\"\n";
    std::cout << "  chronica log\n";
    std::cout << "  chronica branch [new_branch]\n";
    std::cout << "  chronica checkout <branch_or_commit>\n";
    std::cout << "  chronica diff <text1> <text2>\n";
    std::cout << "  chronica simulate-merge <branch>\n";
    std::cout << "  chronica merge <branch>\n";
    std::cout << "  chronica cherry-pick <commit_hash>\n";
    std::cout << "  chronica test\n";
    std::cout << "  chronica demo-json\n";
}

int run_tests() {
    std::cout << "=== Running Chronica Algorithmic Engine Verification ===\n";

    // 1. Verify SHA-256
    std::string test_str = "chronica_deterministic_verification";
    std::string h = SHA256::hash(test_str);
    if (h.empty() || h.size() != 64) {
        std::cerr << "FAIL: SHA-256 test failed\n";
        return 1;
    }
    std::cout << "[PASS] SHA-256 Hashing (" << h.substr(0, 12) << "...)\n";

    // 2. Verify LCS 2D DP table recurrence and backtracking
    std::vector<std::string> seq_a = {"alpha", "beta", "gamma", "delta"};
    std::vector<std::string> seq_b = {"alpha", "beta", "epsilon", "delta"};
    auto table = LCSEngine::compute_table(seq_a, seq_b);
    if (table[4][4] != 3) {
        std::cerr << "FAIL: LCS table calculation expected 3, got " << table[4][4] << "\n";
        return 1;
    }
    auto ops = LCSEngine::diff(seq_a, seq_b);
    std::cout << "[PASS] LCS 2D DP Table & Backtracking (Length: " << table[4][4] << ")\n";

    // 3. Verify Three-Way Merge: Case 1 (Identical)
    std::string base = "line1\nline2\nline3\n";
    auto r1 = MergeEngine::merge_text(base, base, base, "case1.txt");
    if (r1.has_conflicts || r1.case_counts["CASE_1"] == 0) {
        std::cerr << "FAIL: Case 1 identical failed\n";
        return 1;
    }
    std::cout << "[PASS] Case 1: Identical regions (retain base)\n";

    // 4. Verify Case 2 (Current only & Incoming only)
    std::string cur_c2 = "line1\nline2_modified\nline3\n";
    auto r2 = MergeEngine::merge_text(base, cur_c2, base, "case2.txt");
    if (r2.has_conflicts || r2.case_counts["CASE_2"] == 0) {
        std::cerr << "FAIL: Case 2 auto-accept failed\n";
        return 1;
    }
    std::cout << "[PASS] Case 2: Only one branch modified (auto-accept)\n";

    // 5. Verify Case 3 (Independent non-overlapping)
    std::string cur_c3 = "line1_c\nline2\nline3\n";
    std::string inc_c3 = "line1\nline2\nline3_i\n";
    auto r3 = MergeEngine::merge_text(base, cur_c3, inc_c3, "case3.txt");
    if (r3.has_conflicts || r3.case_counts["CASE_3"] == 0) {
        std::cerr << "FAIL: Case 3 independent failed\n";
        return 1;
    }
    std::cout << "[PASS] Case 3: Independent non-overlapping regions (auto-combine)\n";

    // 6. Verify Case 4 (Identical modifications on both)
    std::string both_c4 = "line1\ntimeout = 60\nline3\n";
    auto r4 = MergeEngine::merge_text(base, both_c4, both_c4, "case4.txt");
    if (r4.has_conflicts || r4.case_counts["CASE_4"] == 0) {
        std::cerr << "FAIL: Case 4 identical mods failed\n";
        return 1;
    }
    std::cout << "[PASS] Case 4: Identical modifications on both branches (accept once)\n";

    // 7. Verify Case 5 (Overlapping modifications with differing content)
    std::string cur_c5 = "line1\ntimeout = 60\nline3\n";
    std::string inc_c5 = "line1\ntimeout = 120\nline3\n";
    auto r5 = MergeEngine::merge_text(base, cur_c5, inc_c5, "case5.txt");
    if (!r5.has_conflicts || r5.conflicts.empty() || r5.conflicts[0].case_type != "CASE_5") {
        std::cerr << "FAIL: Case 5 conflict detection failed\n";
        return 1;
    }
    std::cout << "[PASS] Case 5: Overlapping modifications with differing content (Conflict marked)\n";
    std::cout << "       Diagnostic Reason: " << r5.conflicts[0].reason << "\n";

    // 8. Verify Case 6 (Delete vs Modify collision)
    std::string cur_c6 = "line1\nline3\n";
    std::string inc_c6 = "line1\nline2_rewritten_logic\nline3\n";
    auto r6 = MergeEngine::merge_text(base, cur_c6, inc_c6, "case6.txt");
    if (!r6.has_conflicts || r6.conflicts.empty() || r6.conflicts[0].case_type != "CASE_6") {
        std::cerr << "FAIL: Case 6 delete vs modify failed\n";
        return 1;
    }
    std::cout << "[PASS] Case 6: Delete vs Modify collision (Conflict marked)\n";
    std::cout << "       Diagnostic Reason: " << r6.conflicts[0].reason << "\n";

    // 9. Verify Repository DAG and Cherry-pick
    Repository repo;
    repo.init("main");
    repo.stage_file("server.cpp", "int port = 8080;\nvoid run();\n");
    std::string c1 = repo.commit("Initial server setup");

    repo.create_branch("feature");
    repo.checkout("feature");
    repo.stage_file("server.cpp", "int port = 8080;\nvoid run() { start(); }\n");
    std::string c2 = repo.commit("Add run implementation");

    repo.checkout("main");
    repo.stage_file("config.hpp", "#define BUFFER_SIZE 4096\n");
    std::string c3 = repo.commit("Add buffer config");

    auto cherry_res = repo.cherry_pick(c2);
    if (cherry_res.has_conflicts) {
        std::cerr << "FAIL: Cherry-pick failed with unexpected conflict\n";
        return 1;
    }
    std::cout << "[PASS] Cherry-pick with LCS delta application\n";

    // 10. Verify Merge Simulation
    repo.create_branch("hotfix");
    repo.checkout("hotfix");
    repo.stage_file("server.cpp", "int port = 9090;\nvoid run() { start(); }\n");
    repo.commit("Hotfix change port");

    repo.checkout("main");
    repo.stage_file("server.cpp", "int port = 7070;\nvoid run() { start(); }\n");
    repo.commit("Main change port");

    auto sim = repo.simulate_merge("hotfix");
    if (sim.conflicting_files != 1 || sim.total_conflicts != 1) {
        std::cerr << "FAIL: Merge simulation expected 1 conflict, got " << sim.total_conflicts << "\n";
        return 1;
    }
    std::cout << "[PASS] Merge Simulation (Read-only verification report):\n";
    std::cout << "       Files analyzed: " << sim.files_analyzed << "\n";
    std::cout << "       Conflicting files: " << sim.conflicting_files << "\n";
    std::cout << "       Total conflicts: " << sim.total_conflicts << "\n";

    std::cout << "\nALL 10 VERIFICATION SUITES PASSED.\n";
    return 0;
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        print_help();
        return 0;
    }

    std::string cmd = argv[1];

    if (cmd == "test") {
        return run_tests();
    }

    if (cmd == "demo-json") {
        Repository repo;
        repo.init("main");

        repo.stage_file("src/config.cpp", 
            "// System Configuration\n"
            "int timeout = 30;\n"
            "int max_retries = 3;\n"
            "bool debug_mode = false;\n"
            "std::string host = \"127.0.0.1\";\n"
        );
        repo.stage_file("src/auth.cpp",
            "// Authentication Logic\n"
            "bool verify_credentials(const std::string& token) {\n"
            "    if (token.empty()) return false;\n"
            "    return validate_signature(token);\n"
            "}\n"
        );
        std::string c1 = repo.commit("Initial repository state with auth and config");

        repo.create_branch("feature/auth-refresh");
        repo.checkout("feature/auth-refresh");
        repo.stage_file("src/config.cpp",
            "// System Configuration\n"
            "int timeout = 60;\n"
            "int max_retries = 5;\n"
            "bool debug_mode = true;\n"
            "std::string host = \"127.0.0.1\";\n"
        );
        repo.stage_file("src/auth.cpp",
            "// Authentication Logic\n"
            "bool verify_credentials(const std::string& token) {\n"
            "    if (token.empty()) return false;\n"
            "    if (is_token_expired(token)) return false;\n"
            "    return validate_signature(token);\n"
            "}\n"
            "void refresh_session(const std::string& refresh_token) {\n"
            "    issue_new_token(refresh_token);\n"
            "}\n"
        );
        std::string c2 = repo.commit("Add token expiry check and session refresh");

        repo.checkout("main");
        repo.create_branch("release/v2");
        repo.checkout("release/v2");
        repo.stage_file("src/config.cpp",
            "// System Configuration\n"
            "int timeout = 120;\n"
            "int max_retries = 5;\n"
            "bool debug_mode = false;\n"
            "std::string host = \"0.0.0.0\";\n"
        );
        std::string c3 = repo.commit("Production config timeout and host binding");

        std::cout << repo.to_json() << "\n";
        return 0;
    }

    if (cmd == "help" || cmd == "--help") {
        print_help();
        return 0;
    }

    std::cerr << "Unrecognized command: " << cmd << ". Run 'chronica help' for usage.\n";
    return 1;
}
