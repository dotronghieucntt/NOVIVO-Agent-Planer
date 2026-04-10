const { app, BrowserWindow, shell, Menu } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow
let backendProcess

function waitForBackend(url, retries = 40, delay = 500) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      http.get(url, (res) => {
        if (res.statusCode < 500) resolve()
        else retry()
      }).on('error', () => retry())
    }
    const retry = () => {
      if (--retries <= 0) return reject(new Error('Backend did not start'))
      setTimeout(attempt, delay)
    }
    attempt()
  })
}

function startBackend() {
  if (isDev) return

  const backendDir = path.join(process.resourcesPath, 'backend', 'novivo_backend')
  const exePath = path.join(backendDir, 'novivo_backend.exe')

  backendProcess = spawn(exePath, [], {
    cwd: backendDir,
    env: { ...process.env },
    stdio: 'ignore',
    detached: false,
  })

  backendProcess.on('error', (err) => {
    console.error('Backend process error:', err)
  })
}

function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, '../public/icon.ico')

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    frame: true,
    backgroundColor: '#0f0f13',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: iconPath,
    show: false,
    title: 'NOVIVO Agent Planer',
  })

  const url = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/index.html')}`

  mainWindow.loadURL(url)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)

  if (!isDev) {
    startBackend()
    try {
      await waitForBackend('http://127.0.0.1:8001/health', 60, 500)
    } catch {
      // Backend chậm khởi động, tiếp tục mở window
    }
  }

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

