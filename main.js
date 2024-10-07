const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const url = require('url')
const { SerialPort } = require('serialport');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
let selectedSerial
let serialport
let gameStatus = {
    ongoing: false,
    blueScore: 0,
    redScore: 0
}
let ledStatus = [
    false, false, false, false,
    false, false, false, false
]
let ledTimeouts = [
    undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined
]

const resetGame = () => {
    gameStatus.blueScore = 0
    gameStatus.redScore = 0
    mainWindow.webContents.send('gameStatus', gameStatus)
}

const startGame = () => {
    if(!mainWindow) {
        return
    }
    mainWindow.webContents.send('startGame', '')
    gameStatus.ongoing = true
    resetGame()
    setTimeout(endGame, 30000);
    // TODO
}

const endGame = () => {
    if (!mainWindow) return
    mainWindow.webContents.send('endGame', '')
    for (let i = 0; i < ledTimeouts.length; i++) {
        ledControl(i, false)
        if (ledTimeouts[i]) {
            clearTimeout(ledTimeouts[i])
            ledTimeouts[i] = undefined
        }
    }
}

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
        // serialport = new SerialPort({
        //     path: p,
        //     baudRate: 115200
        // })
        loadScreen(evt.sender, 'game')
    })

    ipcMain.on('getSelectedSerialPort', (evt, p) => {
        evt.reply('replySelectedSerialPort', selectedSerial)
    })

    ipcMain.on('viewSerialSelectScreen', (evt, p) => {
        selectedSerial = undefined
        if (serialport) {
            serialport.close((err) => {
                console.log('Closing Serial')
                if (err) {
                    console.log(`Error while closing Serial: ${err}`)
                }
            })
        }
        serialport = undefined
        loadScreen(evt.sender, 'port-select')
    })

    ipcMain.on('serialHandshake', (evt, p) => {
        console.log(JSON.stringify({'type': 'HNDSHK'}))
    })

    ipcMain.on('requestGameStart', (evt, p) => { startGame() })
    ipcMain.on('requestGameAbort', (evt, p) => { endGame() })
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
