import * as child_process from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { BrowserWindow, Menu, app, ipcMain, safeStorage } from "electron";
import { WebSocketServer as WSS, WebSocket } from "ws";

let mainWindow: BrowserWindow | null = null;
let agentProcess: child_process.ChildProcess | null = null;
let rendererServer: { port: number; close: () => void } | null = null;
const rendererClients = new Set<WebSocket>();
const INTERNAL_PORT = 7712;
const SUPERHIVE_EXT_PATH = path.join(__dirname, "../../extensions/superhive");
const API_KEY_PATH = path.join(app.getPath("userData"), "api_key.enc");

function loadApiKey(): string | null {
  if (process.env.SUPERHIVE_API_KEY) {
    return process.env.SUPERHIVE_API_KEY;
  }
  try {
    if (fs.existsSync(API_KEY_PATH) && safeStorage.isEncryptionAvailable()) {
      const encrypted = fs.readFileSync(API_KEY_PATH);
      return safeStorage.decryptString(encrypted);
    }
  } catch {}
  return null;
}

function saveApiKey(key: string): void {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(key);
      fs.writeFileSync(API_KEY_PATH, encrypted);
    }
  } catch {}
}

async function startRendererServer(): Promise<{ port: number; close: () => void }> {
  return new Promise((resolve) => {
    const wss = new WSS({ host: "127.0.0.1", port: INTERNAL_PORT });

    wss.on("listening", () => {
      resolve({
        port: INTERNAL_PORT,
        close: () => wss.close(),
      });
    });

    wss.on("connection", (ws) => {
      rendererClients.add(ws);
      ws.on("message", (data) => {
        const msg = data.toString();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("superhive:in", msg);
        }
      });
      ws.on("close", () => rendererClients.delete(ws));
    });
  });
}

function spawnAgent(): void {
  const piPath = findPiBinary();
  const extPath = SUPERHIVE_EXT_PATH;

  const env = {
    ...process.env,
    SUPERHIVE_PUBLIC_PORT: "7711",
    SUPERHIVE_INTERNAL_URL: `ws://127.0.0.1:${INTERNAL_PORT}`,
    SUPERHIVE_MODE: "localhost",
  };

  agentProcess = child_process.spawn(piPath, ["--extension", extPath], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  agentProcess.stdout?.on("data", (d) => {
    process.stdout.write(`[agent] ${d}`);
  });

  agentProcess.stderr?.on("data", (d) => {
    process.stderr.write(`[agent!] ${d}`);
  });

  agentProcess.on("exit", (code) => {
    console.log(`[main] agent exited with code ${code}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("agent:exited", code);
    }
  });
}

function findPiBinary(): string {
  const candidates = [
    path.join(__dirname, "../../../../pi/pi"),
    path.join(__dirname, "../../../pi/pi"),
    path.join(process.cwd(), "pi"),
    "pi",
  ];

  for (const candidate of candidates) {
    try {
      require("fs").accessSync(candidate);
      return candidate;
    } catch {
      // try next
    }
  }

  return "pi";
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "SuperHive",
      submenu: [
        { label: "About SuperHive", role: "about" },
        { type: "separator" },
        { label: "Reload Agent", accelerator: "CmdOrCtrl+R", click: () => restartAgent() },
        { type: "separator" },
        { label: "Quit", accelerator: "CmdOrCtrl+Q", role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { label: "Undo", accelerator: "CmdOrCtrl+Z", role: "undo" },
        { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", role: "redo" },
        { type: "separator" },
        { label: "Cut", accelerator: "CmdOrCtrl+X", role: "cut" },
        { label: "Copy", accelerator: "CmdOrCtrl+C", role: "copy" },
        { label: "Paste", accelerator: "CmdOrCtrl+V", role: "paste" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { label: "Minimize", accelerator: "CmdOrCtrl+M", role: "minimize" },
        { label: "Zoom", role: "zoom" },
        { type: "separator" },
        { label: "Bring All to Front", role: "front" },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function restartAgent(): void {
  if (agentProcess) {
    agentProcess.kill();
    agentProcess = null;
  }
  setTimeout(() => spawnAgent(), 1000);
}

ipcMain.on("superhive:out", (_event, msg) => {
  const data = typeof msg === "string" ? msg : JSON.stringify(msg);
  for (const ws of rendererClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
});

ipcMain.handle("superhive:send", (_event, msg) => {
  const data = typeof msg === "string" ? msg : JSON.stringify(msg);
  for (const ws of rendererClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
});

ipcMain.handle("api-key:get", () => {
  return loadApiKey();
});

ipcMain.handle("api-key:set", (_event, key: string) => {
  saveApiKey(key);
  return true;
});

ipcMain.on("agent:restart", () => {
  restartAgent();
});

app.whenReady().then(async () => {
  buildMenu();

  rendererServer = await startRendererServer();
  console.log(`[main] renderer server on port ${rendererServer.port}`);

  spawnAgent();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "SuperHive",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
});

app.on("window-all-closed", () => {
  if (agentProcess) {
    agentProcess.kill();
    agentProcess = null;
  }
  if (rendererServer) {
    rendererServer.close();
    rendererServer = null;
  }
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    app.whenReady().then(async () => {
      rendererServer = await startRendererServer();
      spawnAgent();
    });
  }
});

app.on("before-quit", () => {
  if (agentProcess) {
    agentProcess.kill();
    agentProcess = null;
  }
});
