#ifndef CHRONICA_SHA256_HPP
#define CHRONICA_SHA256_HPP

#include <string>
#include <vector>
#include <cstdint>

namespace chronica {

class SHA256 {
public:
    static std::string hash(const std::string& input);
    static std::string hash_bytes(const uint8_t* data, size_t length);
};

}

#endif
