import { ipcRenderer as ipc } from 'electron'

let isFocusMode = false

ipc.on('enterFocusMode', () => {
  isFocusMode = true
  document.body.classList.add('is-focus-mode')
})

ipc.on('exitFocusMode', () => {
  isFocusMode = false
  document.body.classList.remove('is-focus-mode')
})

export default {
  enabled() {
    return isFocusMode
  },
  warn() {
    ipc.invoke('showFocusModeDialog2')
  },
}
