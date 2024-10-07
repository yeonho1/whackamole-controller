let gameStatus

const { ipcRenderer } = require('electron');

ipcRenderer.on('replySelectedSerialPort', (evt, payload) => {
  document.getElementById('selected-port').textContent = payload || ""
})

ipcRenderer.send('getSelectedSerialPort', '')

const changeSerial = () => {
    ipcRenderer.send('viewSerialSelectScreen', '')
}

const serialHandshake = () => {
    ipcRenderer.send('serialHandshake', '')
}

const indicate = (team, bg, txt) => {
    document.getElementById(`${team}-head`).style.backgroundColor = bg
    document.getElementById(`${team}-head`).style.color = txt
    document.getElementById(`${team}-score`).style.backgroundColor = bg
    document.getElementById(`${team}-score`).style.color = txt
}

const startClick = () => {
    ipcRenderer.send('requestGameStart', '')
}

const endClick = () => {
    ipcRenderer.send('requestGameAbort', '')
}

const resetClick = () => {
    indicate('blue', '', '#000000')
    indicate('red', '', '#000000')
    ipcRenderer.send('requestGameReset', '')
}

ipcRenderer.on('replySerialHandshake', (evt, payload) => {
    // todo
})

ipcRenderer.on('startGame', (evt, p) => {
    document.getElementById('btn-start').disabled = true
    document.getElementById('btn-abort').disabled = false
    document.getElementById('btn-reset').disabled = true
    indicate('blue', '', '#000000')
    indicate('red', '', '#000000')
})

ipcRenderer.on('endGame', (evt, p) => {
    document.getElementById('btn-start').disabled = false
    document.getElementById('btn-abort').disabled = true
    document.getElementById('btn-reset').disabled = false
    if (gameStatus.blueScore >= gameStatus.redScore) {
        indicate('blue', '#006bff', '#ffffff')
    }
    if (gameStatus.redScore >= gameStatus.blueScore) {
        indicate('red', '#ff0000', '#ffffff')
    }
})

ipcRenderer.on('gameStatus', (evt, p) => {
    gameStatus = p
    if (gameStatus.blueScore) {
        document.getElementById('blue-score').textContent = gameStatus.blueScore
    }
    if (gameStatus.redScore) {
        document.getElementById('red-score').textContent = gameStatus.redScore
    }
})

serialHandshake();
