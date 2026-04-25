const { spawn } = require("child_process");
const net = require("net");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function canReachServer(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/healthz`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function waitForServer(baseUrl, timeoutMs = 20000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await canReachServer(baseUrl)) {
      return true;
    }

    await sleep(250);
  }

  return false;
}

async function findAvailablePort(host = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.unref();
    server.on("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

async function startIsolatedServer(rootDir, options = {}) {
  const {
    host = "127.0.0.1",
    stdio = "ignore",
    timeoutMs = 20000,
  } = options;
  const port = await findAvailablePort(host);
  const baseUrl = `http://${host}:${port}`;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(port),
    },
    stdio,
  });

  if (!(await waitForServer(baseUrl, timeoutMs))) {
    child.kill();
    throw new Error(`서버를 ${baseUrl} 에서 시작하지 못했습니다.`);
  }

  return {
    baseUrl,
    child,
    port,
  };
}

async function ensureServer(rootDir, options = {}) {
  const {
    baseUrl = "",
    timeoutMs = 20000,
  } = options;

  if (baseUrl) {
    if (!(await waitForServer(baseUrl, timeoutMs))) {
      throw new Error(`서버를 ${baseUrl} 에서 확인하지 못했습니다.`);
    }

    return {
      baseUrl,
      child: null,
      reused: true,
    };
  }

  return {
    ...(await startIsolatedServer(rootDir, options)),
    reused: false,
  };
}

module.exports = {
  canReachServer,
  ensureServer,
  findAvailablePort,
  sleep,
  startIsolatedServer,
  waitForServer,
};
