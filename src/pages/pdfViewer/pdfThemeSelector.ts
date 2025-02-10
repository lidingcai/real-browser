import { settings } from '../../js/util/settings/settings'

const settingsButton = document.getElementById('settings-button') as HTMLButtonElement
const settingsDropdown = document.getElementById('settings-dropdown') as HTMLSelectElement
const invertSection = document.getElementById('invert-pdf-section') as HTMLDivElement
const invertCheckbox = document.getElementById('invert-pdf-checkbox') as HTMLInputElement

settingsButton.addEventListener('click', function () {
  settingsDropdown.hidden = !settingsDropdown.hidden
  if (settingsDropdown.hidden) {
    settingsButton.classList.remove('force-visible')
  } else {
    settingsButton.classList.add('force-visible')
  }
})

document.addEventListener('click', function (e) {
  if (!settingsDropdown.contains(e.target as Node) && e.target !== settingsButton) {
    settingsDropdown.hidden = true
    settingsButton.classList.remove('force-visible')
  }
})

// Most of this is similar to readerThemeSelector

const metaThemeElement = document.getElementById('meta-theme') as HTMLMetaElement

const themeSelectors = document.querySelectorAll('.theme-circle')

const metaThemeValues:Record<string,string> = {
  light: '#fff',
  dark: 'rgb(36, 41, 47)',
  sepia: 'rgb(247, 231, 199)',
}

function isNight() {
  const hours = new Date().getHours()
  return hours > 21 || hours < 6
}

themeSelectors.forEach(function (el) {
  el.addEventListener('click',  () => {
    const theme = el.getAttribute('data-theme') as string
    if (isNight()) {
      settings.set('pdfNightTheme', theme)
    } else {
      settings.set('pdfDayTheme', theme)
    }
    setViewerTheme(theme)
  })
})

function setViewerTheme(theme: string) {
  themeSelectors.forEach(function (el) {
    if (el.getAttribute('data-theme') === theme) {
      el.classList.add('selected')
    } else {
      el.classList.remove('selected')
    }
  })

  metaThemeElement.content = metaThemeValues[theme]

  document.body.setAttribute('theme', theme)

  invertSection.hidden = !(theme === 'dark')

  setTimeout(function () {
    document.body.classList.add('theme-loaded')
  }, 16)
}

function initializeViewerTheme() {
  settings.listen('darkMode', function (globalDarkModeEnabled:boolean) {
    settings.listen('pdfDayTheme', function (pdfDayTheme: string) {
      settings.listen('pdfNightTheme', function (pdfNightTheme: string) {
        if (isNight() && pdfNightTheme) {
          setViewerTheme(pdfNightTheme)
        } else if (!isNight() && pdfDayTheme) {
          setViewerTheme(pdfDayTheme)
        } else if (globalDarkModeEnabled === true || isNight()) {
          setViewerTheme('dark')
        } else {
          setViewerTheme('light')
        }
      })
    })
  })
}

initializeViewerTheme()

settings.listen('PDFInvertColors', function (value: boolean) {
  invertCheckbox.checked = value === true
  document.body.setAttribute('data-invert', (value || false).toString())
})

invertCheckbox.addEventListener('click', function (e) {
  settings.set('PDFInvertColors', this.checked)
  document.body.setAttribute('data-invert', this.checked.toString())
})
