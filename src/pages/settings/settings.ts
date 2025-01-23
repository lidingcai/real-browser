import { l } from '../../locales'
import { settings } from '../settingsContent'
import { userKeyMap } from './keyMap'
import { passwordManagers } from './passwordManager'
import { searchEngine, searchEngines } from './searchEngine'

export const initialize = () => {
  document.title = `${l('settingsPreferencesHeading')} | Min`

  const contentTypeBlockingContainer = document.getElementById('content-type-blocking')!
  const banner = document.getElementById('restart-required-banner')!
  const siteThemeCheckbox = document.getElementById('checkbox-site-theme') as HTMLInputElement
  const showDividerCheckbox = document.getElementById('checkbox-show-divider') as HTMLInputElement
  const userscriptsCheckbox = document.getElementById('checkbox-userscripts') as HTMLInputElement
  const userscriptsShowDirectorySection = document.getElementById('userscripts-show-directory')!
  const separateTitlebarCheckbox = document.getElementById('checkbox-separate-titlebar') as HTMLInputElement
  const openTabsInForegroundCheckbox = document.getElementById('checkbox-open-tabs-in-foreground') as HTMLInputElement
  const autoPlayCheckbox = document.getElementById('checkbox-enable-autoplay') as HTMLInputElement
  const userAgentCheckbox = document.getElementById('checkbox-user-agent') as HTMLInputElement
  const userAgentInput = document.getElementById('input-user-agent') as HTMLInputElement

  function showRestartRequiredBanner() {
    banner.hidden = false
    settings.set('restartNow', true)
  }
  settings.get('restartNow', (value: boolean) => {
    if (value === true) {
      showRestartRequiredBanner()
    }
  })

  /* content blocking settings */

  const trackingLevelContainer = document.getElementById('tracking-level-container')!
  const trackingLevelOptions = Array.from(
    trackingLevelContainer.querySelectorAll('input[name=blockingLevel]'),
  )! as HTMLInputElement[]
  const blockingExceptionsContainer = document.getElementById('content-blocking-information')!
  const blockingExceptionsInput = document.getElementById('content-blocking-exceptions') as HTMLInputElement
  const blockedRequestCount = document.querySelector('#content-blocking-blocked-requests strong')!

  settings.listen('filteringBlockedCount', (value: number) => {
    const count = value || 0
    let valueStr
    if (count > 50000) {
      valueStr = new Intl.NumberFormat(navigator.locale, { notation: 'compact', maximumSignificantDigits: 4 }).format(
        count,
      )
    } else {
      valueStr = new Intl.NumberFormat().format(count)
    }
    blockedRequestCount.textContent = valueStr
  })

  function updateBlockingLevelUI(level: number) {
    const radio = trackingLevelOptions[level]
    radio.checked = true

    if (level === 0) {
      blockingExceptionsContainer.hidden = true
    } else {
      blockingExceptionsContainer.hidden = false
      radio.parentNode!.appendChild(blockingExceptionsContainer)
    }

    if (document.querySelector('#tracking-level-container .setting-option.selected')) {
      document.querySelector('#tracking-level-container .setting-option.selected')!.classList.remove('selected')
    }
    ;(radio.parentNode as HTMLElement)!.classList.add('selected')
  }

  function changeBlockingLevelSetting(level: number) {
    settings.get('filtering', (value: { blockingLevel?: any }) => {
      if (!value) {
        value = {}
      }
      value.blockingLevel = level
      settings.set('filtering', value)
      updateBlockingLevelUI(level)
    })
  }

  function setExceptionInputSize() {
    blockingExceptionsInput.style.height = `${blockingExceptionsInput.scrollHeight + 2}px`
  }

  settings.get(
    'filtering',
    (value: { trackers?: boolean; blockingLevel: number | undefined; exceptionDomains: any[] }) => {
      // migrate from old settings (<v1.9.0)
      if (value && typeof value.trackers === 'boolean') {
        if (value.trackers === true) {
          value.blockingLevel = 2
        } else if (value.trackers === false) {
          value.blockingLevel = 0
        }
        delete value.trackers
        settings.set('filtering', value)
      }

      if (value && value.blockingLevel !== undefined) {
        updateBlockingLevelUI(value.blockingLevel)
      } else {
        updateBlockingLevelUI(1)
      }

      if (value && value.exceptionDomains && value.exceptionDomains.length > 0) {
        blockingExceptionsInput.value = `${value.exceptionDomains.join(', ')}, `
        setExceptionInputSize()
      }
    },
  )

  trackingLevelOptions.forEach((item, idx) => {
    item.addEventListener('change', () => {
      changeBlockingLevelSetting(idx)
    })
  })

  // eslint-disable-next-line func-names
  blockingExceptionsInput.addEventListener('input', function () {
    setExceptionInputSize()

    // remove protocols because of https://github.com/minbrowser/min/issues/1428
    const newValue = this.value
      .split(',')
      .map((i) => i.trim().replace('http://', '').replace('https://', ''))
      .filter((i) => !!i)

    settings.get('filtering', (value: { exceptionDomains?: any }) => {
      if (!value) {
        value = {}
      }
      value.exceptionDomains = newValue
      settings.set('filtering', value)
    })
  })

  /* content type settings */

  const contentTypes = {
    // humanReadableName: contentType
    scripts: 'script',
    images: 'image',
  }

  // used for showing localized strings
  const contentTypeSettingNames = {
    scripts: 'settingsBlockScriptsToggle',
    images: 'settingsBlockImagesToggle',
  }

  for (const contentType in contentTypes) {
    ;((contentType: keyof typeof contentTypes) => {
      settings.get('filtering', (value: { contentTypes: string | string[] }) => {
        // create the settings section for blocking each content type

        const section = document.createElement('div')
        section.classList.add('setting-section')

        const id = `checkbox-block-${contentTypes[contentType]}`

        const checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.id = id

        if (value && value.contentTypes) {
          checkbox.checked = value.contentTypes.indexOf(contentTypes[contentType]) !== -1
        }

        const label = document.createElement('label')
        label.setAttribute('for', id)
        label.textContent = l(contentTypeSettingNames[contentType])

        section.appendChild(checkbox)
        section.appendChild(label)

        contentTypeBlockingContainer.appendChild(section)

        checkbox.addEventListener('change', (e) => {
          settings.get('filtering', (value: { contentTypes?: any }) => {
            if (!value) {
              value = {}
            }
            if (!value.contentTypes) {
              value.contentTypes = []
            }

            if ((e.target as HTMLInputElement).checked) {
              // add the item to the array
              value.contentTypes.push(contentTypes[contentType])
            } else {
              // remove the item from the array
              const idx = value.contentTypes.indexOf(contentTypes[contentType])
              value.contentTypes.splice(idx, 1)
            }

            settings.set('filtering', value)
          })
        })
      })
    })(contentType as keyof typeof contentTypes)
  }

  /* dark mode setting */
  const darkModeNever = document.getElementById('dark-mode-never') as HTMLInputElement
  const darkModeNight = document.getElementById('dark-mode-night') as HTMLInputElement
  const darkModeAlways = document.getElementById('dark-mode-always') as HTMLInputElement
  const darkModeSystem = document.getElementById('dark-mode-system') as HTMLInputElement

  // -1 - off ; 0 - auto ; 1 - on
  settings.get('darkMode', (value: number | boolean | undefined) => {
    darkModeNever.checked = value === -1
    darkModeNight.checked = value === 0
    darkModeAlways.checked = value === 1 || value === true
    darkModeSystem.checked = value === 2 || value === undefined || value === false
  })

  // eslint-disable-next-line func-names
  darkModeNever.addEventListener('change', function () {
    if (this.checked) {
      settings.set('darkMode', -1)
    }
  })
  // eslint-disable-next-line func-names
  darkModeNight.addEventListener('change', function () {
    if (this.checked) {
      settings.set('darkMode', 0)
    }
  })
  // eslint-disable-next-line func-names
  darkModeAlways.addEventListener('change', function () {
    if (this.checked) {
      settings.set('darkMode', 1)
    }
  })
  // eslint-disable-next-line func-names
  darkModeSystem.addEventListener('change', function () {
    if (this.checked) {
      settings.set('darkMode', 2)
    }
  })

  /* site theme setting */

  settings.get('siteTheme', (value: boolean | undefined) => {
    if (value === true || value === undefined) {
      siteThemeCheckbox.checked = true
    } else {
      siteThemeCheckbox.checked = false
    }
  })

  // eslint-disable-next-line func-names
  siteThemeCheckbox.addEventListener('change', function () {
    settings.set('siteTheme', this.checked)
  })

  /* startup settings */

  const startupSettingInput = document.getElementById('startup-options') as HTMLInputElement

  settings.get('startupTabOption', (value = 2) => {
    startupSettingInput.value = value as unknown as string
  })

  // eslint-disable-next-line func-names
  startupSettingInput.addEventListener('change', function () {
    settings.set('startupTabOption', parseInt(this.value, 10))
  })

  /* new window settings */

  const newWindowSettingInput = document.getElementById('new-window-options') as HTMLInputElement

  settings.get('newWindowOption', (value = 1) => {
    newWindowSettingInput.value = value as unknown as string
  })

  // eslint-disable-next-line func-names
  newWindowSettingInput.addEventListener('change', function () {
    settings.set('newWindowOption', parseInt(this.value, 10))
  })

  /* userscripts setting */

  settings.get('userscriptsEnabled', (value: boolean) => {
    if (value === true) {
      userscriptsCheckbox.checked = true
      userscriptsShowDirectorySection.hidden = false
    }
  })

  // eslint-disable-next-line func-names
  userscriptsCheckbox.addEventListener('change', function () {
    settings.set('userscriptsEnabled', this.checked)
    userscriptsShowDirectorySection.hidden = !this.checked
  })

  userscriptsShowDirectorySection.getElementsByTagName('a')[0].addEventListener('click', () => {
    postMessage({ message: 'showUserscriptDirectory' })
  })

  /* show divider between tabs setting */

  settings.get('showDividerBetweenTabs', (value: boolean) => {
    if (value === true) {
      showDividerCheckbox.checked = true
    }
  })

  // eslint-disable-next-line func-names
  showDividerCheckbox.addEventListener('change', function () {
    settings.set('showDividerBetweenTabs', this.checked)
  })

  /* separate titlebar setting */

  settings.get('useSeparateTitlebar', (value: boolean) => {
    if (value === true) {
      separateTitlebarCheckbox.checked = true
    }
  })

  // eslint-disable-next-line func-names
  separateTitlebarCheckbox.addEventListener('change', function () {
    settings.set('useSeparateTitlebar', this.checked)
    showRestartRequiredBanner()
  })

  /* tabs in foreground setting */

  settings.get('openTabsInForeground', (value: boolean) => {
    if (value === true) {
      openTabsInForegroundCheckbox.checked = true
    }
  })

  // eslint-disable-next-line func-names
  openTabsInForegroundCheckbox.addEventListener('change', function () {
    settings.set('openTabsInForeground', this.checked)
  })

  /* media autoplay setting */

  settings.get('enableAutoplay', (value: boolean) => {
    autoPlayCheckbox.checked = value
  })

  // eslint-disable-next-line func-names
  autoPlayCheckbox.addEventListener('change', function () {
    settings.set('enableAutoplay', this.checked)
  })

  /* user agent settting */

  settings.get('customUserAgent', (value: string) => {
    if (value) {
      userAgentCheckbox.checked = true
      userAgentInput.style.visibility = 'visible'
      userAgentInput.value = value
    }
  })

  // eslint-disable-next-line func-names
  userAgentCheckbox.addEventListener('change', function () {
    if (this.checked) {
      userAgentInput.style.visibility = 'visible'
    } else {
      settings.set('customUserAgent', null)
      userAgentInput.style.visibility = 'hidden'
      showRestartRequiredBanner()
    }
  })

  // eslint-disable-next-line func-names
  userAgentInput.addEventListener('input', function () {
    if (this.value) {
      settings.set('customUserAgent', this.value)
    } else {
      settings.set('customUserAgent', null)
    }
    showRestartRequiredBanner()
  })

  /* update notifications setting */

  const updateNotificationsCheckbox = document.getElementById('checkbox-update-notifications') as HTMLInputElement

  // eslint-disable-next-line func-names
  settings.get('updateNotificationsEnabled', function (value: boolean) {
    if (value === false) {
      updateNotificationsCheckbox.checked = false
    } else {
      updateNotificationsCheckbox.checked = true
    }
  })

  // eslint-disable-next-line func-names
  updateNotificationsCheckbox.addEventListener('change', function () {
    settings.set('updateNotificationsEnabled', this.checked)
  })

  /* usage statistics setting */

  const usageStatisticsCheckbox = document.getElementById('checkbox-usage-statistics') as HTMLInputElement

  settings.get('collectUsageStats', (value: boolean) => {
    if (value === false) {
      usageStatisticsCheckbox.checked = false
    } else {
      usageStatisticsCheckbox.checked = true
    }
  })

  // eslint-disable-next-line func-names
  usageStatisticsCheckbox.addEventListener('change', function () {
    settings.set('collectUsageStats', this.checked)
  })

  /* default search engine setting */

  const searchEngineDropdown = document.getElementById('default-search-engine') as HTMLInputElement
  const searchEngineInput = document.getElementById('custom-search-engine') as HTMLInputElement

  searchEngineInput.setAttribute('placeholder', l('customSearchEngineDescription'))
  const currentSearchEngine = searchEngine.getCurrent()
  settings.onLoad(() => {
    if (currentSearchEngine.custom) {
      searchEngineInput.hidden = false
      searchEngineInput.value = currentSearchEngine.searchURL
    }

    for (const searchEngine in searchEngines) {
      const item = document.createElement('option')
      item.textContent = searchEngines[searchEngine].name

      if (searchEngines[searchEngine].name === currentSearchEngine.name) {
        item.setAttribute('selected', 'true')
      }

      searchEngineDropdown.appendChild(item)
    }

    // add custom option
    const item = document.createElement('option')
    item.textContent = 'custom'
    if (currentSearchEngine.custom) {
      item.setAttribute('selected', 'true')
    }
    searchEngineDropdown.appendChild(item)
  })

  // eslint-disable-next-line func-names
  searchEngineDropdown.addEventListener('change', function () {
    if (this.value === 'custom') {
      searchEngineInput.hidden = false
    } else {
      searchEngineInput.hidden = true
      settings.set('searchEngine', { name: this.value })
    }
  })

  // eslint-disable-next-line func-names
  searchEngineInput.addEventListener('input', function () {
    settings.set('searchEngine', { url: this.value })
  })

  /* key map settings */

  settings.get('keyMap', (keyMapSettings: Record<string, string | string[]>) => {
    const keyMap = userKeyMap(keyMapSettings)

    const keyMapList = document.getElementById('key-map-list') as HTMLElement

    Object.keys(keyMap).forEach((action) => {
      const li = createKeyMapListItem(action, keyMap)
      keyMapList.appendChild(li)
    })
  })

  function formatCamelCase(text: string) {
    const result = text.replace(/([a-z])([A-Z])/g, '$1 $2')
    return result.charAt(0).toUpperCase() + result.slice(1)
  }

  function createKeyMapListItem(
    action: string,
    keyMap: {
      [x: string]: string | string[]
    },
  ) {
    const li = document.createElement('li')
    const label = document.createElement('label')
    const input = document.createElement('input')
    label.innerText = formatCamelCase(action)
    label.htmlFor = action

    input.type = 'text'
    input.id = action
    input.name = action
    input.value = formatKeyValue(keyMap[action])
    input.addEventListener('input', onKeyMapChange)

    li.appendChild(label)
    li.appendChild(input)

    return li
  }

  function formatKeyValue(value: string | string[]) {
    // multiple shortcuts should be separated by commas
    if (value instanceof Array) {
      value = value.join(', ')
    }
    // use either command or ctrl depending on the platform
    if (navigator.platform === 'MacIntel') {
      value = value.replace(/\bmod\b/g, 'command')
    } else {
      value = value.replace(/\bmod\b/g, 'ctrl')
      value = value.replace(/\boption\b/g, 'alt')
    }
    return value
  }

  function parseKeyInput(input: string) {
    // input may be a single mapping or multiple mappings comma separated.
    let parsed = input.toLowerCase().split(',')
    parsed = parsed.map((e) => {
      return e.trim()
    })
    // Remove empty
    parsed = parsed.filter(Boolean)
    // convert key names back to generic equivalents
    parsed = parsed.map((e) => {
      if (navigator.platform === 'MacIntel') {
        e = e.replace(/\b(command)|(cmd)\b/g, 'mod')
      } else {
        e = e.replace(/\b(control)|(ctrl)\b/g, 'mod')
        e = e.replace(/\balt\b/g, 'option')
      }
      return e
    })
    return parsed.length > 1 ? parsed : parsed[0]
  }

  function onKeyMapChange(this: any) {
    const action = this.name
    const newValue = this.value

    settings.get('keyMap', (keyMapSettings: Record<string, string | string[]>) => {
      if (!keyMapSettings) {
        keyMapSettings = {}
      }

      keyMapSettings[action] = parseKeyInput(newValue)
      settings.set('keyMap', keyMapSettings)
      showRestartRequiredBanner()
    })
  }

  /* Password auto-fill settings  */

  const passwordManagersDropdown = document.getElementById('selected-password-manager') as HTMLInputElement
  for (const manager in passwordManagers) {
    const item = document.createElement('option')
    item.textContent = passwordManagers[manager as keyof typeof passwordManagers].name
    passwordManagersDropdown.appendChild(item)
  }

  settings.listen('passwordManager', () => {
    passwordManagersDropdown.value = window.currentPasswordManager!.name
  })

  // eslint-disable-next-line func-names
  passwordManagersDropdown.addEventListener('change', function () {
    if (this.value === 'none') {
      settings.set('passwordManager', { name: 'none' })
    } else {
      settings.set('passwordManager', { name: this.value })
    }
  })

  const keychainViewLink = document.getElementById('keychain-view-link') as HTMLElement

  keychainViewLink.addEventListener('click', () => {
    postMessage({ message: 'showCredentialList' })
  })

  settings.listen('passwordManager', () => {
    keychainViewLink.hidden = !(window.currentPasswordManager!.name === 'Built-in password manager')
  })

  /* proxy settings */

  const proxyTypeInput = document.getElementById('selected-proxy-type') as HTMLSelectElement
  const proxyInputs = Array.from(document.querySelectorAll('#proxy-settings-container input')) as HTMLInputElement[]

  const toggleProxyOptions = (proxyType: number) => {
    // eslint-disable-next-line eqeqeq
    document.getElementById('manual-proxy-section')!.hidden = proxyType != 1
    // eslint-disable-next-line eqeqeq
    document.getElementById('pac-option')!.hidden = proxyType != 2
  }

  const setProxy = (key: string, value: any) => {
    settings.get('proxy', (proxy: Record<string, any> = {}) => {
      proxy[key] = value as any
      settings.set('proxy', proxy)
    })
  }

  settings.get('proxy', (proxy: { type?: number } = {}) => {
    toggleProxyOptions(proxy.type!)

    proxyTypeInput.options.selectedIndex = proxy.type || 0
    proxyInputs.forEach((item) => {
      item.value = (proxy[item.name as keyof typeof proxy] || '') as unknown as string
    })
  })

  proxyTypeInput.addEventListener('change', (e) => {
    const proxyType = (e.target as HTMLSelectElement).options.selectedIndex
    setProxy('type', proxyType)
    toggleProxyOptions(proxyType)
  })

  proxyInputs.forEach((item) =>
    item.addEventListener('change', (e) =>
      setProxy((e.target as HTMLInputElement).name, (e.target as HTMLInputElement).value),
    ),
  )

  settings.get('customBangs', (value: { phrase: string; redirect: string; snippet: string }[]) => {
    const bangslist = document.getElementById('custom-bangs')!

    if (value) {
      value.forEach((bang) => {
        bangslist.appendChild(createBang(bang.phrase, bang.snippet, bang.redirect))
      })
    }
  })

  document.getElementById('add-custom-bang')!.addEventListener('click', () => {
    const bangslist = document.getElementById('custom-bangs')!
    bangslist.appendChild(createBang())
  })

  function createBang(bang = '', snippet = '', redirect = '') {
    const li = document.createElement('li')
    const bangInput = document.createElement('input')
    const snippetInput = document.createElement('input')
    const redirectInput = document.createElement('input')
    const xButton = document.createElement('button')
    const current = { phrase: bang ?? '', snippet: snippet ?? '', redirect: redirect ?? '' }
    function update(key: string, input: HTMLInputElement) {
      settings.get('customBangs', (d: { phrase: string; redirect: string; snippet: string }[]) => {
        const filtered = d
          ? d.filter((bang) => bang.phrase !== current.phrase && (key !== 'phrase' || bang.phrase !== input.value))
          : []
        filtered.push({ phrase: bangInput.value, snippet: snippetInput.value, redirect: redirectInput.value })
        settings.set('customBangs', filtered)
        current[key as keyof typeof current] = input.value
      })
    }

    bangInput.type = 'text'
    snippetInput.type = 'text'
    redirectInput.type = 'text'
    bangInput.value = bang ?? ''
    snippetInput.value = snippet ?? ''
    redirectInput.value = redirect ?? ''
    xButton.className = 'i carbon:close custom-bang-delete-button'

    bangInput.placeholder = l('settingsCustomBangsPhrase')
    snippetInput.placeholder = l('settingsCustomBangsSnippet')
    redirectInput.placeholder = l('settingsCustomBangsRedirect')
    xButton.addEventListener('click', () => {
      li.remove()
      settings.get('customBangs', (d: { phrase: string; redirect: string; snippet: string }[]) => {
        settings.set(
          'customBangs',
          d.filter((bang) => bang.phrase !== bangInput.value),
        )
      })
      showRestartRequiredBanner()
    })

    // eslint-disable-next-line func-names
    bangInput.addEventListener('change', function () {
      if (this.value.startsWith('!')) {
        this.value = this.value.slice(1)
      }
      update('phrase', bangInput)
      showRestartRequiredBanner()
    })
    snippetInput.addEventListener('change', () => {
      update('snippet', snippetInput)
      showRestartRequiredBanner()
    })
    redirectInput.addEventListener('change', () => {
      update('redirect', redirectInput)
      showRestartRequiredBanner()
    })

    li.appendChild(bangInput)
    li.appendChild(snippetInput)
    li.appendChild(redirectInput)
    li.appendChild(xButton)

    return li
  }
}
