#ifndef CHRONICA_MERGE_ENGINE_HPP
#define CHRONICA_MERGE_ENGINE_HPP

#include "chronica/lcs.hpp"
#include <string>
#include <vector>
#include <map>

namespace chronica {

enum class RegionClassification {
    CASE_1_IDENTICAL,
    CASE_2_CURRENT_ONLY,
    CASE_2_INCOMING_ONLY,
    CASE_3_INDEPENDENT,
    CASE_4_IDENTICAL_MODS,
    CASE_5_OVERLAPPING_DIFF,
    CASE_6_DELETE_VS_MODIFY
};

enum class ResolutionAction {
    ACCEPT_CURRENT,
    ACCEPT_INCOMING,
    KEEP_BASE,
    CUSTOM_EDIT
};

struct ConflictDiagnostic {
    std::string id;
    std::string file_path;
    size_t base_line_start;
    size_t base_line_end;
    size_t current_line_start;
    size_t current_line_end;
    size_t incoming_line_start;
    size_t incoming_line_end;
    std::string base_snippet;
    std::string current_snippet;
    std::string incoming_snippet;
    std::string reason;
    std::string case_type;
};

struct MergeChunk {
    RegionClassification classification;
    bool is_conflict;
    size_t base_line_start;
    size_t base_line_end;
    std::vector<std::string> base_lines;
    std::vector<std::string> current_lines;
    std::vector<std::string> incoming_lines;
    std::vector<std::string> resolved_lines;
    ConflictDiagnostic diagnostic;
};

struct MergeResult {
    bool has_conflicts;
    std::vector<MergeChunk> chunks;
    std::vector<ConflictDiagnostic> conflicts;
    std::string merged_text;
    std::map<std::string, size_t> case_counts;
};

struct SimulationReport {
    std::string base_ref;
    std::string current_ref;
    std::string incoming_ref;
    size_t files_analyzed;
    size_t cleanly_merged_files;
    size_t conflicting_files;
    size_t total_conflicts;
    std::map<std::string, size_t> case_distribution;
    std::vector<ConflictDiagnostic> all_conflicts;
    std::vector<std::string> changed_files;
};

class MergeEngine {
public:
    static MergeResult merge_text(
        const std::string& base_text,
        const std::string& current_text,
        const std::string& incoming_text,
        const std::string& file_path = "file"
    );

    static std::string apply_resolution(
        const MergeResult& result,
        const std::map<std::string, std::pair<ResolutionAction, std::string>>& resolutions
    );

    static std::string classification_to_string(RegionClassification c);
};

}

#endif
