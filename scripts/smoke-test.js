const { spawn } = require("child_process");

const PORT = Number(process.env.CI_PORT || 4310);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const START_TIMEOUT_MS = 15000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const payload = await response.json();
  return { status: response.status, payload };
}

async function waitForHealth() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < START_TIMEOUT_MS) {
    try {
      const { status, payload } = await fetchJson("/api/me");
      if (status === 200 && payload && payload.ok === true) {
        return;
      }
    } catch (_error) {
      // server may not be up yet
    }
    await delay(300);
  }
  throw new Error(`Server did not start within ${START_TIMEOUT_MS}ms.`);
}

async function run() {
  const child = spawn("node", ["server.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: String(PORT),
      OTP_SMS_PROVIDER: "mimic",
      OTP_ALLOW_DEV_CODE: "true"
    }
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  const cleanup = () => {
    if (!child.killed) {
      child.kill();
    }
  };

  try {
    await waitForHealth();

    const publicInfo = await fetchJson("/api/public-info");
    if (publicInfo.status !== 200 || publicInfo.payload.ok !== true) {
      throw new Error("Expected /api/public-info to return ok=true.");
    }

    const me = await fetchJson("/api/me");
    if (me.status !== 200 || me.payload.authenticated !== false) {
      throw new Error("Expected /api/me to return authenticated=false for a new session.");
    }

    const otp = await fetchJson("/api/auth/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+254700111222" })
    });
    if (otp.status !== 200 || otp.payload.ok !== true || !otp.payload.devCode) {
      throw new Error("Expected OTP request to return a demo code in mimic mode.");
    }

    // eslint-disable-next-line no-console
    console.log("Smoke test passed.");
  } finally {
    cleanup();
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Smoke test failed:", error.message);
  process.exit(1);
});
