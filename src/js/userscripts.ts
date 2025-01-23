/* implements userscript support */

import fs from 'node:fs'
import path from 'node:path'

// var path = require('path')
// const chokidar = require('chokidar')
// import chokidar, { FSWatcher } from 'chokidar'
import electron from 'electron'

import { l } from '../locales'
// const tabEditor = require('navbar/tabEditor.js')
import { tabEditor } from './navbar/tabEditor'
// const bangsPlugin = require('searchbar/bangsPlugin.js')
import * as bangsPlugin from './searchbar/bangsPlugin'
// const searchbarPlugins = require('searchbar/searchbarPlugins.js')
import { searchbarPlugins } from './searchbar/searchbarPlugins'
// const statistics = require('js/statistics.js')
import { statistics } from './statistics'
// const settings = require('util/settings/settings.js')
import { settings } from './util/settings/settings'
// const urlParser = require('util/urlParser.js')
import { urlParser } from './util/urlParser'
// const webviews = require('webviews.js')
import { webviews } from './webviews'

function parseTampermonkeyFeatures(content: string) {
  const parsedFeatures: Record<string, string[]> = {}
  let foundFeatures = false

  const lines = content.split('\n')

  let isInFeatures = false
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '// ==UserScript==') {
      isInFeatures = true
      continue
    }
    if (lines[i].trim() === '// ==/UserScript==') {
      isInFeatures = false
      break
    }
    if (isInFeatures && lines[i].startsWith('//')) {
      foundFeatures = true
      const feature = lines[i].replace('//', '').trim()
      let featureName = feature.split(' ')[0]
      const featureValue = feature.replace(`${featureName} `, '').trim()
      featureName = featureName.replace('@', '')

      // special case: find the localized name for the current locale
      if (
        featureName.startsWith('name:') &&
        featureName.split(':')[1].substring(0, 2) === navigator.language.substring(0, 2)
      ) {
        featureName = 'name:local'
      }
      if (parsedFeatures[featureName]) {
        parsedFeatures[featureName].push(featureValue)
      } else {
        parsedFeatures[featureName] = [featureValue]
      }
    }
  }
  if (foundFeatures) {
    return parsedFeatures
  }
  return null
}

// checks if a URL matches a wildcard pattern
function urlMatchesPattern(url: string, pattern: string) {
  let idx = -1
  const parts = pattern.split('*')
  for (let i = 0; i < parts.length; i++) {
    idx = url.indexOf(parts[i], idx)
    if (idx === -1) {
      return false
    }
    idx += parts[i].length
  }
  return idx !== -1
}
interface ScriptType {
  options: Record<string, string[]>
  content: string
  name: string
}
export const userscripts = {
  scriptDir: path.join(window.globalArgs['user-data-path'], 'userscripts'),
  scripts: [] as ScriptType[], // {options: {}, content}
  // watcherInstance: null as null | FSWatcher,
  showDirectory() {
    electron.shell.openPath(userscripts.scriptDir)
  },
  ensureDirectoryExists() {
    fs.access(userscripts.scriptDir, fs.constants.R_OK, (err) => {
      if (err) {
        fs.mkdir(userscripts.scriptDir, (err) => {
          if (err) {
            console.warn('failed to create userscripts directory', err)
          }
        })
      }
    })
  },
  loadScripts() {
    userscripts.scripts = []

    fs.readdir(userscripts.scriptDir, (err, files) => {
      if (err) {
        userscripts.ensureDirectoryExists()
        return
      }
      if (files.length === 0) {
        return
      }

      // store the scripts in memory
      files.forEach((filename) => {
        if (filename.endsWith('.js')) {
          fs.readFile(path.join(userscripts.scriptDir, filename), 'utf-8', (err, file) => {
            if (err || !file) {
              return
            }

            let domain = filename.slice(0, -3)
            if (domain.startsWith('www.')) {
              domain = domain.slice(4)
            }
            if (!domain) {
              return
            }

            const tampermonkeyFeatures = parseTampermonkeyFeatures(file)
            if (tampermonkeyFeatures) {
              let scriptName: string | string[] = tampermonkeyFeatures['name:local'] || tampermonkeyFeatures.name
              if (scriptName) {
                // eslint-disable-next-line prefer-destructuring
                scriptName = scriptName[0]
              } else {
                scriptName = filename
              }
              userscripts.scripts.push({ options: tampermonkeyFeatures, content: file, name: scriptName })
            } else {
              // legacy script
              // eslint-disable-next-line no-lonely-if
              if (domain === 'global') {
                userscripts.scripts.push({
                  options: {
                    match: ['*'],
                  },
                  content: file,
                  name: filename,
                })
              } else {
                userscripts.scripts.push({
                  options: {
                    match: [`*://${domain}`],
                  },
                  content: file,
                  name: filename,
                })
              }
            }
          })
        }
      })
    })
  },
  startDirWatcher() {
    userscripts.stopDirWatcher() // destroy any previous instance
    /*
    userscripts.watcherInstance = chokidar.watch(userscripts.scriptDir, {
      ignoreInitial: true,
      disableGlobbing: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    })
    userscripts.watcherInstance.on(
      'all',
      window.debounce(() => {
        userscripts.loadScripts()
      }, 100),
    )
    */
  },
  stopDirWatcher() {
    /*
    if (userscripts.watcherInstance) {
      userscripts.watcherInstance.close()
      userscripts.watcherInstance = null
    }
    */
  },
  getMatchingScripts(src: string) {
    return userscripts.scripts.filter((script) => {
      if (
        (!script.options.match && !script.options.include) ||
        (script.options.match && script.options.match.some((pattern) => urlMatchesPattern(src, pattern))) ||
        (script.options.include && script.options.include.some((pattern) => urlMatchesPattern(src, pattern)))
      ) {
        if (!script.options.exclude || !script.options.exclude.some((pattern) => urlMatchesPattern(src, pattern))) {
          return true
        }
      }
      return false
    })
  },
  runScript(tabId: string, script: ScriptType) {
    if (urlParser.isInternalURL((window.tabs.get(tabId) as TabType).url!)) {
      return
    }
    webviews.callAsync(tabId, 'executeJavaScript', [script.content, false, null])
  },
  onPageLoad(tabId: string) {
    if (userscripts.scripts.length === 0) {
      return
    }

    const src = (window.tabs.get(tabId) as TabType).url!

    userscripts.getMatchingScripts(src).forEach((script) => {
      // TODO run different types of scripts at the correct time
      if (
        !script.options['run-at'] ||
        script.options['run-at'].some((i) =>
          ['document-start', 'document-body', 'document-end', 'document-idle'].includes(i),
        )
      ) {
        userscripts.runScript(tabId, script)
      }
    })
  },
  initialize() {
    statistics.registerGetter('userscriptCount', () => {
      return userscripts.scripts.length
    })

    settings.listen('userscriptsEnabled', (value: boolean) => {
      if (value === true) {
        userscripts.loadScripts()
        userscripts.startDirWatcher()
      } else {
        userscripts.scripts = []
        userscripts.stopDirWatcher()
      }
    })
    webviews.bindEvent('dom-ready', userscripts.onPageLoad)

    webviews.bindIPC('showUserscriptDirectory', () => {
      userscripts.showDirectory()
    })

    bangsPlugin.registerCustomBang({
      phrase: '!run',
      snippet: l('runUserscript'),
      isAction: false,
      showSuggestions(text: string, _input: HTMLInputElement, _event: Event) {
        searchbarPlugins.reset('bangs')

        let isFirst = true
        userscripts.scripts.forEach((script) => {
          if (script.name.toLowerCase().startsWith(text.toLowerCase())) {
            searchbarPlugins.addResult('bangs', {
              title: script.name,
              fakeFocus: isFirst && !!text,
              click() {
                tabEditor.hide()
                userscripts.runScript(window.tabs.getSelected()!, script)
              },
            })
            isFirst = false
          }
        })
      },
      fn(text: string) {
        if (!text) {
          return
        }
        const matchingScript = userscripts.scripts.find((script) =>
          script.name.toLowerCase().startsWith(text.toLowerCase()),
        )
        if (matchingScript) {
          userscripts.runScript(window.tabs.getSelected()!, matchingScript)
        }
      },
    })
  },
}

// module.exports = userscripts
