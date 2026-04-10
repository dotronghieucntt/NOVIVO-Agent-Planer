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
const SPLASH_HTML = `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"><title>NOVIVO</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden}
body{
  background:#08080f;
  display:flex;align-items:center;justify-content:center;
  height:100vh;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  color:#fff;
  position:relative;
}
/* ambient glow */
.glow{
  position:fixed;
  width:700px;height:700px;
  background:radial-gradient(circle,rgba(109,40,217,.18) 0%,transparent 65%);
  top:50%;left:50%;transform:translate(-50%,-50%);
  animation:glow-pulse 3s ease-in-out infinite;
  pointer-events:none;
}
@keyframes glow-pulse{
  0%,100%{opacity:.5;transform:translate(-50%,-50%) scale(1)}
  50%{opacity:1;transform:translate(-50%,-50%) scale(1.15)}
}
/* card */
.wrap{
  text-align:center;
  position:relative;z-index:1;
  width:340px;
  animation:fade-in .6s ease both;
}
@keyframes fade-in{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
/* icon box */
.icon-box{
  width:80px;height:80px;
  background:linear-gradient(135deg,#7c3aed,#5b21b6);
  border-radius:22px;
  display:flex;align-items:center;justify-content:center;
  margin:0 auto 22px;
  box-shadow:0 0 0 1px rgba(139,92,246,.3),0 0 40px rgba(109,40,217,.5);
  animation:icon-pulse 2.5s ease-in-out infinite;
  font-size:36px;font-weight:900;color:#fff;letter-spacing:-1px;
  user-select:none;
}
@keyframes icon-pulse{
  0%,100%{box-shadow:0 0 0 1px rgba(139,92,246,.3),0 0 35px rgba(109,40,217,.4)}
  50%{box-shadow:0 0 0 1px rgba(167,139,250,.6),0 0 65px rgba(109,40,217,.75)}
}
/* shimmer logo text */
.logo-text{
  font-size:40px;font-weight:900;letter-spacing:5px;
  background:linear-gradient(90deg,#7c3aed 0%,#a78bfa 30%,#ede9fe 50%,#a78bfa 70%,#7c3aed 100%);
  background-size:250% 100%;
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  animation:shimmer 2.2s linear infinite;
  margin-bottom:8px;
}
@keyframes shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}
.sub{
  font-size:11px;color:#4b5563;letter-spacing:3px;
  text-transform:uppercase;margin-bottom:38px;
}
/* progress */
.progress-wrap{
  width:100%;height:3px;background:#12121e;border-radius:2px;
  overflow:hidden;margin-bottom:18px;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.04);
}
.progress-bar{
  height:100%;width:0%;
  background:linear-gradient(90deg,#6d28d9,#a78bfa,#6d28d9);
  background-size:200% 100%;
  border-radius:2px;
  transition:width .6s cubic-bezier(.4,0,.2,1);
  animation:bar-shine 1.8s linear infinite;
  box-shadow:0 0 10px rgba(139,92,246,.7);
}
@keyframes bar-shine{0%{background-position:100% 0}100%{background-position:-100% 0}}
/* status */
.status{
  font-size:12px;color:#6b7280;letter-spacing:.5px;
  min-height:18px;
  transition:opacity .35s ease,transform .35s ease;
}
.status.hide{opacity:0;transform:translateY(5px)}
/* dots */
.dots{margin-top:32px;display:flex;justify-content:center;gap:8px}
.dot{
  width:5px;height:5px;border-radius:50%;
  background:#7c3aed;opacity:.25;
  animation:blink 1.4s ease-in-out infinite;
}
.dot:nth-child(2){animation-delay:.22s}
.dot:nth-child(3){animation-delay:.44s}
@keyframes blink{0%,80%,100%{opacity:.2;transform:scale(1)}40%{opacity:1;transform:scale(1.5)}}
/* version */
.ver{position:fixed;bottom:18px;right:22px;font-size:10px;color:#27272a;letter-spacing:1px}
</style></head>
<body>
<div class="glow"></div>
<div class="wrap">
  <div class="icon-box">N</div>
  <div class="logo-text">NOVIVO</div>
  <div class="sub">AI Content Planner</div>
  <div class="progress-wrap"><div class="progress-bar" id="bar"></div></div>
  <div class="status" id="status">Đang khởi động...</div>
  <div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
</div>
<div class="ver">v1.0.0</div>
<script>
const MESSAGES = [
  'Đang khởi động hệ thống...',
  'Nạp mô hình AI...',
  'Kết nối cơ sở dữ liệu...',
  'Tải kiến thức RAG engine...',
  'Khởi tạo các dịch vụ...',
  'Chuẩn bị giao diện...',
  'Sắp hoàn tất...',
];
const TOTAL_MS = 32000;
const TICK = 400;
const bar = document.getElementById('bar');
const statusEl = document.getElementById('status');
let elapsed = 0, msgIdx = 0;

function nextMsg() {
  statusEl.classList.add('hide');
  setTimeout(() => {
    msgIdx = Math.min(msgIdx + 1, MESSAGES.length - 1);
    statusEl.textContent = MESSAGES[msgIdx];
    statusEl.classList.remove('hide');
  }, 350);
}

const timer = setInterval(() => {
  elapsed += TICK;
  const r = elapsed / TOTAL_MS;
  // ease-out curve: slow approach to 93%
  const pct = Math.min(93, 100 * (1 - Math.pow(1 - r, 2.2)));
  bar.style.width = pct + '%';
  const step = Math.floor(elapsed / 4200);
  if (step > msgIdx && msgIdx < MESSAGES.length - 1) nextMsg();
  if (elapsed >= TOTAL_MS) clearInterval(timer);
}, TICK);
</script>
</body></html>`

function getSplashURL() {
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(SPLASH_HTML)
}

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
    await mainWindow.loadURL(getSplashURL())
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

