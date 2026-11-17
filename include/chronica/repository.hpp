#ifndef CHRONICA_REPOSITORY_HPP
#define CHRONICA_REPOSITORY_HPP

#include "chronica/merge_engine.hpp"
#include <string>
#include <vector>
#include <map>
#include <set>
#include <memory>

namespace chronica {

struct Commit {
    std::string hash;
    std::vector<std::string> parent_hashes;
    std::string tree_hash;
    std::string author;
    int64_t timestamp;
    std::string message;
    std::map<std::string, std::string> file_blobs;
};

struct RepoStatus {
    std::string current_branch;
    std::string head_hash;
    std::vector<std::string> staged_files;
    std::vector<std::string> modified_files;
    std::vector<std::string> untracked_files;
    bool has_active_conflicts;
    std::vector<std::string> conflicting_files;
};

struct GraphNode {
    std::string hash;
    std::string short_hash;
    std::vector<std::string> parents;
    std::string author;
    int64_t timestamp;
    std::string message;
    std::vector<std::string> branches;
    bool is_head;
    size_t lane;
};

class Repository {
public:
    Repository();

    bool init(const std::string& default_branch = "main");
    bool create_branch(const std::string& branch_name);
    bool checkout(const std::string& branch_or_commit);
    bool stage_file(const std::string& path, const std::string& content);
    bool unstage_file(const std::string& path);
    
    std::string commit(const std::string& message, const std::string& author = "systems-engineer");
    
    std::string get_file_content(const std::string& commit_hash, const std::string& path) const;
    std::string get_working_file(const std::string& path) const;
    void set_working_file(const std::string& path, const std::string& content);

    std::vector<std::string> list_files() const;
    std::vector<std::string> list_branches() const;
    std::string current_branch() const { return current_branch_; }
    std::string head_commit() const { return head_commit_; }

    const Commit* get_commit(const std::string& hash) const;
    std::vector<Commit> get_history(const std::string& start_hash = "", size_t limit = 50) const;
    std::vector<GraphNode> build_commit_graph() const;

    std::string find_common_ancestor(const std::string& hash_a, const std::string& hash_b) const;

    SimulationReport simulate_merge(const std::string& incoming_ref) const;
    
    MergeResult merge(
        const std::string& incoming_ref,
        const std::map<std::string, std::map<std::string, std::pair<ResolutionAction, std::string>>>& file_resolutions = {}
    );

    MergeResult cherry_pick(
        const std::string& commit_hash,
        const std::map<std::string, std::map<std::string, std::pair<ResolutionAction, std::string>>>& file_resolutions = {}
    );

    RepoStatus status() const;

    std::string to_json() const;
    bool from_json(const std::string& json_str);

private:
    std::string store_blob(const std::string& content);
    std::string get_blob(const std::string& blob_hash) const;

    std::string current_branch_;
    std::string head_commit_;
    std::map<std::string, std::string> branches_;
    std::map<std::string, Commit> commits_;
    std::map<std::string, std::string> blobs_;
    std::map<std::string, std::string> index_staged_;
    std::map<std::string, std::string> working_tree_;
};

}

#endif
