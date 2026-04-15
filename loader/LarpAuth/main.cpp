/*
 * LarpAuth Loader — x64
 * Fill in your App Name, Owner ID, and Secret from the Applications page
 * on your LarpAuth dashboard before building.
 */

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <Windows.h>
#include <iostream>
#include <string>
#include <limits>

#include "auth.hpp"
#include "skStr.h"

using namespace LarpAuth;

/* ── Paste your credentials from the Applications > Credentials panel ──────
   Leave version as "1.0" unless you changed it in the dashboard.           */
std::string app_name   = skCrypt("Loader").decrypt();
std::string owner_id   = skCrypt("0cb8b469-846").decrypt();
std::string app_secret = skCrypt("d8da8a11-3c72-4792-a9d1-fe0d3c9c0739").decrypt();
std::string app_ver    = skCrypt("1.0").decrypt();

/* ── Paste your Cloudflare Worker URL here ── */
std::string worker_url = skCrypt("https://YOUR-WORKER.workers.dev").decrypt();

api LarpAuthApp(app_name, owner_id, app_secret, app_ver, worker_url);
lockout_state login_guard{};

/* ── Helpers ─────────────────────────────────────────────────────────────── */
static bool read_int(int& out)
{
    std::cin >> out;
    if (std::cin.fail())
    {
        std::cin.clear();
        std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
        return false;
    }
    return true;
}

static void print_user_data()
{
    auto& u = LarpAuthApp.user_data;
    std::cout << skCrypt("\n\n ── Authenticated ──────────────────");
    std::cout << skCrypt("\n  Username     : ") << u.username;
    std::cout << skCrypt("\n  IP Address   : ") << u.ip;
    std::cout << skCrypt("\n  Hardware ID  : ") << u.hwid;
    std::cout << skCrypt("\n  Subscription : ") << u.subscription;
    std::cout << skCrypt("\n ───────────────────────────────────\n");
}

/* ── Auto-login from saved credentials ───────────────────────────────────── */
static bool try_auto_login(std::string& username, std::string& password, std::string& key)
{
    std::string saved_license  = read_saved("license");
    std::string saved_username = read_saved("username");
    std::string saved_password = read_saved("password");

    if (!saved_license.empty())
    {
        key = saved_license;
        std::cout << skCrypt("\n  Auto-login with saved license key...");
        LarpAuthApp.license(key);
        return true;
    }

    if (!saved_username.empty() && !saved_password.empty())
    {
        username = saved_username;
        password = saved_password;
        std::cout << skCrypt("\n  Auto-login as ") << username << skCrypt("...");
        LarpAuthApp.login(username, password);
        return true;
    }

    return false;
}

/* ── Entry point ─────────────────────────────────────────────────────────── */
int main()
{
    SetConsoleTitleA(skCrypt("LarpAuth Loader"));

    /* Pretty header */
    std::cout << skCrypt(
        "\n"
        "  ██╗      █████╗ ██████╗ ██████╗  █████╗ ██╗   ██╗████████╗██╗  ██╗\n"
        "  ██║     ██╔══██╗██╔══██╗██╔══██╗██╔══██╗██║   ██║╚══██╔══╝██║  ██║\n"
        "  ██║     ███████║██████╔╝██████╔╝███████║██║   ██║   ██║   ███████║\n"
        "  ██║     ██╔══██║██╔══██╗██╔═══╝ ██╔══██║██║   ██║   ██║   ██╔══██║\n"
        "  ███████╗██║  ██║██║  ██║██║     ██║  ██║╚██████╔╝   ██║   ██║  ██║\n"
        "  ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝  ╚═╝ ╚═════╝    ╚═╝   ╚═╝  ╚═╝\n"
    );
    std::cout << skCrypt("\n  Connecting to LarpAuth...\n");

    /* Init */
    LarpAuthApp.init();
    if (!LarpAuthApp.response.success)
    {
        std::cout << skCrypt("\n  [!] ") << LarpAuthApp.response.message;
        Sleep(3000);
        return 1;
    }

    std::cout << skCrypt("  [+] ") << LarpAuthApp.response.message << "\n";

    /* Lockout check */
    if (lockout_active(login_guard))
    {
        std::cout << skCrypt("\n  [!] Too many failed attempts. Try again in ")
                  << lockout_remaining_ms(login_guard) / 1000
                  << skCrypt(" seconds.");
        Sleep(4000);
        return 0;
    }

    std::string username, password, key;

    /* Try auto-login from saved creds */
    const bool used_saved = try_auto_login(username, password, key);

    if (!used_saved)
    {
        std::cout << skCrypt(
            "\n  [1] Login\n"
            "  [2] Register\n"
            "  [3] License key only\n"
            "\n  Choose option: "
        );

        int option = 0;
        if (!read_int(option))
        {
            std::cout << skCrypt("\n  [!] Invalid selection.");
            Sleep(3000);
            return 1;
        }

        switch (option)
        {
        case 1:
            std::cout << skCrypt("\n  Username : "); std::cin >> username;
            std::cout << skCrypt("  Password : "); std::cin >> password;
            LarpAuthApp.login(username, password);
            break;

        case 2:
            std::cout << skCrypt("\n  Username     : "); std::cin >> username;
            std::cout << skCrypt("  Password     : "); std::cin >> password;
            std::cout << skCrypt("  License Key  : "); std::cin >> key;
            LarpAuthApp.regstr(username, password, key);
            break;

        case 3:
            std::cout << skCrypt("\n  License Key : "); std::cin >> key;
            LarpAuthApp.license(key);
            break;

        default:
            std::cout << skCrypt("\n  [!] Invalid selection.");
            Sleep(3000);
            return 1;
        }
    }

    /* Handle auth result */
    if (!LarpAuthApp.response.success)
    {
        std::cout << skCrypt("\n  [!] ") << LarpAuthApp.response.message;
        record_login_fail(login_guard);
        Sleep(3000);
        return 1;
    }

    reset_lockout(login_guard);
    print_user_data();

    /* Offer to save credentials */
    if (!used_saved)
    {
        std::cout << skCrypt("  Save credentials for next launch? [y/n]: ");
        char choice = 'n';
        std::cin >> choice;
        if (choice == 'y' || choice == 'Y')
        {
            if (!key.empty())
                write_saved("license", key);
            else
            {
                write_saved("username", username);
                write_saved("password", password);
            }
            std::cout << skCrypt("  [+] Credentials saved.\n");
        }
    }

    /* ── Your protected code starts here ─────────────────────────────────── */
    std::cout << skCrypt("\n  [+] Loader authenticated. Starting application...\n\n");

    // TODO: load your payload / launch your protected software here

    std::cout << skCrypt("  Press any key to exit...");
    std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
    std::cin.get();
    return 0;
}
