// const remoteMenu = require('remoteMenuRenderer.js')
import { clipboard } from 'electron'

import { l } from '../locales'
import * as remoteMenu from './remoteMenuRenderer'
// const searchbar = require('searchbar/searchbar.js')
import { searchbar } from './searchbar/searchbar'
// module.exports = {
export const initialize = () => {
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    e.stopPropagation()

    const inputMenu: { label: string; role?: string; click?: Function }[][] = [
      [
        {
          label: l('undo'),
          role: 'undo',
        },
        {
          label: l('redo'),
          role: 'redo',
        },
      ],
      [
        {
          label: l('cut'),
          role: 'cut',
        },
        {
          label: l('copy'),
          role: 'copy',
        },
        {
          label: l('paste'),
          role: 'paste',
        },
      ],
      [
        {
          label: l('selectAll'),
          role: 'selectall',
        },
      ],
    ]

    let node = e.target as HTMLElement

    while (node) {
      if (node.nodeName.match(/^(input|textarea)$/i) || node.isContentEditable) {
        if (node.id === 'tab-editor-input') {
          inputMenu[1].push({
            label: l('pasteAndGo'),
            click() {
              searchbar.openURL(clipboard.readText())
            },
          })
        }
        remoteMenu.open(inputMenu)
        break
      }
      node = node.parentNode as HTMLElement
    }
  })
}
// }
