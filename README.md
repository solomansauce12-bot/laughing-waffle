# LarpAuth

A self-hosted software authentication platform — manage license keys, users, and applications from a clean dark-themed dashboard.

![LarpAuth](https://img.shields.io/badge/LarpAuth-Authentication-2563eb?style=for-the-badge)
![HTML](https://img.shields.io/badge/HTML-CSS-JS-orange?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

## Features

- **License Key System** — Generate, bulk-create, reset, and delete license keys with levels and expiry
- **User Management** — View, ban/unban, reset HWID, and manage user levels
- **Multi-Application** — Create multiple apps each with their own secret key and settings
- **HWID Locking** — Bind users to a specific hardware ID
- **Activity Logs** — Track every login and authentication event
- **Webhook Support** — Send real-time notifications to Discord or any endpoint
- **Dark Theme** — Clean dark UI with blue accent throughout

## Pages

| Page | File |
|---|---|
| Landing | `index.html` |
| Login / Register | `login.html` |
| Dashboard | `dashboard.html` |
| Applications | `applications.html` |
| License Keys | `licenses.html` |
| Users | `users.html` |
| Settings | `settings.html` |

## Usage

**No server or build tools required.** This is a pure HTML/CSS/JS site.

### Local
Open `login.html` directly in any browser.

### GitHub Pages
1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Set source to `main` branch, root `/`
4. Your site will be live at `https://<username>.github.io/<repo>/login.html`

### Default Credentials
```
Username: admin
Password: admin
```
> You can also register a new account on first launch.

## Tech Stack

- Vanilla HTML / CSS / JavaScript
- All data stored in `localStorage` (no backend required)
- Google Fonts — Inter
- Inline SVG icons (no icon library dependency)

## License

MIT — free to use and self-host.
