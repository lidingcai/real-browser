/*
There are three possible ways that keybindings can be handled.
 Shortcuts that appear in the menubar are registered in main.js, and send IPC messages to the window (which are handled by menuRenderer.js)
 - If the browser UI is focused, shortcuts are handled by Mousetrap.
  - If a BrowserView is focused, shortcuts are handled by the before-input-event listener.
  */
import { Input } from 'electron'
// const Mousetrap = require('mousetrap')
import Mousetrap from 'mousetrap'

// const modalMode = require('modalMode.js')
import { modalMode } from './modalMode'
// const keyMapModule = require('util/keyMap.js')
import { userKeyMap } from './util/keyMap'
// const settings = require('util/settings/settings.js')
import { settings } from './util/settings/settings'
// const webviews = require('webviews.js')
import { webviews } from './webviews'

const keyMap = userKeyMap(settings.get('keyMap'))

const shortcutsList = [] as { combo: string; keys: string[]; fn: Function; keyUp: boolean }[]
const registeredMousetrapBindings: Record<string, boolean> = {}

/*
Determines whether a shortcut can actually run
single-letter shortcuts and shortcuts used for text editing can't run when an input is focused
*/
function checkShortcutCanRun(combo: string, cb: Function) {
  if (/^(shift)?\+?\w$/.test(combo) || combo === 'mod+left' || combo === 'mod+right') {
    webviews.callAsync(window.tabs.getSelected() as string, 'isFocused', (err: Error, isFocused: boolean) => {
      if (err || !(window.tabs.get(window.tabs.getSelected() as string) as TabType).url || !isFocused) {
        // check whether an input is focused in the browser UI
        if (document.activeElement!.tagName === 'INPUT' || document.activeElement!.tagName === 'TEXTAREA') {
          cb(false)
        } else {
          cb(true)
        }
      } else {
        // check whether an input is focused in the webview
        webviews.callAsync(
          window.tabs.getSelected() as string,
          'executeJavaScript',
          `
          document.activeElement.tagName === "INPUT"
          || document.activeElement.tagName === "TEXTAREA"
          || document.activeElement.tagName === "IFRAME"
          || (function () {
            var n = document.activeElement;
            while (n) {
              if (n.getAttribute && n.getAttribute("contenteditable")) {
                return true;
              }
              n = n.parentElement;
            }
            return false;
          })()
      `,
          (err: Error, isInputFocused: boolean) => {
            if (err) {
              console.warn(err)
              return
            }
            cb(isInputFocused === false)
          },
        )
      }
    })
  } else {
    cb(true)
  }
}

export function defineShortcut(
  keysOrKeyMapName: string | { keys: string },
  fn: Function,
  options: { keyUp: boolean } = { keyUp: false },
) {
  let binding: string | string[]
  if ((keysOrKeyMapName as { keys: string }).keys) {
    binding = (keysOrKeyMapName as { keys: string }).keys
  } else {
    binding = keyMap[keysOrKeyMapName as string]
  }

  if (typeof binding === 'string') {
    binding = [binding]
  }

  const shortcutCallback = (e: Event, combo: string) => {
    // Disable shortcuts for modal mode, unless this is the combo to close the modal
    if (modalMode.enabled() && combo !== 'esc') {
      return
    }

    checkShortcutCanRun(combo, (canRun: boolean) => {
      if (canRun) {
        fn(e, combo)
      }
    })
  }

  binding.forEach((keys: string) => {
    shortcutsList.push({
      combo: keys,
      keys: keys.split('+'),
      fn: shortcutCallback,
      keyUp: options.keyUp || false,
    })
    if (!registeredMousetrapBindings[keys + (options.keyUp ? '-keyup' : '')]) {
      // mousetrap only allows one listener for each key combination (+keyup variant)
      // so register a single listener, and have it call all the other listeners that we have
      Mousetrap.bind(
        keys,
        (e, combo) => {
          shortcutsList.forEach((shortcut) => {
            if (shortcut.combo === combo && (e.type === 'keyup') === shortcut.keyUp) {
              shortcut.fn(e, combo)
            }
          })
        },
        options.keyUp ? 'keyup' : undefined,
      )
      registeredMousetrapBindings[keys + (options.keyUp ? '-keyup' : '')] = true
    }
  })
}

let keyboardMap: KeyboardLayoutMap
;(navigator as unknown as NavigatorWithKeyBoard).keyboard.getLayoutMap().then((map) => {
  keyboardMap = map
})

export function initialize() {
  webviews.bindEvent('before-input-event', (_tabId: any, input: Input) => {
    let expectedKeys = 1
    // account for additional keys that aren't in the input.key property
    if (input.alt && input.key !== 'Alt') {
      expectedKeys++
    }
    if (input.shift && input.key !== 'Shift') {
      expectedKeys++
    }
    if (input.control && input.key !== 'Control') {
      expectedKeys++
    }
    if (input.meta && input.key !== 'Meta') {
      expectedKeys++
    }

    shortcutsList.forEach((shortcut) => {
      if ((shortcut.keyUp && input.type !== 'keyUp') || (!shortcut.keyUp && input.type !== 'keyDown')) {
        return
      }
      let matches = true
      let matchedKeys = 0
      shortcut.keys.forEach((key) => {
        if (
          !(
            key === input.key.toLowerCase() ||
            // we need this check because the alt key can change the typed key, causing input.key to be a special character instead of the base key
            // but input.code isn't layout aware, so we need to map it to the correct key for the layout
            (keyboardMap && key === keyboardMap.get(input.code as KeyMapCode)) ||
            (key === 'esc' && input.key === 'Escape') ||
            (key === 'left' && input.key === 'ArrowLeft') ||
            (key === 'right' && input.key === 'ArrowRight') ||
            (key === 'up' && input.key === 'ArrowUp') ||
            (key === 'down' && input.key === 'ArrowDown') ||
            (key === 'alt' && (input.alt || input.key === 'Alt')) ||
            (key === 'option' && (input.alt || input.key === 'Alt')) ||
            (key === 'shift' && (input.shift || input.key === 'Shift')) ||
            (key === 'ctrl' && (input.control || input.key === 'Control')) ||
            (key === 'mod' && window.platformType === 'mac' && (input.meta || input.key === 'Meta')) ||
            (key === 'mod' && window.platformType !== 'mac' && (input.control || input.key === 'Control'))
          )
        ) {
          matches = false
        } else {
          matchedKeys++
        }
      })

      if (matches && matchedKeys === expectedKeys) {
        shortcut.fn(null, shortcut.combo)
      }
    })
  })
}

// initialize()

// module.exports = { defineShortcut }
