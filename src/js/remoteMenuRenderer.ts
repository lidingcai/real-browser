/*
Passes a context menu template to the main process (where the menu is created)
and listens for click events on it.
*/
import { ipcRenderer as ipc } from 'electron'

const menuCallbacks = {} as Record<number, Record<number, Function>>

let nextMenuId: number = 0

export interface MenuItemType {
  label?: string
  role?: string
  click?: Function | number
  type?: string
  checked?: boolean
  submenu?: MenuItemType[]
  enabled?: boolean
}
type MenuTemplateType = MenuItemType[][]
export function open(menuTemplate: MenuTemplateType, x: number = 0, y: number = 0) {
  nextMenuId++
  menuCallbacks[nextMenuId] = {}
  let nextItemId: number = 0
  const prepareForMenu = (menuItem: MenuItemType) => {
    if (menuItem.submenu) {
      menuItem.submenu = prepareForArray(menuItem.submenu)
    }
    if (menuItem.click && typeof menuItem.click === 'function') {
      menuCallbacks[nextMenuId][nextItemId] = menuItem.click
      menuItem.click = nextItemId
      nextItemId++
    }
    return menuItem
  }
  const prepareForArray = (menuArray: MenuItemType[]) => {
    return menuArray.map((item) => prepareForMenu(item))
  }
  const prepareToSend = (menuPart: MenuTemplateType) => {
    return menuPart.map((item) => prepareForArray(item))
  }
  /*
  function prepareToSend(
    menuPart: MenuItemConstructorOptions[][] | MenuItemConstructorOptions[] | MenuItemConstructorOptions,
  ): MenuItemConstructorOptions[] | MenuItemConstructorOptions {
    if (menuPart instanceof Array) {
      return (menuPart as MenuItemConstructorOptions[]).map((item) => prepareToSend(item))
    }
    if (menuPart.submenu) {
      menuPart.submenu = prepareToSend(menuPart.submenu)
    }
    if (typeof menuPart.click === 'function') {
      menuCallbacks[nextMenuId][nextItemId] = menuPart.click
      menuPart.click = nextItemId
      nextItemId++
    }
    return menuPart
  }
  */

  ipc.send('open-context-menu', {
    id: nextMenuId,
    template: prepareToSend(menuTemplate),
    x,
    y,
  })
}

ipc.on('context-menu-item-selected', (e, data) => {
  menuCallbacks[data.menuId][data.itemId]()
})

ipc.on('context-menu-will-close', (e, data) => {
  // delay close event until after selected event has been received
  setTimeout(() => {
    delete menuCallbacks[data.menuId]
  }, 16)
})

// module.exports = { open }
