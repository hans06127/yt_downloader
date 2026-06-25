import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const root = process.cwd();
const port = 3001;
const devtoolsPort = 9333;
const outputDir = resolve(root, ".next");
const profileDir = resolve(outputDir, `smoke-edge-profile-${process.pid}`);
const desktopScreenshot = resolve(outputDir, "smoke-desktop.png");
const mobileScreenshot = resolve(outputDir, "smoke-mobile.png");
const listScreenshot = resolve(outputDir, "smoke-list-desktop.png");
const domOutput = resolve(outputDir, "smoke-dom.html");
const nextCli = resolve(root, "node_modules", "next", "dist", "bin", "next");
const edgeCandidates = [
  process.env.EDGE_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const edgePath = edgeCandidates.find(existsSync);

if (!edgePath) {
  throw new Error("找不到 Microsoft Edge，請設定 EDGE_PATH。");
}

mkdirSync(outputDir, { recursive: true });
rmSync(profileDir, { recursive: true, force: true });

const sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

function terminateProcessTree(child) {
  if (!child || child.killed || !child.pid) return;
  child.kill("SIGTERM");
  child.stdout?.destroy();
  child.stderr?.destroy();
}

async function waitFor(check, timeoutMs, description) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }

    await sleep(500);
  }

  throw new Error(`${description}逾時${lastError ? `：${lastError.message}` : ""}`);
}

class CdpClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = new WebSocket(url);
  }

  async connect() {
    await new Promise((resolveConnect, reject) => {
      this.socket.addEventListener("open", resolveConnect, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });

    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) {
        for (const listener of this.listeners.get(message.method) || []) {
          listener(message.params);
        }
        return;
      }

      const request = this.pending.get(message.id);
      if (!request) return;

      this.pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    });
    this.socket.addEventListener("close", () => {
      for (const request of this.pending.values()) {
        clearTimeout(request.timer);
        request.reject(new Error("Edge DevTools connection closed"));
      }
      this.pending.clear();
    });
  }

  send(method, params = {}) {
    if (this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Edge DevTools connection is not open"));
    }

    const id = this.nextId++;

    return new Promise((resolveRequest, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Edge DevTools request timed out: ${method}`));
      }, 15000);
      this.pending.set(id, { resolve: resolveRequest, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) || [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  close() {
    this.socket.close();
  }
}

async function getText(client) {
  const result = await client.send("Runtime.evaluate", {
    expression: "document.body.innerText",
    returnByValue: true,
  });

  return result.result.value || "";
}

async function capture(client, path, width, height, mobile) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
  await sleep(750);

  const screenshot = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(path, Buffer.from(screenshot.data, "base64"));
}

let server;
let browser;
let client;
let serverLog = "";
let serverError = "";
let browserError = "";
let browserExit = "";
const browserConsole = [];

try {
  const occupied = await fetch(`http://127.0.0.1:${port}`, {
    signal: AbortSignal.timeout(1000),
  })
    .then(() => true)
    .catch(() => false);

  if (occupied) {
    throw new Error(`Port ${port} 已被使用，請先關閉現有服務。`);
  }

  server = spawn(process.execPath, [nextCli, "dev", "--webpack", "--port", String(port)], {
    cwd: root,
    env: {
      ...process.env,
      NEXT_PUBLIC_USE_MOCK: "true",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  server.stdout.on("data", (chunk) => {
    serverLog += chunk;
  });
  server.stderr.on("data", (chunk) => {
    serverError += chunk;
  });

  await waitFor(
    () =>
      fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(60000) })
        .then((response) => response.ok)
        .catch(() => false),
    120000,
    "Next.js 啟動",
  );

  browser = spawn(
    edgePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-gpu-compositing",
      "--disable-gpu-sandbox",
      "--disable-background-networking",
      "--disable-features=Dawn,SkiaGraphite,Vulkan",
      "--enable-unsafe-swiftshader",
      "--use-angle=swiftshader-webgl",
      "--no-sandbox",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${devtoolsPort}`,
      "--remote-allow-origins=*",
      `--user-data-dir=${profileDir}`,
      `http://127.0.0.1:${port}/`,
    ],
    {
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    },
  );
  browser.stderr.on("data", (chunk) => {
    browserError += chunk;
  });
  browser.on("exit", (code, signal) => {
    browserExit = `code=${code}, signal=${signal}`;
  });

  const page = await waitFor(
    async () => {
      const response = await fetch(`http://127.0.0.1:${devtoolsPort}/json/list`, {
        signal: AbortSignal.timeout(2000),
      });
      const pages = await response.json();
      return pages.find((entry) => entry.type === "page");
    },
    30000,
    "Edge DevTools",
  );

  client = new CdpClient(page.webSocketDebuggerUrl);
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  client.on("Runtime.consoleAPICalled", (event) => {
    browserConsole.push(
      event.args
        .map((argument) => argument.value ?? argument.description ?? "")
        .join(" "),
    );
  });
  client.on("Runtime.exceptionThrown", (event) => {
    browserConsole.push(
      `Runtime exception: ${event.exceptionDetails.exception?.description || event.exceptionDetails.text}`,
    );
  });
  const bodyText = await waitFor(
    async () => {
      const text = await getText(client);
      return text.includes("單一網址下載") && text.includes("單一網址") ? text : "";
    },
    120000,
    "React 首頁渲染",
  );

  await waitFor(
    async () => (await getText(client)).includes("Cookie 已載入"),
    60000,
    "MSW mock",
  );

  const html = await client.send("Runtime.evaluate", {
    expression: "document.documentElement.outerHTML",
    returnByValue: true,
  });
  writeFileSync(domOutput, html.result.value, "utf8");

  await capture(client, desktopScreenshot, 1440, 1000, false);
  await capture(client, mobileScreenshot, 390, 844, true);

  await client.send("Runtime.evaluate", {
    expression: `(() => {
      const input = document.querySelector('input[placeholder="貼上 YouTube 影片網址"]');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'https://www.youtube.com/watch?v=mock001');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      [...document.querySelectorAll('button')].find((button) => button.textContent.includes('查詢')).click();
    })()`,
  });

  await waitFor(
    async () => (await getText(client)).includes("示範影片（繁體）"),
    30000,
    "Mock 影片查詢",
  );

  await client.send("Runtime.evaluate", {
    expression: `(() => {
      const output = [...document.querySelectorAll('input[type="text"]')]
        .find((input) => input.placeholder.includes('影片標題'));
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(output, 'C:\\\\temp\\\\should-reset');
      output.dispatchEvent(new Event('input', { bubbles: true }));
      [...document.querySelectorAll('button')].find((button) => button.textContent.includes('查詢')).click();
    })()`,
  });

  await waitFor(
    async () => {
      const result = await client.send("Runtime.evaluate", {
        expression: `(() => {
          const output = [...document.querySelectorAll('input[type="text"]')]
            .find((input) => input.placeholder.includes('影片標題'));
          return output ? output.value : null;
        })()`,
        returnByValue: true,
      });
      return result.result.value === "";
    },
    30000,
    "查詢重置輸出設定",
  );

  await client.send("Runtime.evaluate", {
    expression: `[...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('下載此影片')).click()`,
  });

  await waitFor(
    async () => (await getText(client)).includes("再次下載失敗項目"),
    30000,
    "失敗下載重試區",
  );

  await waitFor(
    () =>
      ["下載中", "下載完成", "下載失敗"].every((label) =>
        browserConsole.some((entry) => entry.includes(label)),
      ),
    30000,
    "下載 console 紀錄",
  );

  await waitFor(
    async () => {
      const result = await client.send("Runtime.evaluate", {
        expression: `(() => {
          const raw = localStorage.getItem('yt-downloader-failed-downloads');
          if (!raw) return 0;
          return JSON.parse(raw).state.records.length;
        })()`,
        returnByValue: true,
      });
      return result.result.value === 1;
    },
    30000,
    "失敗紀錄 localStorage",
  );

  await client.send("Runtime.evaluate", {
    expression: `[...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('查詢')).click()`,
  });

  await waitFor(
    async () => {
      const text = await getText(client);
      return !text.includes("下載進度") && text.includes("可重新下載的項目");
    },
    30000,
    "重新查詢清除進度",
  );

  await client.send("Runtime.evaluate", {
    expression: `[...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('清除清單')).click()`,
  });

  await waitFor(
    async () => {
      const result = await client.send("Runtime.evaluate", {
        expression: `Boolean(document.querySelector('.ant-modal-confirm-btns .ant-btn-primary'))`,
        returnByValue: true,
      });
      return result.result.value;
    },
    10000,
    "清除失敗紀錄確認視窗",
  );

  await client.send("Runtime.evaluate", {
    expression: `document.querySelector('.ant-modal-confirm-btns .ant-btn-primary').click()`,
  });

  await waitFor(
    async () => {
      const result = await client.send("Runtime.evaluate", {
        expression: `(() => {
          const raw = localStorage.getItem('yt-downloader-failed-downloads');
          const count = raw ? JSON.parse(raw).state.records.length : 0;
          return count === 0 && !document.body.innerText.includes('可重新下載的項目');
        })()`,
        returnByValue: true,
      });
      return result.result.value;
    },
    10000,
    "清除 store 與 localStorage",
  );

  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await client.send("Runtime.evaluate", {
    expression: `[...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('多個網址')).click()`,
  });
  await waitFor(
    async () => (await getText(client)).includes("多個網址，每行一個"),
    10000,
    "切換多個網址頁面",
  );
  await client.send("Runtime.evaluate", {
    expression: `(() => {
      const textarea = document.querySelector('textarea');
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(textarea, 'https://www.youtube.com/watch?v=mock001');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    })()`,
  });
  await sleep(250);
  await client.send("Runtime.evaluate", {
    expression: `[...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('查詢全部資訊')).click()`,
  });
  await waitFor(
    async () => {
      const result = await client.send("Runtime.evaluate", {
        expression: `Boolean(document.querySelector('.video-item .title-input'))`,
        returnByValue: true,
      });
      return result.result.value;
    },
    30000,
    "多網址查詢結果",
  );
  const titleWidthRatio = await client.send("Runtime.evaluate", {
    expression: `(() => {
      const title = document.querySelector('.video-title');
      const row = document.querySelector('.video-item');
      return title.getBoundingClientRect().width / row.getBoundingClientRect().width;
    })()`,
    returnByValue: true,
  });
  if (titleWidthRatio.result.value < 0.62 || titleWidthRatio.result.value > 0.76) {
    throw new Error(`影片標題欄寬度比例不符：${titleWidthRatio.result.value}`);
  }
  const mediaToolCounts = await client.send("Runtime.evaluate", {
    expression: `({
      preview: document.querySelectorAll('button[title="預覽影片"]').length,
      segments: document.querySelectorAll('button[title="設定下載區段"]').length,
    })`,
    returnByValue: true,
  });
  if (!mediaToolCounts.result.value.preview || !mediaToolCounts.result.value.segments) {
    throw new Error("查詢結果缺少預覽或下載區段按鈕");
  }
  await client.send("Runtime.evaluate", {
    expression: `document.querySelector('button[title="設定下載區段"]').click()`,
  });
  await waitFor(
    async () => (await getText(client)).includes("下載區段："),
    10000,
    "下載區段視窗",
  );
  await client.send("Runtime.evaluate", {
    expression: `document.querySelector('.ant-modal-close').click()`,
  });
  await capture(client, listScreenshot, 1440, 1000, false);

  const requiredLabels = ["單一網址", "多個網址", "播放清單", "匯入檔案"];
  for (const label of requiredLabels) {
    if (!bodyText.includes(label)) {
      throw new Error(`首頁缺少模式：${label}`);
    }
  }
  if (!(await getText(client)).includes("v0.2.0")) {
    throw new Error("側欄未顯示版本 v0.2.0");
  }

  console.log("Smoke test passed");
  console.log(`- URL: http://localhost:${port}`);
  console.log(`- Desktop: ${desktopScreenshot}`);
  console.log(`- Mobile: ${mobileScreenshot}`);
  console.log(`- List: ${listScreenshot}`);
  console.log("- MSW: cookie-status mock intercepted");
  console.log("- Query reset: output settings cleared");
  console.log("- Retry: failed download section rendered");
  console.log("- Console: downloading/completed/failed events emitted");
  console.log("- Persist: failed download stored in localStorage");
  console.log("- Query reset: progress card cleared, failed history retained");
  console.log("- Clear: failed store and localStorage emptied");
  console.log(`- Layout: result title width ratio ${titleWidthRatio.result.value.toFixed(2)}`);
  console.log("- Media tools: preview and segment controls rendered, segment modal opened");
  console.log("- Version: sidebar rendered v0.2.0");
} catch (error) {
  console.error(error);
  if (client) {
    const body = await getText(client).catch(() => "");
    console.error(`\n--- Browser body ---\n${body}`);
  }
  if (browserConsole.length) {
    console.error(`\n--- Browser console ---\n${browserConsole.join("\n")}`);
  }
  if (serverLog) console.error(`\n--- Next stdout ---\n${serverLog}`);
  if (serverError) console.error(`\n--- Next stderr ---\n${serverError}`);
  if (browserExit) console.error(`\n--- Edge exit ---\n${browserExit}`);
  if (browserError) console.error(`\n--- Edge stderr ---\n${browserError}`);
  process.exitCode = 1;
} finally {
  if (client) {
    await Promise.race([
      client.send("Browser.close").catch(() => {}),
      sleep(2000),
    ]);
    client.close();
  }
  terminateProcessTree(browser);
  terminateProcessTree(server);
  try {
    rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    // Windows may briefly retain Edge cache handles after a browser crash.
  }
}

process.exit(process.exitCode ?? 0);
