<script setup lang="ts">
/*
src="../../js/util/keyMap.js"
    <script src="../../js/util/settings/settingsContent.js"
    <script src="../../js/util/searchEngine.js"
    <script src="../../js/util/theme.js"
    <script src="../../js/util/passwordManager.js"
    <script src="../../dist/localization.build.js"
    <script src="settings.js"
    */
// import { defaultKeyMap, userKeyMap } from '../../js/util/keyMap'
// import { settings } from './settingsContent'

import '../../css/base.css'
import './settings.css'
import '../../icons/iconfont.css'

import { onMounted } from 'vue'

import { settings as settingsContent } from '../settingsContent'
import * as theme from '../theme'
import * as passwordManager from './passwordManager'
import * as settings from './settings'
// postMessage({ payload: 'removeLoading' }, '*')
console.log('create Settings.vue')
import { initLocalizationHelpers } from '../../locales/localizationHelpers'

onMounted(() => {
  console.log('onMounted Settings.vue')
  settingsContent.initialize()
  theme.initialize()
  passwordManager.initialize()
  settings.initialize()
  initLocalizationHelpers()
})
</script>
<template>
  <div class="short-hero blue-gradient-background">
    <div class="container">
      <h2 data-string="settingsPreferencesHeading"></h2>
    </div>
  </div>

  <div id="privacy-settings-container" class="settings-container">
    <h3 data-string="settingsPrivacyHeading"></h3>

    <div id="content-blocking-statistics" class="settings-info-subheading">
      <i class="i carbon:manage-protection"></i>
      <span id="content-blocking-blocked-requests" data-string="settingsBlockedRequestCount" data-allowHTML> </span>
    </div>

    <div id="tracking-level-container" class="setting-section">
      <div class="setting-option">
        <input id="blocking-allow-all" type="radio" name="blockingLevel" />
        <label for="blocking-allow-all" data-string="settingsContentBlockingLevel0"></label>
      </div>
      <div class="setting-option">
        <input id="blocking-third-party" type="radio" name="blockingLevel" />
        <label for="blocking-third-party" data-string="settingsContentBlockingLevel1"></label>
      </div>
      <div class="setting-option">
        <input id="blocking-block-all" type="radio" name="blockingLevel" />
        <label for="blocking-block-all" data-string="settingsContentBlockingLevel2"></label>
      </div>

      <div id="content-blocking-information" hidden>
        <div>
          <label for="content-blocking-exceptions" data-string="settingsContentBlockingExceptions"></label>
          <textarea
            id="content-blocking-exceptions"
            spellcheck="false"
            style="width: 100%; max-width: 500px"
            rows="1"
          ></textarea>
        </div>
        <a
          id="customize-filters-link"
          href="https://github.com/minbrowser/min/wiki/Content-blocking-settings"
          data-string="settingsCustomizeFiltersLink"
        ></a>
      </div>
    </div>

    <div id="content-type-blocking"></div>
  </div>

  <div id="appearance-settings-container" class="settings-container">
    <h3 data-string="settingsAppearanceHeading"></h3>

    <label for="dark-mode-container" data-string="settingsEnableDarkMode"></label>
    <div id="dark-mode-container" class="setting-section">
      <div class="setting-option">
        <input id="dark-mode-never" type="radio" name="darkMode" />
        <label for="dark-mode-never" data-string="settingsDarkModeNever"></label>
      </div>
      <div class="setting-option">
        <input id="dark-mode-night" type="radio" name="darkMode" />
        <label for="dark-mode-night" data-string="settingsDarkModeNight"></label>
      </div>
      <div class="setting-option">
        <input id="dark-mode-always" type="radio" name="darkMode" />
        <label for="dark-mode-always" data-string="settingsDarkModeAlways"></label>
      </div>
      <div class="setting-option">
        <input id="dark-mode-system" type="radio" name="darkMode" />
        <label for="dark-mode-system" data-string="settingsDarkModeSystem"></label>
      </div>
    </div>

    <div class="setting-section">
      <input id="checkbox-site-theme" type="checkbox" />
      <label for="checkbox-site-theme" data-string="settingsSiteThemeToggle"></label>
    </div>

    <div class="setting-section">
      <input id="checkbox-show-divider" type="checkbox" />
      <label for="checkbox-show-divider" data-string="settingsShowDividerToggle"></label>
    </div>
  </div>

  <div id="additional-settings-container" class="settings-container">
    <h3 data-string="settingsAdditionalFeaturesHeading"></h3>

    <div class="setting-section">
      <label for="startupOptions" data-string="settingsStartupOptions"></label>
      <select id="startup-options" name="startupOptions">
        <option value="1" data-string="settingsStartupCreateTask"></option>
        <option value="2" data-string="settingsStartupNewTaskandBackground"></option>
        <option value="3" data-string="settingsStartupNewTaskOnly"></option>
      </select>
    </div>

    <div class="setting-section">
      <label for="newWindowOptions" data-string="settingsNewWindowOptions"></label>
      <select id="new-window-options" name="newWindowOptions">
        <option value="1" data-string="settingsNewWindowCreateTask"></option>
        <option value="2" data-string="settingsNewWindowPickTask"></option>
      </select>
    </div>

    <div class="setting-section">
      <input id="checkbox-userscripts" type="checkbox" />
      <label for="checkbox-userscripts" data-string="settingsUserscriptsToggle"></label>
      <div
        class="settings-info-subheading setting-secondary-label"
        data-string="settingsUserscriptsExplanation"
        data-allowHTML
      ></div>
      <div
        id="userscripts-show-directory"
        class="setting-secondary-label"
        hidden
        style="margin-top: -0.5em; margin-bottom: 0.5em"
      >
        <a data-string="settingsUserscriptShowDirectory"></a>
      </div>
    </div>

    <div id="section-separate-titlebar" class="setting-section">
      <input id="checkbox-separate-titlebar" type="checkbox" />
      <label for="checkbox-separate-titlebar" data-string="settingsSeparateTitlebarToggle"></label>
    </div>

    <div id="section-open-tabs-in-foreground" class="setting-section">
      <input id="checkbox-open-tabs-in-foreground" type="checkbox" />
      <label for="checkbox-open-tabs-in-foreground" data-string="settingsOpenTabsInForegroundToggle"></label>
    </div>

    <div id="section-user-agent" class="setting-section">
      <input id="checkbox-user-agent" type="checkbox" />
      <label for="checkbox-user-agent" data-string="settingsUserAgentToggle"></label>
      <input
        id="input-user-agent"
        type="text"
        style="vertical-align: middle; margin-left: 1em; width: 375px; max-width: 80vw; visibility: hidden"
      />
    </div>

    <div class="setting-section">
      <input id="checkbox-enable-autoplay" type="checkbox" />
      <label for="checkbox-enable-autoplay" data-string="settingsAutoplayToggle"></label>
    </div>

    <div class="setting-section">
      <input id="checkbox-update-notifications" type="checkbox" />
      <label for="checkbox-update-notifications" data-string="settingsUpdateNotificationsToggle"></label>
    </div>
    <div class="setting-section">
      <input id="checkbox-usage-statistics" type="checkbox" />
      <label for="checkbox-usage-statistics" data-string="settingsUsageStatisticsToggle" data-allowHTML></label>
    </div>
  </div>

  <div id="search-engine-settings-container" class="settings-container">
    <h3 data-string="settingsSearchEngineHeading"></h3>

    <div class="setting-section">
      <label for="defaultSearchEngine" data-string="settingsDefaultSearchEngine"></label>
      <select id="default-search-engine" name="defaultSearchEngine"></select>
      <input id="custom-search-engine" style="margin-left: 0.5em; min-width: 325px" hidden />

      <div class="settings-info-subheading" style="padding-top: 0.4em" data-string="settingsDDGExplanation"></div>
    </div>
  </div>

  <div id="password-autofill-container" class="settings-container">
    <h3 data-string="settingsPasswordAutoFillHeadline"></h3>

    <div class="setting-section">
      <label for="selectedPasswordManagers" data-string="settingsSelectPasswordManager"></label>
      <select id="selected-password-manager" name="selectedPasswordManager"></select>
    </div>

    <div id="keychain-view-link" class="setting-section" hidden>
      <a data-string="keychainViewPasswords"></a>
    </div>
  </div>

  <div id="proxy-settings-container" class="settings-container">
    <h3 data-string="settingsProxyHeading"></h3>

    <div id="proxy-type-container" class="setting-section">
      <select id="selected-proxy-type">
        <option data-string="settingsNoProxy"></option>
        <option data-string="settingsManualProxy"></option>
        <option data-string="settingsAutomaticProxy"></option>
      </select>
    </div>

    <div id="manual-proxy-section" class="setting-section">
      <div class="setting-option">
        <label for="proxy-rules-input" data-string="settingsProxyRules"></label>
        <input id="proxy-rules-input" type="text" name="proxyRules" placeholder="proxy.example.com:8080" />
      </div>

      <div class="setting-option">
        <label for="proxy-bypass-rules-input" data-string="settingsProxyBypassRules"></label>
        <input id="proxy-bypass-rules-input" name="proxyBypassRules" placeholder="localhost, 127.0.0.1/8, ::1" />
      </div>
    </div>

    <div id="pac-option" class="setting-option">
      <label for="pac-url-input" data-string="settingsProxyConfigurationURL"></label>
      <input id="pac-url-input" type="text" placeholder="https://example.com/proxy.pac" />
    </div>
  </div>

  <div id="keymap-settings-container" class="settings-container">
    <h3 data-string="settingsKeyboardShortcutsHeading"></h3>
    <div class="settings-info-subheading" data-string="settingsKeyboardShortcutsHelp"></div>

    <div class="setting-section">
      <ul id="key-map-list"></ul>
    </div>
  </div>
  <div id="custom-bangs-container" class="settings-container">
    <h3 data-string="settingsCustomBangs"></h3>
    <div class="setting-section">
      <ul id="custom-bangs"></ul>
      <button id="add-custom-bang" data-string="settingsCustomBangsAdd"></button>
    </div>
  </div>
  <!-- this needs to be placed at the bottom so that sticky positioning works correctly -->
  <div id="restart-required-banner" class="banner yellow-background" role="alert" hidden>
    <div class="container">
      <i class="i carbon:information"></i>
      <span data-string="settingsRestartRequired"></span>
    </div>
  </div>
</template>
