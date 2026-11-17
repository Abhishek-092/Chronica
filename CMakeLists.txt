cmake_minimum_required(VERSION 3.16)
project(Chronica VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Include directories
include_directories(include)

# Sources
set(CHRONICA_CORE_SOURCES
    src/sha256.cpp
    src/lcs.cpp
    src/merge_engine.cpp
    src/repository.cpp
)

# Core Library
add_library(chronica_core STATIC ${CHRONICA_CORE_SOURCES})

# CLI Executable
add_executable(chronica src/main.cpp)
target_link_libraries(chronica PRIVATE chronica_core)

# Enable testing
enable_testing()
add_test(NAME EngineVerification COMMAND chronica test)
