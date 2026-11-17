#include "chronica/merge_engine.hpp"
#include <algorithm>
#include <sstream>

namespace chronica {

namespace {

struct BranchChange {
    size_t base_start;
    size_t base_end;
    std::vector<std::string> new_lines;
    std::vector<std::string> base_lines;
};

std::vector<BranchChange> extract_changes(
    const std::vector<std::string>& base,
    const std::vector<EditOp>& ops
) {
    std::vector<BranchChange> changes;
    size_t b_idx = 0;
    size_t k = 0;

    while (k < ops.size()) {
        if (ops[k].type == EditOpType::KEEP) {
            ++b_idx;
            ++k;
            continue;
        }

        BranchChange ch;
        ch.base_start = b_idx;
        while (k < ops.size() && ops[k].type != EditOpType::KEEP) {
            if (ops[k].type == EditOpType::DELETE) {
                ch.base_lines.push_back(ops[k].line);
                ++b_idx;
            } else if (ops[k].type == EditOpType::INSERT) {
                ch.new_lines.push_back(ops[k].line);
            }
            ++k;
        }
        ch.base_end = b_idx;
        changes.push_back(ch);
    }
    return changes;
}

std::string format_snippet(const std::vector<std::string>& lines) {
    std::ostringstream ss;
    for (size_t i = 0; i < lines.size(); ++i) {
        ss << lines[i];
        if (i + 1 < lines.size()) {
            ss << "\n";
        }
    }
    return ss.str();
}

}

std::string MergeEngine::classification_to_string(RegionClassification c) {
    switch (c) {
        case RegionClassification::CASE_1_IDENTICAL: return "Case 1: Identical regions (retain base)";
        case RegionClassification::CASE_2_CURRENT_ONLY: return "Case 2: Current branch modified (auto-accept)";
        case RegionClassification::CASE_2_INCOMING_ONLY: return "Case 2: Incoming branch modified (auto-accept)";
        case RegionClassification::CASE_3_INDEPENDENT: return "Case 3: Independent non-overlapping regions (auto-combine)";
        case RegionClassification::CASE_4_IDENTICAL_MODS: return "Case 4: Identical modifications on both branches (accept once)";
        case RegionClassification::CASE_5_OVERLAPPING_DIFF: return "Case 5: Overlapping modifications with differing content";
        case RegionClassification::CASE_6_DELETE_VS_MODIFY: return "Case 6: Delete vs Modify collision";
    }
    return "Unknown";
}

MergeResult MergeEngine::merge_text(
    const std::string& base_text,
    const std::string& current_text,
    const std::string& incoming_text,
    const std::string& file_path
) {
    auto base_lines = LCSEngine::split_lines(base_text);
    auto current_lines = LCSEngine::split_lines(current_text);
    auto incoming_lines = LCSEngine::split_lines(incoming_text);

    auto ops_current = LCSEngine::diff(base_lines, current_lines);
    auto ops_incoming = LCSEngine::diff(base_lines, incoming_lines);

    auto changes_current = extract_changes(base_lines, ops_current);
    auto changes_incoming = extract_changes(base_lines, ops_incoming);

    MergeResult result;
    result.has_conflicts = false;

    // Track case counts
    result.case_counts["CASE_1"] = 0;
    result.case_counts["CASE_2"] = 0;
    result.case_counts["CASE_3"] = 0;
    result.case_counts["CASE_4"] = 0;
    result.case_counts["CASE_5"] = 0;
    result.case_counts["CASE_6"] = 0;

    size_t c_idx = 0;
    size_t i_idx = 0;
    size_t base_pos = 0;
    size_t conflict_counter = 1;

    size_t cur_line_num = 1;
    size_t inc_line_num = 1;

    while (base_pos < base_lines.size() || c_idx < changes_current.size() || i_idx < changes_incoming.size()) {
        size_t next_c_start = (c_idx < changes_current.size()) ? changes_current[c_idx].base_start : base_lines.size();
        size_t next_i_start = (i_idx < changes_incoming.size()) ? changes_incoming[i_idx].base_start : base_lines.size();

        size_t next_change_start = std::min(next_c_start, next_i_start);

        // Emit unchanged base section (Case 1)
        if (base_pos < next_change_start) {
            MergeChunk chunk;
            chunk.classification = RegionClassification::CASE_1_IDENTICAL;
            chunk.is_conflict = false;
            chunk.base_line_start = base_pos + 1;
            chunk.base_line_end = next_change_start;

            for (size_t b = base_pos; b < next_change_start; ++b) {
                chunk.base_lines.push_back(base_lines[b]);
                chunk.current_lines.push_back(base_lines[b]);
                chunk.incoming_lines.push_back(base_lines[b]);
                chunk.resolved_lines.push_back(base_lines[b]);
            }
            cur_line_num += chunk.base_lines.size();
            inc_line_num += chunk.base_lines.size();

            result.chunks.push_back(chunk);
            result.case_counts["CASE_1"]++;
            base_pos = next_change_start;
            continue;
        }

        // Determine if change groups overlap or are isolated
        bool has_c = (c_idx < changes_current.size() && changes_current[c_idx].base_start <= base_pos);
        bool has_i = (i_idx < changes_incoming.size() && changes_incoming[i_idx].base_start <= base_pos);

        if (has_c && !has_i && (i_idx == changes_incoming.size() || changes_incoming[i_idx].base_start > changes_current[c_idx].base_end)) {
            // Only Current modified in this region
            const auto& ch = changes_current[c_idx++];
            MergeChunk chunk;
            if (!changes_incoming.empty()) {
                chunk.classification = RegionClassification::CASE_3_INDEPENDENT;
                result.case_counts["CASE_3"]++;
            } else {
                chunk.classification = RegionClassification::CASE_2_CURRENT_ONLY;
                result.case_counts["CASE_2"]++;
            }
            chunk.is_conflict = false;
            chunk.base_line_start = ch.base_start + 1;
            chunk.base_line_end = ch.base_end;
            chunk.base_lines = ch.base_lines;
            chunk.current_lines = ch.new_lines;
            chunk.incoming_lines = ch.base_lines;
            chunk.resolved_lines = ch.new_lines;

            cur_line_num += ch.new_lines.size();
            inc_line_num += ch.base_lines.size();

            base_pos = std::max(base_pos, ch.base_end);
            result.chunks.push_back(chunk);
            continue;
        }

        if (has_i && !has_c && (c_idx == changes_current.size() || changes_current[c_idx].base_start > changes_incoming[i_idx].base_end)) {
            // Only Incoming modified in this region
            const auto& ch = changes_incoming[i_idx++];
            MergeChunk chunk;
            if (!changes_current.empty()) {
                chunk.classification = RegionClassification::CASE_3_INDEPENDENT;
                result.case_counts["CASE_3"]++;
            } else {
                chunk.classification = RegionClassification::CASE_2_INCOMING_ONLY;
                result.case_counts["CASE_2"]++;
            }
            chunk.is_conflict = false;
            chunk.base_line_start = ch.base_start + 1;
            chunk.base_line_end = ch.base_end;
            chunk.base_lines = ch.base_lines;
            chunk.current_lines = ch.base_lines;
            chunk.incoming_lines = ch.new_lines;
            chunk.resolved_lines = ch.new_lines;

            cur_line_num += ch.base_lines.size();
            inc_line_num += ch.new_lines.size();

            base_pos = std::max(base_pos, ch.base_end);
            result.chunks.push_back(chunk);
            continue;
        }

        // Both branches have changes in this region: aggregate overlapping scope
        size_t cluster_base_start = base_pos;
        size_t cluster_base_end = base_pos;
        std::vector<std::string> c_cluster_lines;
        std::vector<std::string> i_cluster_lines;
        std::vector<std::string> b_cluster_lines;

        if (has_c) {
            cluster_base_end = std::max(cluster_base_end, changes_current[c_idx].base_end);
        }
        if (has_i) {
            cluster_base_end = std::max(cluster_base_end, changes_incoming[i_idx].base_end);
        }

        // Expand cluster until no overlapping changes remain
        bool expanded = true;
        while (expanded) {
            expanded = false;
            if (c_idx < changes_current.size() && changes_current[c_idx].base_start <= cluster_base_end) {
                cluster_base_end = std::max(cluster_base_end, changes_current[c_idx].base_end);
                c_cluster_lines.insert(c_cluster_lines.end(), changes_current[c_idx].new_lines.begin(), changes_current[c_idx].new_lines.end());
                ++c_idx;
                expanded = true;
            }
            if (i_idx < changes_incoming.size() && changes_incoming[i_idx].base_start <= cluster_base_end) {
                cluster_base_end = std::max(cluster_base_end, changes_incoming[i_idx].base_end);
                i_cluster_lines.insert(i_cluster_lines.end(), changes_incoming[i_idx].new_lines.begin(), changes_incoming[i_idx].new_lines.end());
                ++i_idx;
                expanded = true;
            }
        }

        for (size_t b = cluster_base_start; b < cluster_base_end && b < base_lines.size(); ++b) {
            b_cluster_lines.push_back(base_lines[b]);
        }

        base_pos = std::max(base_pos, cluster_base_end);

        MergeChunk chunk;
        chunk.base_line_start = cluster_base_start + 1;
        chunk.base_line_end = cluster_base_end;
        chunk.base_lines = b_cluster_lines;
        chunk.current_lines = c_cluster_lines;
        chunk.incoming_lines = i_cluster_lines;

        if (c_cluster_lines == i_cluster_lines) {
            // Case 4: Identical modifications on both branches
            chunk.classification = RegionClassification::CASE_4_IDENTICAL_MODS;
            chunk.is_conflict = false;
            chunk.resolved_lines = c_cluster_lines;
            result.case_counts["CASE_4"]++;
        } else {
            // Check for Delete vs Modify collision (Case 6)
            bool c_deleted = c_cluster_lines.empty() && !b_cluster_lines.empty();
            bool i_deleted = i_cluster_lines.empty() && !b_cluster_lines.empty();
            bool c_modified = !c_cluster_lines.empty() && c_cluster_lines != b_cluster_lines;
            bool i_modified = !i_cluster_lines.empty() && i_cluster_lines != b_cluster_lines;

            if ((c_deleted && i_modified) || (i_deleted && c_modified)) {
                chunk.classification = RegionClassification::CASE_6_DELETE_VS_MODIFY;
                chunk.is_conflict = true;
                result.has_conflicts = true;
                result.case_counts["CASE_6"]++;

                std::ostringstream diag_id;
                diag_id << "conflict-" << conflict_counter++;
                ConflictDiagnostic diag;
                diag.id = diag_id.str();
                diag.file_path = file_path;
                diag.base_line_start = chunk.base_line_start;
                diag.base_line_end = chunk.base_line_end;
                diag.current_line_start = cur_line_num;
                diag.current_line_end = cur_line_num + c_cluster_lines.size();
                diag.incoming_line_start = inc_line_num;
                diag.incoming_line_end = inc_line_num + i_cluster_lines.size();
                diag.base_snippet = format_snippet(b_cluster_lines);
                diag.current_snippet = format_snippet(c_cluster_lines);
                diag.incoming_snippet = format_snippet(i_cluster_lines);
                diag.reason = "Delete vs Modify collision: one branch deleted this region while the other branch modified it.";
                diag.case_type = "CASE_6";

                chunk.diagnostic = diag;
                result.conflicts.push_back(diag);

                // Add standard conflict markers for raw view
                chunk.resolved_lines.push_back("<<<<<<< CURRENT");
                chunk.resolved_lines.insert(chunk.resolved_lines.end(), c_cluster_lines.begin(), c_cluster_lines.end());
                chunk.resolved_lines.push_back("||||||| BASE");
                chunk.resolved_lines.insert(chunk.resolved_lines.end(), b_cluster_lines.begin(), b_cluster_lines.end());
                chunk.resolved_lines.push_back("=======");
                chunk.resolved_lines.insert(chunk.resolved_lines.end(), i_cluster_lines.begin(), i_cluster_lines.end());
                chunk.resolved_lines.push_back(">>>>>>> INCOMING");
            } else {
                // Case 5: Overlapping modifications with differing content
                chunk.classification = RegionClassification::CASE_5_OVERLAPPING_DIFF;
                chunk.is_conflict = true;
                result.has_conflicts = true;
                result.case_counts["CASE_5"]++;

                std::ostringstream diag_id;
                diag_id << "conflict-" << conflict_counter++;
                ConflictDiagnostic diag;
                diag.id = diag_id.str();
                diag.file_path = file_path;
                diag.base_line_start = chunk.base_line_start;
                diag.base_line_end = chunk.base_line_end;
                diag.current_line_start = cur_line_num;
                diag.current_line_end = cur_line_num + c_cluster_lines.size();
                diag.incoming_line_start = inc_line_num;
                diag.incoming_line_end = inc_line_num + i_cluster_lines.size();
                diag.base_snippet = format_snippet(b_cluster_lines);
                diag.current_snippet = format_snippet(c_cluster_lines);
                diag.incoming_snippet = format_snippet(i_cluster_lines);
                diag.reason = "Both branches modified the same region differently.";
                diag.case_type = "CASE_5";

                chunk.diagnostic = diag;
                result.conflicts.push_back(diag);

                chunk.resolved_lines.push_back("<<<<<<< CURRENT");
                chunk.resolved_lines.insert(chunk.resolved_lines.end(), c_cluster_lines.begin(), c_cluster_lines.end());
                chunk.resolved_lines.push_back("||||||| BASE");
                chunk.resolved_lines.insert(chunk.resolved_lines.end(), b_cluster_lines.begin(), b_cluster_lines.end());
                chunk.resolved_lines.push_back("=======");
                chunk.resolved_lines.insert(chunk.resolved_lines.end(), i_cluster_lines.begin(), i_cluster_lines.end());
                chunk.resolved_lines.push_back(">>>>>>> INCOMING");
            }
        }

        cur_line_num += c_cluster_lines.size();
        inc_line_num += i_cluster_lines.size();
        result.chunks.push_back(chunk);
    }

    // Assemble merged text from chunks
    std::vector<std::string> final_lines;
    for (const auto& chunk : result.chunks) {
        final_lines.insert(final_lines.end(), chunk.resolved_lines.begin(), chunk.resolved_lines.end());
    }
    result.merged_text = LCSEngine::join_lines(final_lines);

    return result;
}

std::string MergeEngine::apply_resolution(
    const MergeResult& result,
    const std::map<std::string, std::pair<ResolutionAction, std::string>>& resolutions
) {
    std::vector<std::string> final_lines;
    for (const auto& chunk : result.chunks) {
        if (!chunk.is_conflict) {
            final_lines.insert(final_lines.end(), chunk.resolved_lines.begin(), chunk.resolved_lines.end());
            continue;
        }

        auto it = resolutions.find(chunk.diagnostic.id);
        if (it != resolutions.end()) {
            ResolutionAction action = it->second.first;
            if (action == ResolutionAction::ACCEPT_CURRENT) {
                final_lines.insert(final_lines.end(), chunk.current_lines.begin(), chunk.current_lines.end());
            } else if (action == ResolutionAction::ACCEPT_INCOMING) {
                final_lines.insert(final_lines.end(), chunk.incoming_lines.begin(), chunk.incoming_lines.end());
            } else if (action == ResolutionAction::KEEP_BASE) {
                final_lines.insert(final_lines.end(), chunk.base_lines.begin(), chunk.base_lines.end());
            } else if (action == ResolutionAction::CUSTOM_EDIT) {
                auto custom = LCSEngine::split_lines(it->second.second);
                final_lines.insert(final_lines.end(), custom.begin(), custom.end());
            }
        } else {
            // Keep unresolved markers if not resolved
            final_lines.insert(final_lines.end(), chunk.resolved_lines.begin(), chunk.resolved_lines.end());
        }
    }
    return LCSEngine::join_lines(final_lines);
}

}
