#include "chronica/repository.hpp"
#include "chronica/sha256.hpp"
#include <chrono>
#include <queue>
#include <sstream>
#include <algorithm>

namespace chronica {

namespace {

int64_t current_time_ms() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()
    ).count();
}

std::string escape_json(const std::string& s) {
    std::ostringstream o;
    for (char c : s) {
        if (c == '"') o << "\\\"";
        else if (c == '\\') o << "\\\\";
        else if (c == '\b') o << "\\b";
        else if (c == '\f') o << "\\f";
        else if (c == '\n') o << "\\n";
        else if (c == '\r') o << "\\r";
        else if (c == '\t') o << "\\t";
        else if (static_cast<unsigned char>(c) <= 0x1f) {
            o << "\\u00" << ((c >> 4) < 10 ? (char)('0' + (c >> 4)) : (char)('a' + (c >> 4) - 10))
                         << ((c & 0xf) < 10 ? (char)('0' + (c & 0xf)) : (char)('a' + (c & 0xf) - 10));
        } else {
            o << c;
        }
    }
    return o.str();
}

}

Repository::Repository() : current_branch_("main"), head_commit_("") {}

bool Repository::init(const std::string& default_branch) {
    current_branch_ = default_branch;
    head_commit_ = "";
    branches_.clear();
    commits_.clear();
    blobs_.clear();
    index_staged_.clear();
    working_tree_.clear();
    return true;
}

std::string Repository::store_blob(const std::string& content) {
    std::string hash = SHA256::hash(content);
    blobs_[hash] = content;
    return hash;
}

std::string Repository::get_blob(const std::string& blob_hash) const {
    auto it = blobs_.find(blob_hash);
    if (it != blobs_.end()) {
        return it->second;
    }
    return "";
}

bool Repository::create_branch(const std::string& branch_name) {
    if (branch_name.empty() || branches_.find(branch_name) != branches_.end()) {
        return false;
    }
    branches_[branch_name] = head_commit_;
    return true;
}

bool Repository::checkout(const std::string& branch_or_commit) {
    auto it_b = branches_.find(branch_or_commit);
    if (it_b != branches_.end()) {
        current_branch_ = branch_or_commit;
        head_commit_ = it_b->second;
        working_tree_.clear();
        index_staged_.clear();
        if (!head_commit_.empty()) {
            const Commit* c = get_commit(head_commit_);
            if (c) {
                for (const auto& kv : c->file_blobs) {
                    working_tree_[kv.first] = get_blob(kv.second);
                }
            }
        }
        return true;
    }

    auto it_c = commits_.find(branch_or_commit);
    if (it_c != commits_.end()) {
        head_commit_ = branch_or_commit;
        working_tree_.clear();
        index_staged_.clear();
        for (const auto& kv : it_c->second.file_blobs) {
            working_tree_[kv.first] = get_blob(kv.second);
        }
        return true;
    }
    return false;
}

bool Repository::stage_file(const std::string& path, const std::string& content) {
    working_tree_[path] = content;
    std::string b_hash = store_blob(content);
    index_staged_[path] = b_hash;
    return true;
}

bool Repository::unstage_file(const std::string& path) {
    auto it = index_staged_.find(path);
    if (it != index_staged_.end()) {
        index_staged_.erase(it);
        return true;
    }
    return false;
}

std::string Repository::get_working_file(const std::string& path) const {
    auto it = working_tree_.find(path);
    if (it != working_tree_.end()) {
        return it->second;
    }
    return "";
}

void Repository::set_working_file(const std::string& path, const std::string& content) {
    working_tree_[path] = content;
}

std::string Repository::get_file_content(const std::string& commit_hash, const std::string& path) const {
    const Commit* c = get_commit(commit_hash);
    if (!c) return "";
    auto it = c->file_blobs.find(path);
    if (it == c->file_blobs.end()) return "";
    return get_blob(it->second);
}

std::vector<std::string> Repository::list_files() const {
    std::set<std::string> files;
    for (const auto& kv : working_tree_) {
        files.insert(kv.first);
    }
    if (!head_commit_.empty()) {
        const Commit* c = get_commit(head_commit_);
        if (c) {
            for (const auto& kv : c->file_blobs) {
                files.insert(kv.first);
            }
        }
    }
    return std::vector<std::string>(files.begin(), files.end());
}

std::vector<std::string> Repository::list_branches() const {
    std::vector<std::string> list;
    for (const auto& kv : branches_) {
        list.push_back(kv.first);
    }
    return list;
}

const Commit* Repository::get_commit(const std::string& hash) const {
    auto it = commits_.find(hash);
    if (it != commits_.end()) {
        return &(it->second);
    }
    return nullptr;
}

std::string Repository::commit(const std::string& message, const std::string& author) {
    std::map<std::string, std::string> file_blobs;
    if (!head_commit_.empty()) {
        const Commit* prev = get_commit(head_commit_);
        if (prev) {
            file_blobs = prev->file_blobs;
        }
    }

    for (const auto& kv : index_staged_) {
        file_blobs[kv.first] = kv.second;
    }

    std::ostringstream tree_raw;
    for (const auto& kv : file_blobs) {
        tree_raw << kv.first << ":" << kv.second << "\n";
    }
    std::string tree_hash = SHA256::hash(tree_raw.str());

    std::vector<std::string> parents;
    if (!head_commit_.empty()) {
        parents.push_back(head_commit_);
    }

    int64_t ts = current_time_ms();

    std::ostringstream commit_raw;
    commit_raw << "tree " << tree_hash << "\n";
    for (const auto& p : parents) {
        commit_raw << "parent " << p << "\n";
    }
    commit_raw << "author " << author << "\n";
    commit_raw << "timestamp " << ts << "\n";
    commit_raw << "message " << message << "\n";

    std::string commit_hash = SHA256::hash(commit_raw.str());

    Commit c;
    c.hash = commit_hash;
    c.parent_hashes = parents;
    c.tree_hash = tree_hash;
    c.author = author;
    c.timestamp = ts;
    c.message = message;
    c.file_blobs = file_blobs;

    commits_[commit_hash] = c;
    head_commit_ = commit_hash;
    branches_[current_branch_] = commit_hash;
    index_staged_.clear();

    return commit_hash;
}

std::vector<Commit> Repository::get_history(const std::string& start_hash, size_t limit) const {
    std::vector<Commit> history;
    std::string start = start_hash.empty() ? head_commit_ : start_hash;
    if (start.empty()) return history;

    std::queue<std::string> q;
    std::set<std::string> visited;
    q.push(start);
    visited.insert(start);

    while (!q.empty() && history.size() < limit) {
        std::string cur = q.front();
        q.pop();

        const Commit* c = get_commit(cur);
        if (!c) continue;
        history.push_back(*c);

        for (const auto& p : c->parent_hashes) {
            if (visited.find(p) == visited.end()) {
                visited.insert(p);
                q.push(p);
            }
        }
    }
    return history;
}

std::string Repository::find_common_ancestor(const std::string& hash_a, const std::string& hash_b) const {
    if (hash_a.empty() || hash_b.empty()) return "";
    if (hash_a == hash_b) return hash_a;

    std::set<std::string> ancestors_a;
    std::queue<std::string> q_a;
    q_a.push(hash_a);
    ancestors_a.insert(hash_a);

    while (!q_a.empty()) {
        std::string cur = q_a.front();
        q_a.pop();
        const Commit* c = get_commit(cur);
        if (!c) continue;
        for (const auto& p : c->parent_hashes) {
            if (ancestors_a.find(p) == ancestors_a.end()) {
                ancestors_a.insert(p);
                q_a.push(p);
            }
        }
    }

    std::queue<std::string> q_b;
    std::set<std::string> visited_b;
    q_b.push(hash_b);
    visited_b.insert(hash_b);

    while (!q_b.empty()) {
        std::string cur = q_b.front();
        q_b.pop();

        if (ancestors_a.find(cur) != ancestors_a.end()) {
            return cur;
        }

        const Commit* c = get_commit(cur);
        if (!c) continue;
        for (const auto& p : c->parent_hashes) {
            if (visited_b.find(p) == visited_b.end()) {
                visited_b.insert(p);
                q_b.push(p);
            }
        }
    }
    return "";
}

SimulationReport Repository::simulate_merge(const std::string& incoming_ref) const {
    SimulationReport report;
    report.current_ref = current_branch_ + " (" + (head_commit_.empty() ? "empty" : head_commit_.substr(0, 8)) + ")";
    
    std::string inc_hash = incoming_ref;
    auto it_b = branches_.find(incoming_ref);
    if (it_b != branches_.end()) {
        inc_hash = it_b->second;
    }
    report.incoming_ref = incoming_ref + " (" + (inc_hash.empty() ? "empty" : inc_hash.substr(0, 8)) + ")";

    std::string base_hash = find_common_ancestor(head_commit_, inc_hash);
    report.base_ref = base_hash.empty() ? "empty" : base_hash.substr(0, 8);

    report.files_analyzed = 0;
    report.cleanly_merged_files = 0;
    report.conflicting_files = 0;
    report.total_conflicts = 0;
    report.case_distribution["CASE_1"] = 0;
    report.case_distribution["CASE_2"] = 0;
    report.case_distribution["CASE_3"] = 0;
    report.case_distribution["CASE_4"] = 0;
    report.case_distribution["CASE_5"] = 0;
    report.case_distribution["CASE_6"] = 0;

    std::set<std::string> all_files;
    const Commit* c_base = get_commit(base_hash);
    const Commit* c_head = get_commit(head_commit_);
    const Commit* c_inc = get_commit(inc_hash);

    if (c_base) for (const auto& kv : c_base->file_blobs) all_files.insert(kv.first);
    if (c_head) for (const auto& kv : c_head->file_blobs) all_files.insert(kv.first);
    if (c_inc) for (const auto& kv : c_inc->file_blobs) all_files.insert(kv.first);

    for (const auto& path : all_files) {
        std::string base_t = c_base ? get_file_content(base_hash, path) : "";
        std::string head_t = c_head ? get_file_content(head_commit_, path) : "";
        std::string inc_t = c_inc ? get_file_content(inc_hash, path) : "";

        if (head_t == inc_t && head_t == base_t) {
            continue;
        }

        report.files_analyzed++;
        report.changed_files.push_back(path);

        MergeResult res = MergeEngine::merge_text(base_t, head_t, inc_t, path);

        for (const auto& kv : res.case_counts) {
            report.case_distribution[kv.first] += kv.second;
        }

        if (res.has_conflicts) {
            report.conflicting_files++;
            report.total_conflicts += res.conflicts.size();
            for (const auto& diag : res.conflicts) {
                report.all_conflicts.push_back(diag);
            }
        } else {
            report.cleanly_merged_files++;
        }
    }

    return report;
}

MergeResult Repository::merge(
    const std::string& incoming_ref,
    const std::map<std::string, std::map<std::string, std::pair<ResolutionAction, std::string>>>& file_resolutions
) {
    std::string inc_hash = incoming_ref;
    auto it_b = branches_.find(incoming_ref);
    if (it_b != branches_.end()) {
        inc_hash = it_b->second;
    }

    std::string base_hash = find_common_ancestor(head_commit_, inc_hash);
    const Commit* c_base = get_commit(base_hash);
    const Commit* c_head = get_commit(head_commit_);
    const Commit* c_inc = get_commit(inc_hash);

    std::set<std::string> all_files;
    if (c_base) for (const auto& kv : c_base->file_blobs) all_files.insert(kv.first);
    if (c_head) for (const auto& kv : c_head->file_blobs) all_files.insert(kv.first);
    if (c_inc) for (const auto& kv : c_inc->file_blobs) all_files.insert(kv.first);

    MergeResult combined_result;
    combined_result.has_conflicts = false;
    std::map<std::string, std::string> resolved_file_contents;

    for (const auto& path : all_files) {
        std::string base_t = c_base ? get_file_content(base_hash, path) : "";
        std::string head_t = c_head ? get_file_content(head_commit_, path) : "";
        std::string inc_t = c_inc ? get_file_content(inc_hash, path) : "";

        MergeResult file_res = MergeEngine::merge_text(base_t, head_t, inc_t, path);

        for (const auto& kv : file_res.case_counts) {
            combined_result.case_counts[kv.first] += kv.second;
        }

        auto it_f = file_resolutions.find(path);
        std::string final_content;
        if (file_res.has_conflicts) {
            if (it_f != file_resolutions.end()) {
                final_content = MergeEngine::apply_resolution(file_res, it_f->second);
            } else {
                combined_result.has_conflicts = true;
                for (const auto& d : file_res.conflicts) {
                    combined_result.conflicts.push_back(d);
                }
                final_content = file_res.merged_text;
            }
        } else {
            final_content = file_res.merged_text;
        }

        resolved_file_contents[path] = final_content;
    }

    if (!combined_result.has_conflicts) {
        // Stage files and create 2-parent merge commit
        for (const auto& kv : resolved_file_contents) {
            stage_file(kv.first, kv.second);
        }

        std::map<std::string, std::string> file_blobs;
        if (c_head) file_blobs = c_head->file_blobs;
        for (const auto& kv : index_staged_) {
            file_blobs[kv.first] = kv.second;
        }

        std::ostringstream tree_raw;
        for (const auto& kv : file_blobs) {
            tree_raw << kv.first << ":" << kv.second << "\n";
        }
        std::string tree_hash = SHA256::hash(tree_raw.str());

        std::vector<std::string> parents;
        if (!head_commit_.empty()) parents.push_back(head_commit_);
        if (!inc_hash.empty()) parents.push_back(inc_hash);

        int64_t ts = current_time_ms();
        std::string msg = "Merge branch '" + incoming_ref + "' into " + current_branch_;

        std::ostringstream commit_raw;
        commit_raw << "tree " << tree_hash << "\n";
        for (const auto& p : parents) commit_raw << "parent " << p << "\n";
        commit_raw << "author merge-optimizer\n";
        commit_raw << "timestamp " << ts << "\n";
        commit_raw << "message " << msg << "\n";

        std::string commit_hash = SHA256::hash(commit_raw.str());

        Commit c;
        c.hash = commit_hash;
        c.parent_hashes = parents;
        c.tree_hash = tree_hash;
        c.author = "merge-optimizer";
        c.timestamp = ts;
        c.message = msg;
        c.file_blobs = file_blobs;

        commits_[commit_hash] = c;
        head_commit_ = commit_hash;
        branches_[current_branch_] = commit_hash;
        index_staged_.clear();
    }

    return combined_result;
}

MergeResult Repository::cherry_pick(
    const std::string& commit_hash,
    const std::map<std::string, std::map<std::string, std::pair<ResolutionAction, std::string>>>& file_resolutions
) {
    const Commit* target_commit = get_commit(commit_hash);
    if (!target_commit) {
        MergeResult r;
        r.has_conflicts = true;
        return r;
    }

    std::string base_hash = target_commit->parent_hashes.empty() ? "" : target_commit->parent_hashes[0];
    const Commit* c_base = get_commit(base_hash);
    const Commit* c_head = get_commit(head_commit_);

    std::set<std::string> files_to_merge;
    for (const auto& kv : target_commit->file_blobs) files_to_merge.insert(kv.first);
    if (c_base) for (const auto& kv : c_base->file_blobs) files_to_merge.insert(kv.first);

    MergeResult combined_result;
    combined_result.has_conflicts = false;
    std::map<std::string, std::string> resolved_file_contents;

    for (const auto& path : files_to_merge) {
        std::string base_t = c_base ? get_file_content(base_hash, path) : "";
        std::string head_t = c_head ? get_file_content(head_commit_, path) : "";
        std::string inc_t = get_file_content(commit_hash, path);

        MergeResult file_res = MergeEngine::merge_text(base_t, head_t, inc_t, path);

        for (const auto& kv : file_res.case_counts) {
            combined_result.case_counts[kv.first] += kv.second;
        }

        auto it_f = file_resolutions.find(path);
        std::string final_content;
        if (file_res.has_conflicts) {
            if (it_f != file_resolutions.end()) {
                final_content = MergeEngine::apply_resolution(file_res, it_f->second);
            } else {
                combined_result.has_conflicts = true;
                for (const auto& d : file_res.conflicts) {
                    combined_result.conflicts.push_back(d);
                }
                final_content = file_res.merged_text;
            }
        } else {
            final_content = file_res.merged_text;
        }

        resolved_file_contents[path] = final_content;
    }

    if (!combined_result.has_conflicts) {
        for (const auto& kv : resolved_file_contents) {
            stage_file(kv.first, kv.second);
        }
        std::string msg = "Cherry-pick: " + target_commit->message + " (" + commit_hash.substr(0, 8) + ")";
        commit(msg, "cherry-pick-engine");
    }

    return combined_result;
}

std::vector<GraphNode> Repository::build_commit_graph() const {
    std::vector<GraphNode> nodes;
    auto history = get_history("", 100);

    // Map commits to active branch pointers
    std::map<std::string, std::vector<std::string>> branch_map;
    for (const auto& b : branches_) {
        branch_map[b.second].push_back(b.first);
    }

    // Allocate lanes for DAG visualizer
    std::map<std::string, size_t> lane_assignments;
    size_t next_lane = 0;

    for (const auto& c : history) {
        GraphNode gn;
        gn.hash = c.hash;
        gn.short_hash = c.hash.substr(0, 7);
        gn.parents = c.parent_hashes;
        gn.author = c.author;
        gn.timestamp = c.timestamp;
        gn.message = c.message;
        gn.is_head = (c.hash == head_commit_);

        auto it_b = branch_map.find(c.hash);
        if (it_b != branch_map.end()) {
            gn.branches = it_b->second;
        }

        if (lane_assignments.find(c.hash) == lane_assignments.end()) {
            lane_assignments[c.hash] = next_lane++;
        }
        gn.lane = lane_assignments[c.hash];

        for (size_t p = 0; p < c.parent_hashes.size(); ++p) {
            const std::string& parent = c.parent_hashes[p];
            if (lane_assignments.find(parent) == lane_assignments.end()) {
                lane_assignments[parent] = (p == 0) ? gn.lane : next_lane++;
            }
        }

        nodes.push_back(gn);
    }

    return nodes;
}

RepoStatus Repository::status() const {
    RepoStatus s;
    s.current_branch = current_branch_;
    s.head_hash = head_commit_;
    s.has_active_conflicts = false;

    const Commit* c = get_commit(head_commit_);
    std::map<std::string, std::string> head_files;
    if (c) {
        for (const auto& kv : c->file_blobs) {
            head_files[kv.first] = get_blob(kv.second);
        }
    }

    for (const auto& kv : index_staged_) {
        s.staged_files.push_back(kv.first);
    }

    for (const auto& kv : working_tree_) {
        if (head_files.find(kv.first) == head_files.end() && index_staged_.find(kv.first) == index_staged_.end()) {
            s.untracked_files.push_back(kv.first);
        } else {
            auto it_h = head_files.find(kv.first);
            if (it_h != head_files.end() && it_h->second != kv.second) {
                s.modified_files.push_back(kv.first);
            }
        }
    }

    return s;
}

std::string Repository::to_json() const {
    std::ostringstream ss;
    ss << "{\n";
    ss << "  \"current_branch\": \"" << escape_json(current_branch_) << "\",\n";
    ss << "  \"head_commit\": \"" << escape_json(head_commit_) << "\",\n";

    ss << "  \"branches\": {";
    bool first = true;
    for (const auto& b : branches_) {
        if (!first) ss << ", ";
        first = false;
        ss << "\"" << escape_json(b.first) << "\": \"" << escape_json(b.second) << "\"";
    }
    ss << "},\n";

    ss << "  \"commits\": [\n";
    first = true;
    for (const auto& kv : commits_) {
        if (!first) ss << ",\n";
        first = false;
        const auto& c = kv.second;
        ss << "    {\n";
        ss << "      \"hash\": \"" << escape_json(c.hash) << "\",\n";
        ss << "      \"tree_hash\": \"" << escape_json(c.tree_hash) << "\",\n";
        ss << "      \"author\": \"" << escape_json(c.author) << "\",\n";
        ss << "      \"timestamp\": " << c.timestamp << ",\n";
        ss << "      \"message\": \"" << escape_json(c.message) << "\",\n";
        ss << "      \"parents\": [";
        for (size_t p = 0; p < c.parent_hashes.size(); ++p) {
            if (p > 0) ss << ", ";
            ss << "\"" << escape_json(c.parent_hashes[p]) << "\"";
        }
        ss << "],\n";
        ss << "      \"files\": {";
        bool f_first = true;
        for (const auto& f : c.file_blobs) {
            if (!f_first) ss << ", ";
            f_first = false;
            ss << "\"" << escape_json(f.first) << "\": \"" << escape_json(f.second) << "\"";
        }
        ss << "}\n";
        ss << "    }";
    }
    ss << "\n  ],\n";

    ss << "  \"blobs\": {";
    first = true;
    for (const auto& b : blobs_) {
        if (!first) ss << ", ";
        first = false;
        ss << "\"" << escape_json(b.first) << "\": \"" << escape_json(b.second) << "\"";
    }
    ss << "}\n";
    ss << "}\n";
    return ss.str();
}

bool Repository::from_json(const std::string& json_str) {
    // Basic state reset
    init("main");
    return !json_str.empty();
}

}
