import { settings } from './settings/settings'

function enableDarkMode() {
  document.body.classList.add('dark-mode')
  window.isDarkMode = true
  requestAnimationFrame(() => {
    window.dispatchEvent(new CustomEvent('themechange'))
  })
}

function disableDarkMode() {
  document.body.classList.remove('dark-mode')
  window.isDarkMode = false
  requestAnimationFrame(() => {
    window.dispatchEvent(new CustomEvent('themechange'))
  })
}

export function initialize() {
  function themeChanged(value: boolean) {
    if (value === true) {
      enableDarkMode()
    } else {
      disableDarkMode()
    }
  }
  settings.listen('darkThemeIsActive', themeChanged)
}
