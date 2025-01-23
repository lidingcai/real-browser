// const webviews = require('webviews.js')
import { webviews } from '../webviews'

export const navigationButtons = {
  tabsList: null as null | HTMLDivElement,
  container: null as null | HTMLDivElement,
  backButton: null as null | HTMLButtonElement,
  forwardButton: null as null | HTMLButtonElement,
  update() {
    if (!(window.tabs.get(window.tabs.getSelected()!) as TabType).url) {
      navigationButtons.backButton!.disabled = true
      navigationButtons.forwardButton!.disabled = true
      return
    }
    webviews.callAsync(window.tabs.getSelected()!, 'canGoBack', (err: Error, canGoBack: boolean) => {
      if (err) {
        return
      }
      navigationButtons.backButton!.disabled = !canGoBack
    })
    webviews.callAsync(window.tabs.getSelected()!, 'canGoForward', (err: Error, canGoForward: boolean) => {
      if (err) {
        return
      }
      navigationButtons.forwardButton!.disabled = !canGoForward
      if (canGoForward) {
        navigationButtons.container!.classList.add('can-go-forward')
      } else {
        navigationButtons.container!.classList.remove('can-go-forward')
      }
    })
  },
  initialize() {
    navigationButtons.tabsList = document.getElementById('tabs-inner') as HTMLDivElement
    navigationButtons.container = document.getElementById('toolbar-navigation-buttons') as HTMLDivElement
    navigationButtons.backButton = document.getElementById('back-button') as HTMLButtonElement
    navigationButtons.forwardButton = document.getElementById('forward-button') as HTMLButtonElement
    navigationButtons.container.hidden = false

    navigationButtons.backButton.addEventListener('click', (_e) => {
      webviews.goBackIgnoringRedirects(window.tabs.getSelected()!)
    })

    navigationButtons.forwardButton.addEventListener('click', () => {
      webviews.callAsync(window.tabs.getSelected()!, 'goForward')
    })

    navigationButtons.container.addEventListener('mouseenter', () => {
      /*
      Prevent scrollbars from showing up when hovering the navigation buttons, if one isn't already shown
      This also works around a chromium bug where a flickering scrollbar is shown during the expanding animation:
      https://github.com/minbrowser/min/pull/1665#issuecomment-868551126
      */
      if (navigationButtons.tabsList!.scrollWidth <= navigationButtons.tabsList!.clientWidth) {
        navigationButtons.tabsList!.classList.add('disable-scroll')
      }
    })

    navigationButtons.container.addEventListener('mouseleave', () => {
      navigationButtons.tabsList!.classList.remove('disable-scroll')
    })

    window.tasks.on('tab-selected', this.update)
    webviews.bindEvent('did-navigate', this.update)
    webviews.bindEvent('did-navigate-in-page', this.update)
  },
}

// module.exports = navigationButtons
