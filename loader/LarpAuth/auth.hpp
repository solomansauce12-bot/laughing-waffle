#pragma once

/*
 * LarpAuth C++ SDK  —  x64
 * Uses WinHTTP (built-in Windows, no external libs required)
 * Compatible with the LarpAuth dashboard at https://solomansauce12-bot.github.io/laughing-waffle/
 */

#define WIN32_LEAN_AND_MEAN
#include <Windows.h>
#include <winhttp.h>
#include <string>
#include <vector>
#include <sstream>
#include <chrono>
#include <thread>
#include <functional>
#include <filesystem>
#include <fstream>
#include <iostream>

#pragma comment(lib, "winhttp.lib")

namespace LarpAuth
{
    /* ─── simple JSON value reader (no external dep) ─── */
    inline std::string json_get(const std::string& body, const std::string& key)
    {
        std::string search = "\"" + key + "\"";
        size_t pos = body.find(search);
        if (pos == std::string::npos) return "";
        pos = body.find(':', pos);
        if (pos == std::string::npos) return "";
        pos++;
        while (pos < body.size() && (body[pos] == ' ' || body[pos] == '\t')) pos++;

        if (pos >= body.size()) return "";

        if (body[pos] == '"')
        {
            pos++;
            std::string val;
            while (pos < body.size() && body[pos] != '"')
            {
                if (body[pos] == '\\') { pos++; }
                val += body[pos++];
            }
            return val;
        }
        else
        {
            size_t end = body.find_first_of(",}\n", pos);
            if (end == std::string::npos) end = body.size();
            std::string val = body.substr(pos, end - pos);
            while (!val.empty() && (val.back() == ' ' || val.back() == '\t')) val.pop_back();
            return val;
        }
    }

    /* ─── WinHTTP POST helper ─── */
    inline std::string http_post(const std::wstring& host, const std::wstring& path, const std::string& body)
    {
        std::string result;

        HINTERNET hSession = WinHttpOpen(
            L"LarpAuth/1.0",
            WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,
            WINHTTP_NO_PROXY_NAME,
            WINHTTP_NO_PROXY_BYPASS, 0);
        if (!hSession) return result;

        HINTERNET hConnect = WinHttpConnect(hSession, host.c_str(), INTERNET_DEFAULT_HTTPS_PORT, 0);
        if (!hConnect) { WinHttpCloseHandle(hSession); return result; }

        HINTERNET hRequest = WinHttpOpenRequest(
            hConnect, L"POST", path.c_str(),
            NULL, WINHTTP_NO_REFERER,
            WINHTTP_DEFAULT_ACCEPT_TYPES,
            WINHTTP_FLAG_SECURE);
        if (!hRequest) { WinHttpCloseHandle(hConnect); WinHttpCloseHandle(hSession); return result; }

        std::wstring headers = L"Content-Type: application/json\r\n";
        BOOL sent = WinHttpSendRequest(
            hRequest,
            headers.c_str(), (DWORD)headers.size(),
            (LPVOID)body.c_str(), (DWORD)body.size(),
            (DWORD)body.size(), 0);

        if (sent && WinHttpReceiveResponse(hRequest, NULL))
        {
            DWORD dwSize = 0;
            do {
                DWORD dwDownloaded = 0;
                WinHttpQueryDataAvailable(hRequest, &dwSize);
                if (dwSize == 0) break;
                std::vector<char> buf(dwSize + 1, 0);
                WinHttpReadData(hRequest, buf.data(), dwSize, &dwDownloaded);
                result.append(buf.data(), dwDownloaded);
            } while (dwSize > 0);
        }

        WinHttpCloseHandle(hRequest);
        WinHttpCloseHandle(hConnect);
        WinHttpCloseHandle(hSession);
        return result;
    }

    /* ─── Lockout state ─── */
    struct lockout_state
    {
        int fails = 0;
        std::chrono::steady_clock::time_point locked_until{};
    };

    inline bool lockout_active(const lockout_state& s)
    {
        return std::chrono::steady_clock::now() < s.locked_until;
    }

    inline int lockout_remaining_ms(const lockout_state& s)
    {
        if (!lockout_active(s)) return 0;
        return (int)std::chrono::duration_cast<std::chrono::milliseconds>(
            s.locked_until - std::chrono::steady_clock::now()).count();
    }

    inline void record_login_fail(lockout_state& s, int max_attempts = 3, int lock_seconds = 30)
    {
        if (lockout_active(s)) return;
        if (++s.fails >= max_attempts)
        {
            s.fails = 0;
            s.locked_until = std::chrono::steady_clock::now() + std::chrono::seconds(lock_seconds);
        }
    }

    inline void reset_lockout(lockout_state& s) { s.fails = 0; s.locked_until = {}; }

    /* ─── Saved credentials helpers ─── */
    static constexpr const char* kSavePath = "larpauth_save.dat";

    inline std::string read_saved(const std::string& key)
    {
        if (!std::filesystem::exists(kSavePath)) return "";
        std::ifstream f(kSavePath);
        std::string line;
        while (std::getline(f, line))
        {
            size_t eq = line.find('=');
            if (eq != std::string::npos && line.substr(0, eq) == key)
                return line.substr(eq + 1);
        }
        return "";
    }

    inline void write_saved(const std::string& key, const std::string& val)
    {
        // read all existing
        std::vector<std::string> lines;
        if (std::filesystem::exists(kSavePath))
        {
            std::ifstream f(kSavePath);
            std::string line;
            while (std::getline(f, line))
            {
                size_t eq = line.find('=');
                if (eq != std::string::npos && line.substr(0, eq) == key) continue;
                lines.push_back(line);
            }
        }
        lines.push_back(key + "=" + val);
        std::ofstream f(kSavePath, std::ios::trunc);
        for (auto& l : lines) f << l << "\n";
    }

    inline void clear_saved() { std::remove(kSavePath); }

    /* ─── Main API class ─── */
    class api
    {
    public:
        /* Fill these in from the Applications page in your LarpAuth dashboard */
        std::string name;
        std::string ownerid;
        std::string secret;
        std::string version;

        struct userdata_t
        {
            std::string username;
            std::string ip;
            std::string hwid;
            std::string createdate;
            std::string lastlogin;
            std::string subscription;
            std::string expiry;
        } user_data;

        struct response_t
        {
            bool   success = false;
            std::string message;
        } response;

        api(std::string name, std::string ownerid, std::string secret, std::string version)
            : name(std::move(name)), ownerid(std::move(ownerid)),
              secret(std::move(secret)), version(std::move(version)) {}

        /* ── Initialize: verify app exists and is active ── */
        void init()
        {
            std::string body =
                "{\"type\":\"init\","
                "\"name\":\"" + name + "\","
                "\"ownerid\":\"" + ownerid + "\","
                "\"secret\":\"" + secret + "\","
                "\"version\":\"" + version + "\"}";

            auto resp = request(body);
            response.success = (json_get(resp, "success") == "true");
            response.message = json_get(resp, "message");
        }

        /* ── License-key only login ── */
        void license(const std::string& key)
        {
            std::string hwid = get_hwid();
            std::string body =
                "{\"type\":\"license\","
                "\"key\":\"" + key + "\","
                "\"hwid\":\"" + hwid + "\","
                "\"name\":\"" + name + "\","
                "\"ownerid\":\"" + ownerid + "\","
                "\"secret\":\"" + secret + "\"}";

            auto resp = request(body);
            response.success = (json_get(resp, "success") == "true");
            response.message = json_get(resp, "message");
            if (response.success) fill_user(resp, "", hwid);
        }

        /* ── Username + password login ── */
        void login(const std::string& username, const std::string& password)
        {
            std::string hwid = get_hwid();
            std::string body =
                "{\"type\":\"login\","
                "\"username\":\"" + username + "\","
                "\"password\":\"" + password + "\","
                "\"hwid\":\"" + hwid + "\","
                "\"name\":\"" + name + "\","
                "\"ownerid\":\"" + ownerid + "\","
                "\"secret\":\"" + secret + "\"}";

            auto resp = request(body);
            response.success = (json_get(resp, "success") == "true");
            response.message = json_get(resp, "message");
            if (response.success) fill_user(resp, username, hwid);
        }

        /* ── Register with username, password, license key ── */
        void regstr(const std::string& username, const std::string& password, const std::string& key)
        {
            std::string hwid = get_hwid();
            std::string body =
                "{\"type\":\"register\","
                "\"username\":\"" + username + "\","
                "\"password\":\"" + password + "\","
                "\"key\":\"" + key + "\","
                "\"hwid\":\"" + hwid + "\","
                "\"name\":\"" + name + "\","
                "\"ownerid\":\"" + ownerid + "\","
                "\"secret\":\"" + secret + "\"}";

            auto resp = request(body);
            response.success = (json_get(resp, "success") == "true");
            response.message = json_get(resp, "message");
            if (response.success) fill_user(resp, username, hwid);
        }

        /* ── Get current hardware ID ── */
        static std::string get_hwid()
        {
            char buf[256]{};
            DWORD sz = sizeof(buf);
            GetComputerNameA(buf, &sz);
            // combine with volume serial for a more unique ID
            DWORD serial = 0;
            GetVolumeInformationA("C:\\", NULL, 0, &serial, NULL, NULL, NULL, 0);
            return std::string(buf) + "_" + std::to_string(serial);
        }

    private:
        /* POST to LarpAuth API endpoint — replace with your real backend URL */
        std::string request(const std::string& body)
        {
            // Replace with your actual API host and path if you host a backend.
            // For the static GitHub Pages demo, responses are simulated locally.
            return simulate_response(body);
        }

        /* ── Local simulation (since the dashboard is static HTML/localStorage) ──
         * In a real deployment replace request() to hit a live backend.
         * This lets you build and test the loader against the dashboard logic.     */
        std::string simulate_response(const std::string& body)
        {
            std::string type = json_get(body, "type");

            if (type == "init")
                return R"({"success":true,"message":"Application initialized successfully."})";

            if (type == "license" || type == "login" || type == "register")
                return
                    R"({"success":true,"message":"Authenticated.","username":"user","ip":"127.0.0.1",)"
                    R"("createdate":"1700000000","lastlogin":"1700000000","subscription":"default","expiry":"9999999999"})";

            return R"({"success":false,"message":"Unknown request type."})";
        }

        void fill_user(const std::string& resp, const std::string& username, const std::string& hwid)
        {
            user_data.username     = username.empty() ? json_get(resp, "username") : username;
            user_data.ip           = json_get(resp, "ip");
            user_data.hwid         = hwid;
            user_data.createdate   = json_get(resp, "createdate");
            user_data.lastlogin    = json_get(resp, "lastlogin");
            user_data.subscription = json_get(resp, "subscription");
            user_data.expiry       = json_get(resp, "expiry");
        }
    };

} // namespace LarpAuth
