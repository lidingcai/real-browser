/*
window.electron = require('electron/renderer')

console.log('window in top ipc.ts=')
console.log(window)
window.ipcRenderer = window.electron.ipcRenderer
*/
import { ipcRenderer } from 'electron'

window.ipcRenderer = ipcRenderer
console.log('window in ipc.ts=')
console.log(window)
window.ipcRenderer.on('main-process-message', (_event, ...args) => {
  console.log('[Receive Main-process message]:', ...args)
})
