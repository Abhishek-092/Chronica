#ifndef CHRONICA_LCS_HPP
#define CHRONICA_LCS_HPP

#include <string>
#include <vector>
#include <cstddef>

namespace chronica {

enum class EditOpType {
    KEEP,
    DELETE,
    INSERT
};

struct EditOp {
    EditOpType type;
    std::string line;
    size_t old_idx;
    size_t new_idx;
};

struct DiffHunk {
    size_t old_start;
    size_t old_count;
    size_t new_start;
    size_t new_count;
    std::vector<EditOp> ops;
};

class LCSEngine {
public:
    static std::vector<std::string> split_lines(const std::string& text);
    static std::string join_lines(const std::vector<std::string>& lines);
    static std::vector<std::vector<int>> compute_table(
        const std::vector<std::string>& seq_x,
        const std::vector<std::string>& seq_y
    );
    static std::vector<EditOp> backtrack(
        const std::vector<std::string>& seq_x,
        const std::vector<std::string>& seq_y,
        const std::vector<std::vector<int>>& table
    );
    static std::vector<EditOp> diff(
        const std::vector<std::string>& seq_x,
        const std::vector<std::string>& seq_y
    );
    static std::vector<DiffHunk> generate_hunks(
        const std::vector<EditOp>& ops,
        size_t context_lines = 3
    );
    static std::string format_unified_diff(
        const std::string& name_a,
        const std::string& name_b,
        const std::vector<DiffHunk>& hunks
    );
};

}

#endif
