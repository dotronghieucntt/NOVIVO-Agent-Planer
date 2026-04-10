const { app, BrowserWindow, shell, Menu } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow
let backendProcess

// ── Poll backend until it responds ──────────────────────────────────────────
function waitForBackend(maxAttempts = 40) {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const check = () => {
      const req = http.get('http://127.0.0.1:8001/', (res) => {
        resolve()
      })
      req.on('error', () => {
        if (++attempts >= maxAttempts) {
          reject(new Error('Backend did not start in time'))
        } else {
          setTimeout(check, 1000)
        }
      })
      req.setTimeout(800, () => { req.destroy() })
    }
    setTimeout(check, 1500) // initial grace period
  })
}

// ── Start PyInstaller backend ────────────────────────────────────────────────
function startBackend() {
  if (isDev) return

  const backendDir = path.join(process.resourcesPath, 'backend', 'novivo_backend')
  const exePath    = path.join(backendDir, 'novivo_backend.exe')
  const userDataDir = app.getPath('userData')

  // Ensure userData dir exists (writable, persists across updates)
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true })

  const dbPath     = path.join(userDataDir, 'content_planner.db').replace(/\\/g, '/')
  const chromaPath = path.join(userDataDir, 'chroma_data').replace(/\\/g, '/')

  backendProcess = spawn(exePath, [], {
    cwd: userDataDir,
    env: {
      ...process.env,
      DATABASE_URL:        `sqlite:///${dbPath}`,
      CHROMA_PERSIST_DIR:  chromaPath,
    },
    stdio: 'ignore',
  })

  backendProcess.on('error', (err) => {
    console.error('Backend process error:', err)
  })
}

// ── Loading splash HTML ──────────────────────────────────────────────────────
const LOADING_HTML = `data:text/html;charset=utf-8,<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>NOVIVO</title>
<style>*{margin:0;padding:0;box-sizing:border-box}
body{background:#0f0f13;display:flex;align-items:center;justify-content:center;
     height:100vh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff}
.wrap{text-align:center}
.logo{font-size:32px;font-weight:800;letter-spacing:2px;
      background:linear-gradient(135deg,#a78bfa,#8b5cf6);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:12px}
.sub{font-size:13px;color:#6b7280;margin-bottom:28px}
.spinner{width:32px;height:32px;border:3px solid #1f1f2e;border-top-color:#8b5cf6;
         border-radius:50%;animation:spin .8s linear infinite;margin:0 auto}
@keyframes spin{to{transform:rotate(360deg)}}</style></head>
<body><div class="wrap">
<div class="logo">NOVIVO</div>
<div class="sub">AI Content Planer</div>
<div class="spinner"></div>
</div></body></html>`

// ── Create main window ───────────────────────────────────────────────────────
async function createWindow() {
  const iconPath = isDev
    ? path.join(__dirname, '../public/icon.ico')
    : path.join(process.resourcesPath, 'icon.ico')

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    frame: true,
    title: 'NOVIVO',
    backgroundColor: '#0f0f13',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    show: false,
  })

  if (!isDev) {
    // Show splash immediately
    await mainWindow.loadURL(LOADING_HTML)
    mainWindow.show()

    // Start backend then wait for it
    startBackend()
    try {
      await waitForBackend()
    } catch (e) {
      console.error('Backend timeout, loading app anyway:', e.message)
    }

    // Load actual React app
    const appUrl = `file://${path.join(__dirname, '../dist/index.html')}`
    await mainWindow.loadURL(appUrl)
  } else {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.once('ready-to-show', () => {
      mainWindow.show()
      mainWindow.webContents.openDevTools()
    })
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createWindow()
})

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill()
    backendProcess = null
  }
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

