const { app, BrowserWindow, shell, Menu } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow
let backendProcess

function startBackend() {
  if (isDev) return  // In dev, run backend manually

  // Production: dùng PyInstaller exe (dist-backend/novivo_backend/novivo_backend.exe)
  const backendDir = path.join(process.resourcesPath, 'backend', 'novivo_backend')
  const exePath = path.join(backendDir, 'novivo_backend.exe')

  backendProcess = spawn(exePath, [], {
    cwd: backendDir,
    env: { ...process.env },
    stdio: 'ignore',
  })

  backendProcess.on('error', (err) => {
    console.error('Backend process error:', err)
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    frame: true,
    titleBarStyle: 'default',
    backgroundColor: '#0f0f13',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../public/icon.ico'),
    show: false,
  })

  const url = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/index.html')}`

  mainWindow.loadURL(url)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (isDev) mainWindow.webContents.openDevTools()
  })

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  startBackend()
  // Wait a moment for backend to start
  setTimeout(createWindow, isDev ? 0 : 2000)
})

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
