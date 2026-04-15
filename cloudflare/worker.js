/**
 * LarpAuth Cloudflare Worker
 * KV namespace binding required: LARPAUTH (bind in Cloudflare dashboard)
 *
 * Endpoints (all POST, JSON body):
 *   { type: "init",     name, secret }
 *   { type: "license",  name, secret, key, hwid }
 *   { type: "login",    name, secret, username, password, hwid }
 *   { type: "register", name, secret, username, password, key, hwid }
 *
 * Dashboard sync endpoints (require owner_secret header):
 *   { type: "push_license", name, secret, key, maxUses, note }
 *   { type: "push_user",    name, secret, username, password, email }
 *   { type: "revoke_license", name, secret, key }
 *   { type: "delete_user",    name, secret, username }
 *   { type: "push_app",       name, secret, ownerid }
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function ok(msg, extra = {}) {
  return new Response(JSON.stringify({ success: true, message: msg, ...extra }), { headers: CORS });
}

function fail(msg) {
  return new Response(JSON.stringify({ success: false, message: msg }), { headers: CORS });
}

/* ── KV helpers ── */
async function getApp(kv, name) {
  const raw = await kv.get(`app:${name}`);
  return raw ? JSON.parse(raw) : null;
}

async function getLicense(kv, name, key) {
  const raw = await kv.get(`license:${name}:${key.toUpperCase()}`);
  return raw ? JSON.parse(raw) : null;
}

async function getUser(kv, name, username) {
  const raw = await kv.get(`user:${name}:${username.toLowerCase()}`);
  return raw ? JSON.parse(raw) : null;
}

async function getUserByEmail(kv, name, email) {
  const raw = await kv.get(`useremail:${name}:${email.toLowerCase()}`);
  return raw ? JSON.parse(raw) : null;
}

/* ── Main handler ── */
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== "POST") {
      return fail("Method not allowed.");
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return fail("Invalid JSON body.");
    }

    const { type, name, secret } = body;
    if (!type) return fail("Missing type.");

    const kv = env.LARPAUTH;

    /* ── init ── */
    if (type === "init") {
      if (!name || !secret) return fail("Missing name or secret.");
      const app = await getApp(kv, name);
      if (!app) return fail("Application not found.");
      if (app.secret !== secret) return fail("Invalid application secret.");
      if (!app.active) return fail("Application is disabled.");
      return ok("Application initialized successfully.", {
        numUsers: app.numUsers || "0",
        version: app.version || "1.0",
      });
    }

    /* ── Validate app for all other types ── */
    if (!name || !secret) return fail("Missing name or secret.");
    const app = await getApp(kv, name);
    if (!app) return fail("Application not found.");
    if (app.secret !== secret) return fail("Invalid application secret.");
    if (!app.active) return fail("Application is disabled.");

    /* ── license ── */
    if (type === "license") {
      const { key, hwid } = body;
      if (!key) return fail("Missing license key.");

      const lic = await getLicense(kv, name, key);
      if (!lic) return fail("License key not found.");
      if (!lic.active) return fail("License key is disabled.");
      if (lic.maxUses > 0 && lic.uses >= lic.maxUses) return fail("License key has reached its usage limit.");
      if (lic.expiry && lic.expiry > 0 && Date.now() / 1000 > lic.expiry) return fail("License key has expired.");

      /* HWID lock */
      if (lic.hwid && lic.hwid !== "" && lic.hwid !== hwid) return fail("Hardware ID mismatch.");
      if (!lic.hwid || lic.hwid === "") {
        lic.hwid = hwid;
      }

      lic.uses = (lic.uses || 0) + 1;
      if (lic.maxUses > 0 && lic.uses >= lic.maxUses) lic.active = false;
      await kv.put(`license:${name}:${key.toUpperCase()}`, JSON.stringify(lic));

      return ok("Authenticated.", {
        username: lic.note || key.toUpperCase(),
        ip: request.headers.get("CF-Connecting-IP") || "unknown",
        hwid: hwid || "",
        createdate: String(lic.created || 0),
        lastlogin: String(Math.floor(Date.now() / 1000)),
        subscription: lic.subscription || "default",
        expiry: String(lic.expiry || 0),
      });
    }

    /* ── login ── */
    if (type === "login") {
      const { username, password, hwid } = body;
      if (!username || !password) return fail("Missing username or password.");

      const user = await getUser(kv, name, username);
      if (!user) return fail("Invalid username or password.");
      if (user.password !== password) return fail("Invalid username or password.");
      if (user.banned) return fail("Your account has been banned.");

      /* HWID lock */
      if (user.hwid && user.hwid !== "" && user.hwid !== hwid) return fail("Hardware ID mismatch.");
      if (!user.hwid || user.hwid === "") {
        user.hwid = hwid;
        await kv.put(`user:${name}:${username.toLowerCase()}`, JSON.stringify(user));
      }

      user.lastlogin = Math.floor(Date.now() / 1000);
      await kv.put(`user:${name}:${username.toLowerCase()}`, JSON.stringify(user));

      return ok("Authenticated.", {
        username: user.username,
        ip: request.headers.get("CF-Connecting-IP") || "unknown",
        hwid: hwid || "",
        createdate: String(user.created || 0),
        lastlogin: String(user.lastlogin),
        subscription: user.subscription || "default",
        expiry: String(user.expiry || 0),
      });
    }

    /* ── register ── */
    if (type === "register") {
      const { username, password, key, hwid } = body;
      if (!username || !password || !key) return fail("Missing username, password, or license key.");

      /* Validate license */
      const lic = await getLicense(kv, name, key);
      if (!lic) return fail("Invalid license key.");
      if (!lic.active) return fail("License key is disabled.");
      if (lic.maxUses > 0 && lic.uses >= lic.maxUses) return fail("License key has reached its usage limit.");
      if (lic.expiry && lic.expiry > 0 && Date.now() / 1000 > lic.expiry) return fail("License key has expired.");
      if (lic.bound_user && lic.bound_user !== "") return fail("License key is already in use.");

      /* Check username not taken */
      const existing = await getUser(kv, name, username);
      if (existing) return fail("Username already taken.");

      const now = Math.floor(Date.now() / 1000);
      const newUser = {
        username,
        password,
        hwid: hwid || "",
        created: now,
        lastlogin: now,
        subscription: lic.subscription || "default",
        expiry: lic.expiry || 0,
        banned: false,
      };

      await kv.put(`user:${name}:${username.toLowerCase()}`, JSON.stringify(newUser));

      /* Consume license */
      lic.uses = (lic.uses || 0) + 1;
      lic.bound_user = username;
      if (lic.maxUses > 0 && lic.uses >= lic.maxUses) lic.active = false;
      await kv.put(`license:${name}:${key.toUpperCase()}`, JSON.stringify(lic));

      return ok("Account created successfully.", {
        username,
        ip: request.headers.get("CF-Connecting-IP") || "unknown",
        hwid: hwid || "",
        createdate: String(now),
        lastlogin: String(now),
        subscription: newUser.subscription,
        expiry: String(newUser.expiry),
      });
    }

    /* ── Dashboard sync: push_app ── */
    if (type === "push_app") {
      const { ownerid, version, active } = body;
      if (!ownerid) return fail("Missing ownerid.");
      const appData = {
        name,
        secret,
        ownerid,
        version: version || "1.0",
        active: active !== false,
        numUsers: "0",
      };
      await kv.put(`app:${name}`, JSON.stringify(appData));
      return ok("Application registered.");
    }

    /* ── Dashboard sync: push_license ── */
    if (type === "push_license") {
      const { key, maxUses, note, subscription, expiry } = body;
      if (!key) return fail("Missing key.");
      const licData = {
        key: key.toUpperCase(),
        active: true,
        uses: 0,
        maxUses: maxUses || 0,
        note: note || "",
        subscription: subscription || "default",
        expiry: expiry || 0,
        hwid: "",
        bound_user: "",
        created: Math.floor(Date.now() / 1000),
      };
      await kv.put(`license:${name}:${key.toUpperCase()}`, JSON.stringify(licData));
      return ok("License pushed.");
    }

    /* ── Dashboard sync: revoke_license ── */
    if (type === "revoke_license") {
      const { key } = body;
      if (!key) return fail("Missing key.");
      const lic = await getLicense(kv, name, key);
      if (!lic) return fail("License not found.");
      lic.active = false;
      await kv.put(`license:${name}:${key.toUpperCase()}`, JSON.stringify(lic));
      return ok("License revoked.");
    }

    /* ── Dashboard sync: push_user ── */
    if (type === "push_user") {
      const { username, password, email, subscription, expiry } = body;
      if (!username || !password) return fail("Missing username or password.");
      const now = Math.floor(Date.now() / 1000);
      const userData = {
        username,
        password,
        email: email || "",
        hwid: "",
        created: now,
        lastlogin: 0,
        subscription: subscription || "default",
        expiry: expiry || 0,
        banned: false,
      };
      await kv.put(`user:${name}:${username.toLowerCase()}`, JSON.stringify(userData));
      if (email) await kv.put(`useremail:${name}:${email.toLowerCase()}`, JSON.stringify({ username }));
      return ok("User pushed.");
    }

    /* ── Dashboard sync: delete_user ── */
    if (type === "delete_user") {
      const { username } = body;
      if (!username) return fail("Missing username.");
      await kv.delete(`user:${name}:${username.toLowerCase()}`);
      return ok("User deleted.");
    }

    return fail("Unknown request type.");
  },
};
