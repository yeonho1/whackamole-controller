const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const url = require('url')
const { SerialPort, ReadlineParser } = require('serialport');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
const isPrototype = true

const [BUTTONS_PER_PL, MIN_FIRST, MAX_FIRST] =
    (isPrototype) ? [1, [1000], [1500]] : [4, [1000, 2500, 3500, 4500], [2000, 3000, 4000, 5000]]
const PHASE_MIN = [3000, 2500, 2000, 1500, 1000]
const PHASE_MAX = [5000, 4000, 3500, 3000, 2000]

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
let phase = Array(BUTTONS_PER_PL * 2).fill(0)
let handshakeTimeout

const randomInt = (min, max) => {
    return min + Math.floor(Math.random() * (max - min + 1))
}

const shuffle = (array) => {
    let currentIndex = array.length
    while (currentIndex > 0) {
        let randomIndex = randomInt(0, currentIndex - 1)
        currentIndex--
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]]
    }
    return array
}

const range = (start, end, step = 1) => {
    return Array(end - start + 1).fill().map((_, idx) => start + idx * step)
}

const sendSerial = (payload) => {
    while (!serialReady) {}
    console.log(payload)
    serialComm.write(JSON.stringify(payload) + '\n')
}

const resetGame = () => {
    gameStatus.blueScore = 0
    gameStatus.redScore = 0
    phase.fill(0)
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
    ledTimeouts[id] = setTimeout(() => {mole(id)}, randomInt(min, max))
}

const startGame = () => {
    if(!mainWindow) {
        return
    }
    mainWindow.webContents.send('startGame', '')
    gameStatus.ongoing = true
    resetGame()
    setTimeout(endGame, 30000);
    const blueShuffle = shuffle(range(0, BUTTONS_PER_PL - 1))
    const redShuffle = shuffle(range(BUTTONS_PER_PL, 2 * BUTTONS_PER_PL - 1))
    blueShuffle.forEach((led, idx) => {
        scheduleNextMole(led, MIN_FIRST[idx], MAX_FIRST[idx])
    });
    redShuffle.forEach((led, idx) => {
        scheduleNextMole(led, MIN_FIRST[idx], MAX_FIRST[idx])
    });
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
            scheduleNextMole(id, PHASE_MIN[phase[id]], PHASE_MAX[phase[id]])
            if (phase[id] < PHASE_MIN.length - 1) {
                phase[id]++
            }
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
    ipcMain.on('requestGameReset', (evt, p) => { resetGame() })
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
