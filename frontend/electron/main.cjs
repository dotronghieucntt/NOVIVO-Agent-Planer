const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow
let backendProcess
let logStream = null

// ── Logger (ghi file + console) ──────────────────────────────────────────────
function initLogger() {
  const logDir = isDev
    ? path.join(__dirname, '../../logs')
    : path.join(app.getPath('userData'), 'logs')

  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })

  // Rotate: giữ 5 file gần nhất
  const files = fs.readdirSync(logDir)
    .filter(f => f.startsWith('novivo-') && f.endsWith('.log'))
    .sort().reverse()
  files.slice(4).forEach(f => {
    try { fs.unlinkSync(path.join(logDir, f)) } catch {}
  })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const logFile = path.join(logDir, `novivo-${stamp}.log`)
  logStream = fs.createWriteStream(logFile, { flags: 'a', encoding: 'utf8' })

  const write = (level, ...args) => {
    const line = `[${new Date().toISOString()}] [${level}] ${args.map(a =>
      typeof a === 'object' ? JSON.stringify(a) : String(a)
    ).join(' ')}\n`
    logStream.write(line)
    if (level === 'ERROR') process.stderr.write(line)
    else process.stdout.write(line)
  }

  global.log = {
    info:  (...a) => write('INFO',  ...a),
    warn:  (...a) => write('WARN',  ...a),
    error: (...a) => write('ERROR', ...a),
    path:  () => logFile,
  }

  // Capture unhandled errors
  process.on('uncaughtException',  e => global.log.error('uncaughtException:', e.stack || e))
  process.on('unhandledRejection', e => global.log.error('unhandledRejection:', e))

  global.log.info('=== NOVIVO started ===')
  global.log.info('Log file:', logFile)
  global.log.info('userData:', isDev ? 'DEV' : app.getPath('userData'))
  return logFile
}

// ── Poll backend until it responds ──────────────────────────────────────────
function waitForBackend(maxAttempts = 40) {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const check = () => {
      const req = http.get('http://127.0.0.1:8001/', (res) => {
        global.log.info(`Backend ready after ${attempts + 1} poll(s)`)
        resolve()
      })
      req.on('error', () => {
        if (++attempts >= maxAttempts) {
          const err = new Error('Backend did not start in time')
          global.log.error(err.message)
          reject(err)
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
  const logDir     = path.join(userDataDir, 'logs')

  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true })
  if (!fs.existsSync(logDir))      fs.mkdirSync(logDir, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backendLog = path.join(logDir, `backend-${stamp}.log`)
  const backendLogStream = fs.createWriteStream(backendLog, { flags: 'a', encoding: 'utf8' })

  const dbPath     = path.join(userDataDir, 'content_planner.db').replace(/\\/g, '/')
  const chromaPath = path.join(userDataDir, 'chroma_data').replace(/\\/g, '/')

  global.log.info('Starting backend:', exePath)
  global.log.info('Backend log:', backendLog)

  backendProcess = spawn(exePath, [], {
    cwd: userDataDir,
    env: {
      ...process.env,
      DATABASE_URL:        `sqlite:///${dbPath}`,
      CHROMA_PERSIST_DIR:  chromaPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  backendProcess.stdout.on('data', d => {
    const line = d.toString().trimEnd()
    backendLogStream.write(`[STDOUT] ${line}\n`)
  })
  backendProcess.stderr.on('data', d => {
    const line = d.toString().trimEnd()
    backendLogStream.write(`[STDERR] ${line}\n`)
    // Also mirror uvicorn errors to main log
    if (line.includes('ERROR') || line.includes('Traceback')) {
      global.log.error('[backend]', line)
    }
  })

  backendProcess.on('error', (err) => {
    global.log.error('Backend spawn error:', err.message)
  })
  backendProcess.on('exit', (code, signal) => {
    global.log.warn(`Backend exited: code=${code} signal=${signal}`)
    backendLogStream.end()
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

  // Log renderer errors
  mainWindow.webContents.on('render-process-gone', (e, details) => {
    global.log.error('Renderer crashed:', JSON.stringify(details))
  })
  mainWindow.webContents.on('did-fail-load', (e, code, desc, url) => {
    global.log.error(`Load failed: ${code} ${desc} url=${url}`)
  })
  mainWindow.webContents.on('console-message', (e, level, msg, line, src) => {
    if (level >= 2) global.log.error(`[renderer] ${msg} (${src}:${line})`)
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
      global.log.error('Backend timeout, loading app anyway:', e.message)
    }

    // Load actual React app
    const appUrl = `file://${path.join(__dirname, '../dist/index.html')}`
    global.log.info('Loading app:', appUrl)
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
  initLogger()
  Menu.setApplicationMenu(null)
  createWindow()
})

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill()
    backendProcess = null
  }
  global.log && global.log.info('App closing')
  if (logStream) logStream.end()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

