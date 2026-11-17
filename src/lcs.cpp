#include "chronica/lcs.hpp"
#include <algorithm>
#include <sstream>

namespace chronica {

std::vector<std::string> LCSEngine::split_lines(const std::string& text) {
    std::vector<std::string> lines;
    if (text.empty()) {
        return lines;
    }
    std::string current;
    for (size_t i = 0; i < text.size(); ++i) {
        char ch = text[i];
        if (ch == '\r') {
            if (i + 1 < text.size() && text[i + 1] == '\n') {
                ++i;
            }
            lines.push_back(current);
            current.clear();
        } else if (ch == '\n') {
            lines.push_back(current);
            current.clear();
        } else {
            current.push_back(ch);
        }
    }
    if (!current.empty() || (!text.empty() && (text.back() == '\n' || text.back() == '\r'))) {
        lines.push_back(current);
    }
    return lines;
}

std::string LCSEngine::join_lines(const std::vector<std::string>& lines) {
    std::ostringstream ss;
    for (size_t i = 0; i < lines.size(); ++i) {
        ss << lines[i] << "\n";
    }
    return ss.str();
}

std::vector<std::vector<int>> LCSEngine::compute_table(
    const std::vector<std::string>& seq_x,
    const std::vector<std::string>& seq_y
) {
    const size_t m = seq_x.size();
    const size_t n = seq_y.size();
    std::vector<std::vector<int>> table(m + 1, std::vector<int>(n + 1, 0));

    for (size_t i = 1; i <= m; ++i) {
        for (size_t j = 1; j <= n; ++j) {
            if (seq_x[i - 1] == seq_y[j - 1]) {
                // Table recurrence for matched line
                table[i][j] = table[i - 1][j - 1] + 1;
            } else {
                table[i][j] = std::max(table[i - 1][j], table[i][j - 1]);
            }
        }
    }
    return table;
}

std::vector<EditOp> LCSEngine::backtrack(
    const std::vector<std::string>& seq_x,
    const std::vector<std::string>& seq_y,
    const std::vector<std::vector<int>>& table
) {
    std::vector<EditOp> rev_ops;
    size_t i = seq_x.size();
    size_t j = seq_y.size();

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && seq_x[i - 1] == seq_y[j - 1]) {
            rev_ops.push_back({EditOpType::KEEP, seq_x[i - 1], i - 1, j - 1});
            --i;
            --j;
        } else if (j > 0 && (i == 0 || table[i][j - 1] >= table[i - 1][j])) {
            rev_ops.push_back({EditOpType::INSERT, seq_y[j - 1], i, j - 1});
            --j;
        } else if (i > 0 && (j == 0 || table[i - 1][j] >= table[i][j - 1])) {
            rev_ops.push_back({EditOpType::DELETE, seq_x[i - 1], i - 1, j});
            --i;
        }
    }

    std::reverse(rev_ops.begin(), rev_ops.end());
    return rev_ops;
}

std::vector<EditOp> LCSEngine::diff(
    const std::vector<std::string>& seq_x,
    const std::vector<std::string>& seq_y
) {
    auto table = compute_table(seq_x, seq_y);
    return backtrack(seq_x, seq_y, table);
}

std::vector<DiffHunk> LCSEngine::generate_hunks(
    const std::vector<EditOp>& ops,
    size_t context_lines
) {
    std::vector<DiffHunk> hunks;
    if (ops.empty()) {
        return hunks;
    }

    std::vector<size_t> change_indices;
    for (size_t k = 0; k < ops.size(); ++k) {
        if (ops[k].type != EditOpType::KEEP) {
            change_indices.push_back(k);
        }
    }

    if (change_indices.empty()) {
        return hunks;
    }

    struct Group {
        size_t start_idx;
        size_t end_idx;
    };
    std::vector<Group> groups;

    for (size_t idx : change_indices) {
        size_t g_start = (idx >= context_lines) ? idx - context_lines : 0;
        size_t g_end = std::min(ops.size() - 1, idx + context_lines);
        if (groups.empty() || g_start > groups.back().end_idx + 1) {
            groups.push_back({g_start, g_end});
        } else {
            groups.back().end_idx = std::max(groups.back().end_idx, g_end);
        }
    }

    for (const auto& grp : groups) {
        DiffHunk hunk;
        hunk.old_start = 0;
        hunk.old_count = 0;
        hunk.new_start = 0;
        hunk.new_count = 0;

        bool first_old = true;
        bool first_new = true;

        for (size_t k = grp.start_idx; k <= grp.end_idx; ++k) {
            const auto& op = ops[k];
            hunk.ops.push_back(op);
            if (op.type == EditOpType::KEEP) {
                if (first_old) { hunk.old_start = op.old_idx + 1; first_old = false; }
                if (first_new) { hunk.new_start = op.new_idx + 1; first_new = false; }
                hunk.old_count++;
                hunk.new_count++;
            } else if (op.type == EditOpType::DELETE) {
                if (first_old) { hunk.old_start = op.old_idx + 1; first_old = false; }
                hunk.old_count++;
            } else if (op.type == EditOpType::INSERT) {
                if (first_new) { hunk.new_start = op.new_idx + 1; first_new = false; }
                hunk.new_count++;
            }
        }
        if (first_old) hunk.old_start = (hunk.ops.empty() ? 1 : hunk.ops.front().old_idx + 1);
        if (first_new) hunk.new_start = (hunk.ops.empty() ? 1 : hunk.ops.front().new_idx + 1);
        hunks.push_back(hunk);
    }

    return hunks;
}

std::string LCSEngine::format_unified_diff(
    const std::string& name_a,
    const std::string& name_b,
    const std::vector<DiffHunk>& hunks
) {
    std::ostringstream ss;
    ss << "--- " << name_a << "\n";
    ss << "+++ " << name_b << "\n";
    for (const auto& hunk : hunks) {
        ss << "@@ -" << hunk.old_start << "," << hunk.old_count
           << " +" << hunk.new_start << "," << hunk.new_count << " @@\n";
        for (const auto& op : hunk.ops) {
            if (op.type == EditOpType::KEEP) {
                ss << " " << op.line << "\n";
            } else if (op.type == EditOpType::DELETE) {
                ss << "-" << op.line << "\n";
            } else if (op.type == EditOpType::INSERT) {
                ss << "+" << op.line << "\n";
            }
        }
    }
    return ss.str();
}

}
