// var webviews = require('webviews.js')
// var settings = require('util/settings/settings.js')
import { settings } from '../util/settings/settings'
import { webviews } from '../webviews'

const colorExtractorImage = document.createElement('img')
colorExtractorImage.crossOrigin = 'anonymous'
const colorExtractorCanvas = document.createElement('canvas')
const colorExtractorContext = colorExtractorCanvas.getContext('2d')!

import { runNetwork } from './textColor'

const textColorNN = runNetwork

const defaultColors = {
  private: ['rgb(58, 44, 99)', 'white'],
  lightMode: ['rgb(255, 255, 255)', 'black'],
  darkMode: ['rgb(33, 37, 43)', 'white'],
}

function getHours() {
  const date = new Date()
  return date.getHours() + date.getMinutes() / 60
}

let hours = getHours()

// we cache the hours so we don't have to query every time we change the color
setInterval(
  () => {
    hours = getHours()
  },
  5 * 60 * 1000,
)

function getColorFromImage(_image: HTMLImageElement) {
  const w = colorExtractorImage.width
  const h = colorExtractorImage.height
  colorExtractorCanvas.width = w
  colorExtractorCanvas.height = h

  const offset = Math.max(1, Math.round(0.00032 * w * h))

  colorExtractorContext.drawImage(colorExtractorImage, 0, 0, w, h)

  const { data } = colorExtractorContext.getImageData(0, 0, w, h)

  const pixels = {} as Record<string, number>

  let d: string
  let add: number
  let sum: number

  for (let i = 0; i < data.length; i += 4 * offset) {
    d = `${Math.round(data[i] / 5) * 5},${Math.round(data[i + 1] / 5) * 5},${Math.round(data[i + 2] / 5) * 5}`

    add = 1
    sum = data[i] + data[i + 1] + data[i + 2]

    // very dark or light pixels shouldn't be counted as heavily
    if (sum < 310) {
      add = 0.35
    }

    if (sum < 50) {
      add = 0.01
    }

    if (data[i] > 210 || data[i + 1] > 210 || data[i + 2] > 210) {
      add = 0.5 - 0.0001 * sum
    }

    if (pixels[d]) {
      // eslint-disable-next-line operator-assignment
      pixels[d] = pixels[d] + add
    } else {
      pixels[d] = add
    }
  }

  // find the largest pixel set
  let largestPixelSet = null
  let ct = 0

  for (const k in pixels) {
    if (k === '255,255,255' || k === '0,0,0') {
      pixels[k] *= 0.05
    }
    if (pixels[k] > ct) {
      largestPixelSet = k
      ct = pixels[k]
    }
  }

  const res: (string | number)[] = largestPixelSet!.split(',')

  for (let i = 0; i < res.length; i++) {
    res[i] = parseInt(res[i] as string, 10)
  }

  return res as number[]
}

function getColorFromString(str: string) {
  colorExtractorContext.clearRect(0, 0, 1, 1)
  colorExtractorContext.fillStyle = str
  colorExtractorContext.fillRect(0, 0, 1, 1)
  const rgb = Array.from(colorExtractorContext.getImageData(0, 0, 1, 1).data).slice(0, 3)

  return rgb
}

function getRGBString(c: number[]) {
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

function getTextColor(bgColor: number[]) {
  const obj = {
    r: bgColor[0] / 255,
    g: bgColor[1] / 255,
    b: bgColor[2] / 255,
  }
  const output = textColorNN(obj)
  if (output.black > 0.5) {
    return 'black'
  }
  return 'white'
}

function isLowContrast(color: number[]) {
  // is this a color that won't change very much when lightened or darkened?
  // TODO is lowContrast the best name for this?
  return color.filter((i) => i > 235 || i < 15).length === 3
}

function adjustColorForTheme(color: number[]) {
  // dim the colors late at night or early in the morning if automatic dark mode is enabled
  const darkMode = settings.get('darkMode')
  const isAuto = darkMode === undefined || darkMode === true || darkMode >= 0

  let colorChange = 1
  if (isAuto) {
    if (hours > 20) {
      colorChange = 1.01 / (1 + 0.9 * Math.E ** (1.5 * (hours - 22.75)))
    } else if (hours < 6.5) {
      colorChange = 1.04 / (1 + 0.9 * Math.E ** (-2 * (hours - 5)))
    }
  }

  if (window.isDarkMode) {
    colorChange = Math.min(colorChange, 0.6)
  }

  return [Math.round(color[0] * colorChange), Math.round(color[1] * colorChange), Math.round(color[2] * colorChange)]
}

// https://stackoverflow.com/a/596243
function getLuminance(c: number[]) {
  return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
}

function setColor(bg: string, fg: string, isLowContrast: boolean = false) {
  document.body.style.setProperty('--theme-background-color', bg)
  document.body.style.setProperty('--theme-foreground-color', fg)

  const backgroundElements = document.getElementsByClassName('theme-background-color')
  const textElements = document.getElementsByClassName('theme-text-color')

  for (let i = 0; i < backgroundElements.length; i++) {
    ;(backgroundElements[i] as HTMLElement).style.backgroundColor = bg
  }

  for (let i = 0; i < textElements.length; i++) {
    ;(textElements[i] as HTMLElement).style.color = fg
  }

  if (fg === 'white') {
    document.body.classList.add('dark-theme')
  } else {
    document.body.classList.remove('dark-theme')
  }
  if (isLowContrast) {
    document.body.classList.add('theme-background-low-contrast')
  } else {
    document.body.classList.remove('theme-background-low-contrast')
  }
}

export const tabColor = {
  useSiteTheme: true,
  initialize() {
    webviews.bindEvent('page-favicon-updated', (tabId: string, favicons: string[]) => {
      tabColor.updateFromImage(favicons, tabId, () => {
        if (tabId === window.tabs.getSelected()) {
          tabColor.updateColors()
        }
      })
    })

    webviews.bindEvent('did-change-theme-color', (tabId: string, color: string) => {
      tabColor.updateFromThemeColor(color, tabId)
      if (tabId === window.tabs.getSelected()) {
        tabColor.updateColors()
      }
    })

    /*
    Reset the icon color when the page changes, so that if the new page has no icon it won't inherit the old one
    But don't actually render anything here because the new icon won't have been received yet
    and we want to go from old color > new color, rather than old color > default > new color
     */
    webviews.bindEvent(
      'did-start-navigation',
      (
        tabId: string,
        _url: any,
        _isInPlace: boolean,
        isMainFrame: boolean,
        _frameProcessId: any,
        _frameRoutingId: any,
      ) => {
        if (isMainFrame) {
          window.tabs.update(tabId, {
            backgroundColor: '',
            favicon: '',
          })
        }
      },
    )

    /*
    Always rerender once the page has finished loading
    this is needed to go back to default colors in case this page doesn't specify one
     */
    webviews.bindEvent('did-finish-load', (_tabId: any) => {
      tabColor.updateColors()
    })

    // theme changes can affect the tab colors
    window.addEventListener('themechange', (_e) => {
      tabColor.updateColors()
    })

    settings.listen('siteTheme', (value: boolean | undefined = undefined) => {
      if (value !== undefined) {
        tabColor.useSiteTheme = value
      }
    })

    window.tasks.on('tab-selected', this.updateColors)
  },
  updateFromThemeColor(color: string, tabId: string) {
    if (!color) {
      window.tabs.update(tabId, {
        themeColor: null,
      })
      return
    }

    const rgb = getColorFromString(color)
    const rgbAdjusted = adjustColorForTheme(rgb)

    window.tabs.update(tabId, {
      themeColor: {
        color: getRGBString(rgbAdjusted),
        textColor: getTextColor(rgbAdjusted),
        isLowContrast: isLowContrast(rgbAdjusted),
      },
    })
  },
  updateFromImage(favicons: string[], tabId: string, callback: Function) {
    // private tabs always use a special color, we don't need to get the icon
    if ((window.tabs.get(tabId) as TabType).private === true) {
      return
    }

    requestIdleCallback(
      () => {
        colorExtractorImage.onload = (_e) => {
          const backgroundColor = getColorFromImage(colorExtractorImage)
          const backgroundColorAdjusted = adjustColorForTheme(backgroundColor)

          window.tabs.update(tabId, {
            backgroundColor: {
              color: getRGBString(backgroundColorAdjusted),
              textColor: getTextColor(backgroundColorAdjusted),
              isLowContrast: isLowContrast(backgroundColorAdjusted),
            },
            favicon: {
              url: favicons[0],
              luminance: getLuminance(backgroundColor),
            },
          })

          if (callback) {
            callback()
          }
        }
        // eslint-disable-next-line prefer-destructuring
        colorExtractorImage.src = favicons[0]
      },
      {
        timeout: 1000,
      },
    )
  },
  updateColors() {
    const tab = window.tabs.get(window.tabs.getSelected() as string) as TabType

    // private tabs have their own color scheme
    if (tab.private) {
      return setColor(defaultColors.private[0], defaultColors.private[1])
    }

    if (tabColor.useSiteTheme) {
      // use the theme color
      if (tab.themeColor && tab.themeColor.color) {
        return setColor(tab.themeColor.color, tab.themeColor.textColor, tab.themeColor.isLowContrast)
      }

      // use the colors extracted from the page icon
      if (tab.backgroundColor && (tab.backgroundColor as contrastColorType).color) {
        return setColor(
          (tab.backgroundColor as contrastColorType).color,
          (tab.backgroundColor as contrastColorType).textColor,
          (tab.backgroundColor as contrastColorType).isLowContrast,
        )
      }
    }

    // otherwise use the default colors
    if (window.isDarkMode) {
      return setColor(defaultColors.darkMode[0], defaultColors.darkMode[1])
    }
    return setColor(defaultColors.lightMode[0], defaultColors.lightMode[1])
  },
}

// module.exports = tabColor
