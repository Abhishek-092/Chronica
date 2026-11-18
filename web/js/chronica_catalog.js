// Chronica Repository Catalog & Multi-Commit Cherry-Pick Extension

class ChronicaCatalog {
    static getRepositoryList() {
        return [
            {
                id: 'repo-case-1-identical',
                name: 'case-1-identical-regions',
                title: 'Case 1: Identical Regions',
                desc: 'Unchanged sections between branches retain base version content without conflict.',
                caseType: 'Case 1',
                badgeClass: 'badge-gray',
                defaultBranch: 'main',
                targetBranch: 'feature/baseline-sync'
            },
            {
                id: 'repo-case-2-single-branch',
                name: 'case-2-single-branch-mod',
                title: 'Case 2: Single Branch Modification',
                desc: 'Only one branch modifies the region; changes are automatically accepted.',
                caseType: 'Case 2',
                badgeClass: 'badge-green',
                defaultBranch: 'main',
                targetBranch: 'feature/endpoint-update'
            },
            {
                id: 'repo-case-3-independent',
                name: 'case-3-independent-regions',
                title: 'Case 3: Independent Non-Overlapping',
                desc: 'Modifications at distinct, non-overlapping line ranges are cleanly combined.',
                caseType: 'Case 3',
                badgeClass: 'badge-green',
                defaultBranch: 'main',
                targetBranch: 'feature/metrics-collector'
            },
            {
                id: 'repo-case-4-identical-mods',
                name: 'case-4-identical-modifications',
                title: 'Case 4: Identical Modifications',
                desc: 'Both branches make the identical modification; accepted once without conflict.',
                caseType: 'Case 4',
                badgeClass: 'badge-blue',
                defaultBranch: 'main',
                targetBranch: 'patch/timeout-sync'
            },
            {
                id: 'repo-case-5-overlapping',
                name: 'case-5-overlapping-differing',
                title: 'Case 5: Overlapping Differing Content',
                desc: 'Both branches modify the same line range with differing values; flagged for manual resolution.',
                caseType: 'Case 5',
                badgeClass: 'badge-amber',
                defaultBranch: 'release/v2-prod',
                targetBranch: 'feature/auth-refresh'
            },
            {
                id: 'repo-case-6-delete-modify',
                name: 'case-6-delete-vs-modify',
                title: 'Case 6: Delete vs Modify Collision',
                desc: 'One branch deletes a code block while the other branch modifies it.',
                caseType: 'Case 6',
                badgeClass: 'badge-red',
                defaultBranch: 'refactor/prune-pricing',
                targetBranch: 'feature/dynamic-tax'
            },
            {
                id: 'repo-case-7-full-system',
                name: 'case-7-multi-file-system',
                title: 'Case 7: Multi-File System Benchmark',
                desc: 'Complex multi-file repository combining independent changes, identical mods, and conflicts.',
                caseType: 'Case 7',
                badgeClass: 'badge-purple',
                defaultBranch: 'main',
                targetBranch: 'feature/cluster-scaling'
            },
            {
                id: 'repo-cherry-pick-workbench',
                name: 'cherry-pick-workbench',
                title: 'Dedicated Cherry-Pick Workbench',
                desc: 'Multi-commit history featuring individual and range cherry-picking across release and dev branches.',
                caseType: 'Cherry-Pick',
                badgeClass: 'badge-blue',
                defaultBranch: 'release/v1.0',
                targetBranch: 'development'
            }
        ];
    }

    static loadRepository(repoId, r) {
        if (repoId === 'repo-case-1-identical') {
            r.init('main');
            r.stageFile('config/app.conf',
                'server_port = 8080\n' +
                'max_connections = 1000\n' +
                'keep_alive_timeout = 60\n'
            );
            r.commit('Initial server configuration');
            r.createBranch('feature/baseline-sync');
            r.checkout('main');
            return;
        }

        if (repoId === 'repo-case-2-single-branch') {
            r.init('main');
            r.stageFile('src/network.cpp',
                'void initialize_network() {\n' +
                '    bind_socket(8080);\n' +
                '    start_listener();\n' +
                '}\n'
            );
            r.commit('Baseline network setup');
            r.createBranch('feature/endpoint-update');
            r.checkout('feature/endpoint-update');
            r.stageFile('src/network.cpp',
                'void initialize_network() {\n' +
                '    bind_socket(8080);\n' +
                '    configure_tls_v13();\n' +
                '    start_listener();\n' +
                '}\n'
            );
            r.commit('Add TLS 1.3 configuration to network setup');
            r.checkout('main');
            return;
        }

        if (repoId === 'repo-case-3-independent') {
            r.init('main');
            r.stageFile('pipeline/data_processor.cpp',
                '// Header Section\n' +
                'void setup_ingestion() {\n' +
                '    allocate_ring_buffer();\n' +
                '}\n' +
                '\n' +
                '// Core Transformation\n' +
                'void transform_records() {\n' +
                '    parse_json_payload();\n' +
                '}\n' +
                '\n' +
                '// Cleanup Section\n' +
                'void teardown_pipeline() {\n' +
                '    release_buffers();\n' +
                '}\n'
            );
            r.commit('Base data processing pipeline');

            r.createBranch('feature/metrics-collector');
            r.checkout('feature/metrics-collector');
            r.stageFile('pipeline/data_processor.cpp',
                '// Header Section\n' +
                'void setup_ingestion() {\n' +
                '    allocate_ring_buffer();\n' +
                '    register_metric_gauges();\n' +
                '}\n' +
                '\n' +
                '// Core Transformation\n' +
                'void transform_records() {\n' +
                '    parse_json_payload();\n' +
                '}\n' +
                '\n' +
                '// Cleanup Section\n' +
                'void teardown_pipeline() {\n' +
                '    release_buffers();\n' +
                '}\n'
            );
            r.commit('Register metric gauges in header section');

            r.checkout('main');
            r.stageFile('pipeline/data_processor.cpp',
                '// Header Section\n' +
                'void setup_ingestion() {\n' +
                '    allocate_ring_buffer();\n' +
                '}\n' +
                '\n' +
                '// Core Transformation\n' +
                'void transform_records() {\n' +
                '    parse_json_payload();\n' +
                '}\n' +
                '\n' +
                '// Cleanup Section\n' +
                'void teardown_pipeline() {\n' +
                '    flush_pending_packets();\n' +
                '    release_buffers();\n' +
                '}\n'
            );
            r.commit('Add flush packets in cleanup section');
            return;
        }

        if (repoId === 'repo-case-4-identical-mods') {
            r.init('main');
            r.stageFile('config/database.json',
                '{\n' +
                '  "connection_timeout": 30,\n' +
                '  "pool_size": 10\n' +
                '}\n'
            );
            r.commit('Base database configuration');

            r.createBranch('patch/timeout-sync');
            r.checkout('patch/timeout-sync');
            r.stageFile('config/database.json',
                '{\n' +
                '  "connection_timeout": 60,\n' +
                '  "pool_size": 10\n' +
                '}\n'
            );
            r.commit('Update timeout to 60s');

            r.checkout('main');
            r.stageFile('config/database.json',
                '{\n' +
                '  "connection_timeout": 60,\n' +
                '  "pool_size": 10\n' +
                '}\n'
            );
            r.commit('Synchronize timeout to 60s');
            return;
        }

        if (repoId === 'repo-case-5-overlapping') {
            r.init('main');
            r.stageFile('src/config.cpp',
                '// System Configuration Header\n' +
                'int timeout = 30;\n' +
                'int max_retries = 3;\n' +
                'bool debug_mode = false;\n' +
                'std::string host = "127.0.0.1";\n'
            );
            r.commit('Initial configuration');

            r.createBranch('feature/auth-refresh');
            r.checkout('feature/auth-refresh');
            r.stageFile('src/config.cpp',
                '// System Configuration Header\n' +
                'int timeout = 60;\n' +
                'int max_retries = 5;\n' +
                'bool debug_mode = true;\n' +
                'std::string host = "127.0.0.1";\n'
            );
            r.commit('Update timeout to 60 and enable debug mode');

            r.checkout('main');
            r.createBranch('release/v2-prod');
            r.checkout('release/v2-prod');
            r.stageFile('src/config.cpp',
                '// System Configuration Header\n' +
                'int timeout = 120;\n' +
                'int max_retries = 5;\n' +
                'bool debug_mode = false;\n' +
                'std::string host = "0.0.0.0";\n'
            );
            r.commit('Production cluster timeout 120 and 0.0.0.0 bind');
            return;
        }

        if (repoId === 'repo-case-6-delete-modify') {
            r.init('main');
            r.stageFile('services/pricing.cpp',
                '#include "pricing.hpp"\n' +
                '\n' +
                'double calculate_standard_price(double base_rate) {\n' +
                '    double tax = base_rate * 0.15;\n' +
                '    return base_rate + tax;\n' +
                '}\n' +
                '\n' +
                'double calculate_discount(double rate, double disc) {\n' +
                '    return rate * (1.0 - disc);\n' +
                '}\n'
            );
            r.commit('Baseline pricing calculator');

            r.createBranch('refactor/prune-pricing');
            r.checkout('refactor/prune-pricing');
            r.stageFile('services/pricing.cpp',
                '#include "pricing.hpp"\n' +
                '\n' +
                'double calculate_discount(double rate, double disc) {\n' +
                '    return rate * (1.0 - disc);\n' +
                '}\n'
            );
            r.commit('Remove legacy calculate_standard_price');

            r.checkout('main');
            r.createBranch('feature/dynamic-tax');
            r.checkout('feature/dynamic-tax');
            r.stageFile('services/pricing.cpp',
                '#include "pricing.hpp"\n' +
                '\n' +
                'double calculate_standard_price(double base_rate) {\n' +
                '    double local_tax = query_jurisdiction_tax();\n' +
                '    return base_rate * (1.0 + local_tax);\n' +
                '}\n' +
                '\n' +
                'double calculate_discount(double rate, double disc) {\n' +
                '    return rate * (1.0 - disc);\n' +
                '}\n'
            );
            r.commit('Update standard price with dynamic tax lookup');
            r.checkout('refactor/prune-pricing');
            return;
        }

        if (repoId === 'repo-case-7-full-system') {
            r.init('main');
            r.stageFile('include/server.hpp',
                '#pragma once\n' +
                '#include <string>\n' +
                'struct ServerConfig {\n' +
                '    int port = 8080;\n' +
                '    int workers = 4;\n' +
                '};\n'
            );
            r.stageFile('src/auth.cpp',
                'bool verify_token(const std::string& token) {\n' +
                '    return !token.empty();\n' +
                '}\n'
            );
            r.commit('Base multi-service framework');

            r.createBranch('feature/cluster-scaling');
            r.checkout('feature/cluster-scaling');
            r.stageFile('include/server.hpp',
                '#pragma once\n' +
                '#include <string>\n' +
                'struct ServerConfig {\n' +
                '    int port = 9000;\n' +
                '    int workers = 16;\n' +
                '};\n'
            );
            r.stageFile('src/auth.cpp',
                'bool verify_token(const std::string& token) {\n' +
                '    if (token.empty()) return false;\n' +
                '    return check_jwt_signature(token);\n' +
                '}\n'
            );
            r.commit('Scale worker pool to 16 and add JWT check');

            r.checkout('main');
            r.stageFile('include/server.hpp',
                '#pragma once\n' +
                '#include <string>\n' +
                'struct ServerConfig {\n' +
                '    int port = 8080;\n' +
                '    int workers = 8;\n' +
                '};\n'
            );
            r.commit('Increase workers to 8 on main');
            return;
        }

        // repo-cherry-pick-workbench
        r.init('main');
        r.stageFile('core/engine.cpp',
            '// Core Engine Baseline\n' +
            'void run_engine() {\n' +
            '    init_subsystems();\n' +
            '}\n'
        );
        r.stageFile('core/security.cpp',
            '// Security Protocol\n' +
            'bool authenticate(const char* key) {\n' +
            '    return key != nullptr;\n' +
            '}\n'
        );
        r.commit('Initial core engine and security baseline');

        r.createBranch('release/v1.0');
        r.checkout('release/v1.0');

        r.createBranch('development');
        r.checkout('development');

        // Series of discrete feature and fix commits on development
        r.stageFile('utils/formatter.cpp',
            '// String Formatting Utility\n' +
            'std::string format_hex(uint64_t val) {\n' +
            '    char buf[32];\n' +
            '    snprintf(buf, sizeof(buf), "0x%llx", val);\n' +
            '    return std::string(buf);\n' +
            '}\n'
        );
        r.commit('Commit-A: Add hex formatting utility helper');

        r.stageFile('core/engine.cpp',
            '// Core Engine Baseline\n' +
            'void run_engine() {\n' +
            '    init_subsystems();\n' +
            '    prevent_buffer_leak();\n' +
            '}\n'
        );
        r.commit('Commit-B: Critical bugfix - prevent buffer pool memory leak');

        r.stageFile('core/security.cpp',
            '// Security Protocol\n' +
            'bool authenticate(const char* key) {\n' +
            '    if (!key) return false;\n' +
            '    return constant_time_compare(key, master_key);\n' +
            '}\n'
        );
        r.commit('Commit-C: Security patch - constant time authentication check');

        r.stageFile('core/json_fast.cpp',
            '// Experimental JSON parser\n' +
            'bool parse_fast_json(const char* json_str) {\n' +
            '    return simd_validate_utf8(json_str);\n' +
            '}\n'
        );
        r.commit('Commit-D: Experimental SIMD JSON parser');

        r.stageFile('core/engine.cpp',
            '// Core Engine Baseline\n' +
            'void run_engine() {\n' +
            '    init_subsystems();\n' +
            '    prevent_buffer_leak();\n' +
            '    register_thread_telemetry();\n' +
            '}\n'
        );
        r.commit('Commit-E: Add telemetry probes to worker threads');

        r.checkout('release/v1.0');
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ChronicaCatalog };
}

