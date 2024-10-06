const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const url = require('url')
const { SerialPort } = require('serialport');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
let selectedSerial

const loadScreen = (w, name) => {
    w.loadURL(url.format({
        pathname: path.join(__dirname, `${name}/index.html`),
        protocol: 'file:',
        slashes: true
    }))
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1500,
        height: 1100,
        backgroundColor: "#F2E5BF",
        webPreferences: {
            nodeIntegration: true, // to allow require
            contextIsolation: false, // allow use with Electron 12+
            preload: path.join(__dirname, 'preload.js')
        }
    })

    // and load the index.html of the app.
    loadScreen(mainWindow, 'port-select')

    // Open the DevTools.
    // mainWindow.webContents.openDevTools()

    // Emitted when the window is closed.
    mainWindow.on('closed', function() {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    createWindow()

    ipcMain.on('getSerialPortList', async (evt, p) => {
        const data = await SerialPort.list().then((ports, err) => {
            if (err) return {error: err.message}
            else return {ports}
        })
        evt.reply('replySerialPortList', data);
    })

    ipcMain.on('selectSerialPort', (evt, p) => {
        console.log(`Serial port selected: ${p}`);
        console.log(`sender: ${evt.sender}`)
        selectedSerial = p
        loadScreen(evt.sender, 'game')
    })

    ipcMain.on('getSelectedSerialPort', (evt, p) => {
        evt.reply('replySelectedSerialPort', selectedSerial)
    })

    ipcMain.on('viewSerialSelectScreen', (evt, p) => {
        loadScreen(evt.sender, 'port-select')
    })
})

// Quit when all windows are closed.
app.on('window-all-closed', function() {
    app.quit()
})

app.on('activate', function() {
    if (mainWindow === null) {
        createWindow()
    }
})
