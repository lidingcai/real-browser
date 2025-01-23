/* Simple input prompt. */

import { BrowserWindow, ipcMain as ipc } from 'electron'

import { __dirname } from './constants'
import { settings } from './settingsMain'
import { windows } from './windowManagement'

let promptAnswer
let promptOptions

export function createPrompt(options, callback) {
  promptOptions = options
  const { parent, width = 360, height = 140 } = options

  let promptWindow = new BrowserWindow({
    width,
    height,
    parent: parent != null ? parent : windows.getCurrent(),
    show: false,
    modal: true,
    alwaysOnTop: true,
    title: options.title,
    autoHideMenuBar: true,
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      sandbox: true,
      contextIsolation: true,
      preload: `${__dirname}/pages/prompt/prompt.js`,
    },
  })

  promptWindow.on('closed', () => {
    promptWindow = null
    callback(promptAnswer)
  })

  // Load the HTML dialog box
  promptWindow.loadURL('min://app/pages/prompt/index.html')
  promptWindow.once('ready-to-show', () => {
    promptWindow.show()
  })
}

export const initPrompt = () => {
  ipc.on('show-prompt', (options, callback) => {
    createPrompt(options, callback)
  })

  ipc.on('open-prompt', (event) => {
    event.returnValue = JSON.stringify({
      label: promptOptions.text,
      ok: promptOptions.ok,
      values: promptOptions.values,
      cancel: promptOptions.cancel,
      darkMode: settings.get('darkMode'),
    })
  })

  ipc.on('close-prompt', (event, data) => {
    promptAnswer = data
  })

  ipc.on('prompt', (event, data) => {
    createPrompt(data, (result) => {
      event.returnValue = result
    })
  })
}
