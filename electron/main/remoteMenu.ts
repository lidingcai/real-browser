import { ipcMain as ipc, Menu, MenuItem } from 'electron'

export const initRemoteMenu = () => {
  ipc.on(
    'open-context-menu',
    (e, data: { template: Electron.MenuItemConstructorOptions[][]; id: string; x: number; y: number }) => {
      const menu = new Menu()

      data.template.forEach((section: Electron.MenuItemConstructorOptions[]) => {
        section.forEach((item: Electron.MenuItemConstructorOptions) => {
          const id = item.click
          item.click = () => {
            e.sender.send('context-menu-item-selected', { menuId: data.id, itemId: id })
          }
          if (item.submenu) {
            for (let i = 0; i < (item.submenu as Electron.MenuItemConstructorOptions[]).length; i++) {
              ;((id) => {
                item.submenu[i].click = () => {
                  e.sender.send('context-menu-item-selected', { menuId: data.id, itemId: id })
                }
              })(item.submenu[i].click)
            }
          }
          menu.append(new MenuItem(item))
        })
        menu.append(new MenuItem({ type: 'separator' }))
      })
      menu.on('menu-will-close', () => {
        e.sender.send('context-menu-will-close', { menuId: data.id })
      })
      menu.popup({ x: data.x, y: data.y })
    },
  )
}
