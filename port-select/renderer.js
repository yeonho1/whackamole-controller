const { ipcRenderer } = require('electron');

const createButtonHTML = (id, text) => {
  return `<button class="full" id="select-${id}" onclick="selectPort(${id})">${text}</button>`
}

let portList

const renderSerialPortList = () => {
  if (portList.length === 0) {
    document.getElementById('error').textContent = 'No ports discovered'
  }
  let tableHTML = ''
  portList.forEach((x, id) => {
    tableHTML += `<tr><td class="portpath">${x.path}</td><td class="center button">${createButtonHTML(id, '선택')}</td></tr>`
  })
  document.getElementById('ports-list').innerHTML = tableHTML
}

const selectPort = (id) => {
  document.getElementById("selected-port").innerHTML = portList[id].path || "오류: 잘못된 선택입니다."
  ipcRenderer.send('selectSerialPort', portList[id].path)
}

const requestSerialPortList = () => {
  ipcRenderer.send('getSerialPortList', '');
}

ipcRenderer.on('replySerialPortList', (evt, payload) => {
  if (payload.error) {
    document.getElementById('error').textContent = payload.error
  }
  portList = payload.ports || [];
  renderSerialPortList();
})

requestSerialPortList();
