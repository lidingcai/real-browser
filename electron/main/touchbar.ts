import { nativeImage, TouchBar } from 'electron'

const { TouchBarButton, TouchBarSpacer } = TouchBar
import { l } from './i18n'
import { sendIPCToWindow } from './main'
import { windows } from './windowManagement'

export function buildTouchBar() {
  if (process.platform !== 'darwin') {
    return null
  }

  function getTouchBarIcon(name) {
    // the icons created by nativeImage are too big by default, shrink them to the correct size for the touchbar
    const image = nativeImage.createFromNamedImage(name, [-1, 0, 1])
    const size = image.getSize()
    return image.resize({
      width: Math.round(size.width * 0.65),
      height: Math.round(size.height * 0.65),
    })
  }
  return new TouchBar({
    items: [
      new TouchBarButton({
        accessibilityLabel: l('goBack'),
        icon: getTouchBarIcon('NSImageNameTouchBarGoBackTemplate'),
        click() {
          sendIPCToWindow(windows.getCurrent(), 'goBack')
        },
      }),
      new TouchBarButton({
        accessibilityLabel: l('goForward'),
        icon: getTouchBarIcon('NSImageNameTouchBarGoForwardTemplate'),
        click() {
          sendIPCToWindow(windows.getCurrent(), 'goForward')
        },
      }),
      new TouchBarSpacer({ size: 'flexible' }),
      new TouchBarButton({
        icon: getTouchBarIcon('NSImageNameTouchBarSearchTemplate'),
        iconPosition: 'left',
        // TODO this is really hacky, find a better way to set the size
        label: `    ${l('searchbarPlaceholder')}                     `,
        click() {
          sendIPCToWindow(windows.getCurrent(), 'openEditor')
        },
      }),
      new TouchBarSpacer({ size: 'flexible' }),
      new TouchBarButton({
        icon: getTouchBarIcon('NSImageNameTouchBarAdd'),
        accessibilityLabel: l('newTabAction'),
        click() {
          sendIPCToWindow(windows.getCurrent(), 'addTab')
        },
      }),
      new TouchBarButton({
        accessibilityLabel: l('viewTasks'),
        icon: getTouchBarIcon('NSImageNameTouchBarListViewTemplate'),
        click() {
          sendIPCToWindow(windows.getCurrent(), 'toggleTaskOverlay')
        },
      }),
    ],
  })
}
