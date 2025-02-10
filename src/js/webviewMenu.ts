// const clipboard = electron.clipboard
import { clipboard, ipcRenderer as ipc } from 'electron'

import { l } from '../locales'
// const browserUI = require('browserUI.js')
import * as browserUI from './browserUI'
// const pageTranslations = require('pageTranslations.js')
import { pageTranslations } from './pageTranslations'
// const remoteMenu = require('remoteMenuRenderer.js')
import { MenuItemType, open } from './remoteMenuRenderer'
// const userscripts = require('userscripts.js')
import { userscripts } from './userscripts'
// const searchEngine = require('util/searchEngine.js')
import { searchEngine } from './util/searchEngine'
// const settings = require('util/settings/settings.js')
import { settings } from './util/settings/settings'
// const webviews = require('webviews.js')
import { webviews } from './webviews'

// const { tabs } = window
/*
interface ActionType {
  label?: string
  enabled?: boolean
  click?: Function
  type?: string
} */
interface DataType {
  x: number
  y: number
  misspelledWord: string
  dictionarySuggestions: string[]
  linkURL: string
  frameURL: string
  srcURL: string
  mediaType: string
  selectionText: string
  editFlags: { canPaste: boolean }
}
export const webviewMenu = {
  menuData: null as null | DataType,
  showMenu(data: DataType, extraData: { hasVideo: boolean }) {
    // data comes from a context-menu event
    const currentTab = window.tabs.get(window.tabs.getSelected()!) as TabType

    const menuSections: MenuItemType[][] = []

    const openInBackground = !settings.get('openTabsInForeground')

    /* Picture in Picture */

    if (extraData.hasVideo) {
      menuSections.push([
        {
          label: l('pictureInPicture'),
          click() {
            webviews.callAsync(window.tabs.getSelected()!, 'send', ['enterPictureInPicture', { x: data.x, y: data.y }])
          },
        },
      ])
    }

    /* Spellcheck */

    if (data.misspelledWord) {
      const suggestionEntries = data.dictionarySuggestions.slice(0, 3).map((suggestion: string) => {
        return {
          label: suggestion,
          click() {
            webviews.callAsync(window.tabs.getSelected()!, 'replaceMisspelling', suggestion)
          },
        }
      })

      // https://www.electronjs.org/docs/api/session#sesaddwordtospellcheckerdictionaryword
      // "This API will not work on non-persistent (in-memory) sessions"
      if (!currentTab.private) {
        suggestionEntries.push({
          label: l('addToDictionary'),
          click() {
            ipc.invoke('addWordToSpellCheckerDictionary', data.misspelledWord)
          },
        })
      }

      if (suggestionEntries.length > 0) {
        menuSections.push(suggestionEntries)
      }
    }

    /* links */

    let link: undefined | string = data.linkURL

    // show link items for embedded frames, but not the top-level page (which will also be listed as a frameURL)
    if (!link && data.frameURL && data.frameURL !== currentTab.url) {
      link = data.frameURL
    }

    if (link === 'about:srcdoc') {
      /* srcdoc is used in reader view, but it can't actually be opened anywhere outside of the reader page */
      link = undefined
    }

    const mediaURL = data.srcURL

    if (link) {
      const linkActions = [
        {
          label: link.length > 60 ? `${link.substring(0, 60)}...` : link,
          enabled: false,
        },
      ] as MenuItemType[]

      if (!currentTab.private) {
        linkActions.push({
          label: l('openInNewTab'),
          click() {
            browserUI.addTab(window.tabs.add({ url: link }), { enterEditMode: false, openInBackground })
          },
        })
      }

      linkActions.push({
        label: l('openInNewPrivateTab'),
        click() {
          browserUI.addTab(window.tabs.add({ url: link, private: true }), {
            enterEditMode: false,
            openInBackground,
          })
        },
      })

      linkActions.push({
        label: l('saveLinkAs'),
        click() {
          webviews.callAsync(window.tabs.getSelected()!, 'downloadURL', [link])
        },
      })

      menuSections.push(linkActions)
    } else if (mediaURL && data.mediaType === 'image') {
      /* images */
      /* we don't show the image actions if there are already link actions, because it makes the menu too long and because the image actions typically aren't very useful if the image is a link */

      const imageActions = [
        {
          label: mediaURL.length > 60 ? `${mediaURL.substring(0, 60)}...` : mediaURL,
          enabled: false,
        },
      ] as MenuItemType[]

      imageActions.push({
        label: l('viewImage'),
        click() {
          webviews.update(window.tabs.getSelected()!, mediaURL)
        },
      })

      if (!currentTab.private) {
        imageActions.push({
          label: l('openImageInNewTab'),
          click() {
            browserUI.addTab(window.tabs.add({ url: mediaURL }), { enterEditMode: false, openInBackground })
          },
        })
      }

      imageActions.push({
        label: l('openImageInNewPrivateTab'),
        click() {
          browserUI.addTab(window.tabs.add({ url: mediaURL, private: true }), {
            enterEditMode: false,
            openInBackground,
          })
        },
      })

      menuSections.push(imageActions)

      menuSections.push([
        {
          label: l('saveImageAs'),
          click() {
            webviews.callAsync(window.tabs.getSelected()!, 'downloadURL', [mediaURL])
          },
        },
      ])
    }

    /* selected text */

    const selection = data.selectionText

    if (selection) {
      const textActions = [
        {
          label: l('searchWith').replace('%s', searchEngine.getCurrent().name),
          click() {
            const newTab = window.tabs.add({
              url: searchEngine.getCurrent().searchURL.replace('%s', encodeURIComponent(selection)),
              private: currentTab.private,
            })
            browserUI.addTab(newTab, {
              enterEditMode: false,
              openInBackground: false,
            })
          },
        },
      ]
      menuSections.push(textActions)
    }

    const clipboardActions = []

    if (mediaURL && data.mediaType === 'image') {
      clipboardActions.push({
        label: l('copy'),
        click() {
          webviews.callAsync(window.tabs.getSelected()!, 'copyImageAt', [data.x, data.y])
        },
      })
    } else if (selection) {
      clipboardActions.push({
        label: l('copy'),
        click() {
          webviews.callAsync(window.tabs.getSelected()!, 'copy')
        },
      })
    }

    if (data.editFlags && data.editFlags.canPaste) {
      clipboardActions.push({
        label: l('paste'),
        click() {
          webviews.callAsync(window.tabs.getSelected()!, 'paste')
        },
      })
    }

    if (link || (mediaURL && !mediaURL.startsWith('blob:'))) {
      if (link && link.startsWith('mailto:')) {
        // eslint-disable-next-line no-useless-escape
        const ematch = link.match(/(?<=mailto:)[^\?]+/)
        if (ematch) {
          clipboardActions.push({
            label: l('copyEmailAddress'),
            click() {
              clipboard.writeText(ematch[0])
            },
          })
        }
      } else {
        clipboardActions.push({
          label: l('copyLink'),
          click() {
            clipboard.writeText(link || mediaURL)
          },
        })
      }
    }

    if (clipboardActions.length !== 0) {
      menuSections.push(clipboardActions)
    }

    const navigationActions = [
      {
        label: l('goBack'),
        click() {
          try {
            webviews.goBackIgnoringRedirects(window.tabs.getSelected()!)
          } catch (e) {
            //
          }
        },
      },
      {
        label: l('goForward'),
        click() {
          try {
            webviews.callAsync(window.tabs.getSelected()!, 'goForward')
          } catch (e) {
            //
          }
        },
      },
    ]

    menuSections.push(navigationActions)

    /* inspect element */
    menuSections.push([
      {
        label: l('inspectElement'),
        click() {
          webviews.callAsync(window.tabs.getSelected()!, 'inspectElement', [data.x || 0, data.y || 0])
        },
      },
    ])

    /* Userscripts */

    const contextMenuScripts = userscripts
      .getMatchingScripts((window.tabs.get(window.tabs.getSelected()!) as TabType).url!)
      .filter((script) => {
        if (script.options['run-at'] && script.options['run-at'].includes('context-menu')) {
          return true
        }
        return false
      })

    if (contextMenuScripts.length > 0) {
      const scriptActions = [
        {
          label: l('runUserscript'),
          enabled: false,
        },
      ] as MenuItemType[]
      contextMenuScripts.forEach((script) => {
        scriptActions.push({
          label: script.name,
          click() {
            userscripts.runScript(window.tabs.getSelected()!, script)
          },
        })
      })
      menuSections.push(scriptActions)
    }

    const translateMenu = {
      label: 'Translate Page (Beta)',
      submenu: [] as MenuItemType[],
    }

    const translateLangList = pageTranslations.getLanguageList()

    translateLangList[0].forEach((language) => {
      translateMenu.submenu.push({
        label: language.name,
        click() {
          pageTranslations.translateInto(window.tabs.getSelected()!, language.code)
        },
      })
    })

    if (translateLangList[1].length > 0) {
      translateMenu.submenu.push({
        type: 'separator',
      })
      translateLangList[1].forEach((language) => {
        translateMenu.submenu.push({
          label: language.name,
          click() {
            pageTranslations.translateInto(window.tabs.getSelected()!, language.code)
          },
        })
      })
    }

    translateMenu.submenu.push({
      type: 'separator',
    })

    translateMenu.submenu.push({
      label: 'Send Feedback',
      click() {
        browserUI.addTab(
          window.tabs.add({
            url: `https://github.com/minbrowser/min/issues/new?title=Translation%20feedback%20for%20${encodeURIComponent(
              (window.tabs.get(window.tabs.getSelected()!) as TabType).url!,
            )}`,
          }),
          { enterEditMode: false, openInBackground: false },
        )
      },
    })

    menuSections.push([translateMenu])

    // Electron's default menu position is sometimes wrong on Windows with a touchscreen
    // https://github.com/minbrowser/min/issues/903
    const offset = webviews.getViewBounds()
    open(menuSections, data.x + offset.x, data.y + offset.y)
  },
  initialize() {
    webviews.bindEvent('context-menu', (tabId: string, data: DataType) => {
      webviewMenu.menuData = data
      webviews.callAsync(window.tabs.getSelected()!, 'send', ['getContextMenuData', { x: data.x, y: data.y }])
    })
    webviews.bindIPC('contextMenuData', (tabId: string, args: { hasVideo: boolean }[]) => {
      webviewMenu.showMenu(webviewMenu.menuData!, args[0])
      webviewMenu.menuData = null
    })
  },
}

// module.exports = webviewMenu
