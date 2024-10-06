const { ipcRenderer } = require('electron');

ipcRenderer.on('replySelectedSerialPort', (evt, payload) => {
  document.getElementById('selected-port').textContent = payload || ""
})

ipcRenderer.send('getSelectedSerialPort', '')

const changeSerial = () => {
    ipcRenderer.send('viewSerialSelectScreen', '')
}
