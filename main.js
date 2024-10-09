const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const url = require('url')
const { SerialPort, ReadlineParser } = require('serialport');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
const BUTTONS_PER_PL = 1

let mainWindow
let selectedSerial
let serialComm
let serialReady = false
let gameStatus = {
    ongoing: false,
    blueScore: 0,
    redScore: 0
}
let ledStatus = Array(BUTTONS_PER_PL * 2).fill(false)
let ledTimeouts = Array(BUTTONS_PER_PL * 2).fill(undefined)
let team = Array(BUTTONS_PER_PL * 2).fill('blue', 0, BUTTONS_PER_PL).fill('red', BUTTONS_PER_PL)
let handshakeTimeout

const randomTime = (min, max) => {
    return min + Math.ceil(Math.random() * (max - min))
}

const sendSerial = (payload) => {
    while (!serialReady) {}
    console.log(payload)
    serialComm.write(JSON.stringify(payload) + '\n')
}

const resetGame = () => {
    gameStatus.blueScore = 0
    gameStatus.redScore = 0
    mainWindow.webContents.send('gameStatus', gameStatus)
}

const ledControl = (id, st) => {
    ledStatus[id] = st
    sendSerial({
        type: "LED",
        id,
        state: (st ? 1 : 0)
    })
}

const mole = (id) => {
    ledControl(id, true)
    ledTimeouts[id] = setTimeout(() => {
        ledControl(id, false)
        scheduleNextMole(id, 1000, 5000)
    }, 5000)
}

const scheduleNextMole = (id, min, max) => {
    if (ledTimeouts[id]) {
        clearTimeout(ledTimeouts[id])
    }
    ledTimeouts[id] = setTimeout(() => {mole(id)}, randomTime(min, max))
}

const startGame = () => {
    if(!mainWindow) {
        return
    }
    mainWindow.webContents.send('startGame', '')
    gameStatus.ongoing = true
    resetGame()
    setTimeout(endGame, 30000);
    for (let i = 0; i < ledTimeouts.length; i++) {
        ledControl(i, false)
        scheduleNextMole(i, 1000, 3000)
    }
}

const endGame = () => {
    if (!mainWindow) return
    gameStatus.ongoing = false
    mainWindow.webContents.send('gameStatus', gameStatus)
    mainWindow.webContents.send('endGame', '')
    for (let i = 0; i < ledTimeouts.length; i++) {
        ledControl(i, false)
        if (ledTimeouts[i]) {
            clearTimeout(ledTimeouts[i])
            ledTimeouts[i] = undefined
        }
    }
}

const handshake = () => {
    sendSerial({'type': 'HNDSHK'})
    handshakeTimeout = setTimeout(handshake, 2000)
}

const eventHandlers = {
    HNDSHK: (data) => {
        clearTimeout(handshakeTimeout)
        handshakeTimeout = undefined
        mainWindow.webContents.send('replySerialHandshake', data)
    },
    BTNPRS: (data) => {
        if (!gameStatus.ongoing) {
            return
        }
        const id = data["id"]
        if (ledStatus[id]) {
            gameStatus[`${team[id]}Score`]++
            mainWindow.webContents.send('gameStatus', gameStatus)
            ledControl(id, false)
            scheduleNextMole(id, 2000, 5000)
        }
    }
}

const handleSerial = (data) => {
    obj = JSON.parse(data)
    console.log(obj)
    if (obj.type && eventHandlers[obj.type]) {
        eventHandlers[obj.type](obj)
    }
}

const parser = new ReadlineParser()
parser.on('data', handleSerial)

const setupSerial = (path) => {
    serialComm = new SerialPort({ path, baudRate: 115200 })
    serialComm.pipe(parser)
    serialComm.on('open', () => {
        console.log('Serial ready')
        serialReady = true
    })
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
        selectedSerial = p
        setupSerial(p)
        loadScreen(evt.sender, 'game')
    })

    ipcMain.on('getSelectedSerialPort', (evt, p) => {
        evt.reply('replySelectedSerialPort', selectedSerial)
    })

    ipcMain.on('viewSerialSelectScreen', (evt, p) => {
        selectedSerial = undefined
        if (serialComm) {
            serialComm.close((err) => {
                console.log('Closing Serial')
                if (err) {
                    console.log(`Error while closing Serial: ${err}`)
                }
            })
        }
        serialReady = false
        serialComm = undefined
        loadScreen(evt.sender, 'port-select')
    })

    ipcMain.on('serialHandshake', (evt, p) => {
        if (handshakeTimeout) {
            clearTimeout(handshakeTimeout)
            handshakeTimeout = undefined
        }
        handshake()
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
