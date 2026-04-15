# LarpAuth C++ Loader — x64

Visual Studio 2022 project. No external libraries required — uses WinHTTP (built into Windows).

## Setup

1. Open `LarpAuth.sln` in Visual Studio 2022
2. In your LarpAuth dashboard, go to **Applications** and click an app card to load its credentials
3. Open `main.cpp` and replace the three placeholders at the top:

```cpp
std::string app_name   = skCrypt("YOUR_APP_NAME").decrypt();
std::string owner_id   = skCrypt("YOUR_OWNER_ID").decrypt();
std::string app_secret = skCrypt("YOUR_APP_SECRET").decrypt();
```

4. Set build configuration to **Release | x64**
5. Build → your loader EXE will be in `bin\Release\`

## Features

| Feature | Description |
|---|---|
| `LarpAuthApp.init()` | Verifies the app is active |
| `LarpAuthApp.license(key)` | Authenticate with a license key only |
| `LarpAuthApp.login(user, pass)` | Authenticate with username + password |
| `LarpAuthApp.regstr(user, pass, key)` | Register a new user with a license key |
| Auto-login | Saves credentials to `larpauth_save.dat` on request |
| Lockout guard | Locks out after 3 failed attempts for 30 seconds |
| `skCrypt(...)` | Compile-time string encryption (strings never appear in plaintext in the binary) |

## Files

```
loader/
├── LarpAuth.sln
└── LarpAuth/
    ├── main.cpp          ← Entry point — edit credentials here
    ├── auth.hpp          ← LarpAuth API class (WinHTTP)
    ├── skStr.h           ← Compile-time string encryption
    ├── LarpAuth.vcxproj
    └── LarpAuth.vcxproj.filters
```

## Connecting to a live backend

`auth.hpp` currently contains a local simulation so you can build and run immediately.
When you have a real API backend, replace the `request()` method body in `auth.hpp` with
the actual WinHTTP POST call (the `http_post()` helper is already written, just wire it up).
