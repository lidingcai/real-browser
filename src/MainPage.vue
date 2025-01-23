<script setup lang="ts">
import './style.css'
import './js/default'

import { onMounted } from 'vue'

import { AutofillSetup } from './js/autofillSetup'
import { bookmarkConverter } from './js/bookmarkConverter'
import * as browserUI from './js/browserUI'
import * as contextMenu from './js/contextMenu'
import { defaultKeybindings } from './js/defaultKeybindings'
import { downloadManager } from './js/downloadManager'
import { findinpage } from './js/findinpage'
import * as keybindings from './js/keybindings'
import macHandoff from './js/macHandoff'
import * as menuRenderer from './js/menuRenderer'
import * as addTabButton from './js/navbar/addTabButton'
import { bookmarkStar } from './js/navbar/bookmarkStar'
import { menuButton } from './js/navbar/menuButton'
import { navigationButtons } from './js/navbar/navigationButtons'
import { permissionRequests } from './js/navbar/permissionRequests'
import { tabActivity } from './js/navbar/tabActivity'
import { tabBar } from './js/navbar/tabBar'
import { tabColor } from './js/navbar/tabColor'
import { tabEditor } from './js/navbar/tabEditor'
import { newTabPage } from './js/newTabPage'
import { pageTranslations } from './js/pageTranslations'
import { setupDialog } from './js/passwordManager/managerSetup'
import { passwordCapture } from './js/passwordManager/passwordCapture'
import { PasswordManagers } from './js/passwordManager/passwordManager'
import { passwordViewer } from './js/passwordManager/passwordViewer'
import { PDFViewer } from './js/pdfViewer'
import { places } from './js/places/places'
import { readerView } from './js/readerView'
import * as bangsPlugin from './js/searchbar/bangsPlugin'
import { bookmarkManager } from './js/searchbar/bookmarkManager'
import * as calculatorPlugin from './js/searchbar/calculatorPlugin'
import * as customBangs from './js/searchbar/customBangs'
import * as developmentModeNotification from './js/searchbar/developmentModeNotification'
import * as historyViewer from './js/searchbar/historyViewer'
import * as instantAnswerPlugin from './js/searchbar/instantAnswerPlugin'
import * as openTabsPlugin from './js/searchbar/openTabsPlugin'
import * as placesPlugin from './js/searchbar/placesPlugin'
import * as placeSuggestionsPlugin from './js/searchbar/placeSuggestionsPlugin'
import * as restoreTaskPlugin from './js/searchbar/restoreTaskPlugin'
import { searchbar } from './js/searchbar/searchbar'
import * as searchSuggestionsPlugin from './js/searchbar/searchSuggestionsPlugin'
import * as shortcutButtons from './js/searchbar/shortcutButtons'
import * as updateNotifications from './js/searchbar/updateNotifications'
import { sessionRestore } from './js/sessionRestore'
import { statistics } from './js/statistics'
import { tabAudio } from './js/tabAudio'
import * as tabState from './js/tabState'
import { windowSync } from './js/tabState/windowSync'
import { taskOverlay } from './js/taskOverlay/taskOverlay'
import { userscripts } from './js/userscripts'
import { settings } from './js/util/settings/settings'
import * as theme from './js/util/theme'
import { webviewMenu } from './js/webviewMenu'
import * as windowControls from './js/windowControls'
import { initLocalizationHelpers } from './locales/localizationHelpers'

onMounted(() => {
  initLocalizationHelpers()

  // main init
  // tabState
  tabState.initialize()

  // windowSync
  permissionRequests.initialize()
  readerView.initialize()
  tabAudio.initialize()
  tabBar.initialize()
  bookmarkStar.initialize()
  tabEditor.initialize()
  searchbar.initialize()
  browserUI.initialize()
  settings.initialize()
  windowSync.initialize()

  // window controls
  windowControls.initialize()

  // menuButton
  keybindings.initialize()
  menuButton.initialize()
  addTabButton.initialize()
  tabActivity.initialize()
  tabColor.initialize()
  navigationButtons.initialize()
  downloadManager.initialize()
  webviewMenu.initialize()
  contextMenu.initialize()

  findinpage.initialize()
  menuRenderer.initialize()
  defaultKeybindings.initialize()
  PDFViewer.initialize()

  // Autofill setup
  setupDialog.initialize()
  AutofillSetup.initialize()
  PasswordManagers.initialize()
  passwordCapture.initialize()
  passwordViewer.initialize()
  theme.initialize()
  userscripts.initialize()
  statistics.initialize()
  taskOverlay.initialize()
  pageTranslations.initialize()
  sessionRestore.initialize()

  // bookmarkconverter
  places.initialize()
  bookmarkConverter.initialize()
  newTabPage.initialize()
  macHandoff.initialize()

  // default searchbar plugins
  placesPlugin.initialize()
  instantAnswerPlugin.initialize()
  openTabsPlugin.initialize()
  bangsPlugin.initialize()
  customBangs.initialize()
  searchSuggestionsPlugin.initialize()
  placeSuggestionsPlugin.initialize()
  updateNotifications.initialize()
  restoreTaskPlugin.initialize()
  bookmarkManager.initialize()
  historyViewer.initialize()
  developmentModeNotification.initialize()
  shortcutButtons.initialize()
  calculatorPlugin.initialize()
  // once everything's loaded, start the session

  sessionRestore.restore()
})
</script>

<template>
  <div class="window-drag-area"></div>

  <div class="windows-caption-buttons">
    <div class="element caption-minimise">
      <svg>
        <line x1="1" y1="5.5" x2="11" y2="5.5" />
      </svg>
    </div>
    <div class="element caption-maximize">
      <svg>
        <rect x="1.5" y="1.5" width="9" height="9" />
      </svg>
    </div>
    <div class="element caption-restore">
      <svg>
        <rect x="1.5" y="3.5" width="7" height="7" />
        <polyline points="3.5,3.5 3.5,1.5 10.5,1.5 10.5,8.5 8.5,8.5" />
      </svg>
    </div>
    <div class="element caption-close">
      <svg>
        <path d="M1,1 l 10,10 M1,11 l 10,-10" />
      </svg>
    </div>
  </div>

  <button id="linux-control-buttons" class="theme-text-color">
    <svg
      width="74"
      height="24"
      version="1.1"
      fill="none"
      stroke="none"
      stroke-linecap="square"
      stroke-miterlimit="10"
      xmlns:xlink="http://www.w3.org/1999/xlink"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g id="minimize-button">
        <rect width="24" height="24" fill="transparent"></rect>
        <path
          class="button-background"
          d="m0.5826226 9.868774l0 0c0 -5.24453 4.251532 -9.496062 9.496063 -9.496062l0 0c2.5185127 0 4.933873 1.0004752 6.714731 2.7813323c1.7808571 1.7808576 2.781332 4.196218 2.781332 6.7147303l0 0c0 5.2445316 -4.2515326 9.496063 -9.496063 9.496063l0 0c-5.244531 0 -9.496063 -4.2515316 -9.496063 -9.496063z"
          fill-rule="evenodd"
        />
        <path
          stroke="currentColor"
          stroke-width="2.0"
          stroke-linejoin="round"
          stroke-linecap="butt"
          d="m6.7086616 12.519685l6.7401576 -0.031496048"
          fill-rule="evenodd"
        />
      </g>
      <g id="maximize-button">
        <rect width="24" height="24" x="24" fill="transparent"></rect>
        <path
          class="button-background"
          d="m27.85034 9.868774l0 0c0 -5.24453 4.2515316 -9.496062 9.496061 -9.496062l0 0c2.5185127 0 4.933876 1.0004752 6.714733 2.7813323c1.7808571 1.7808576 2.78133 4.196218 2.78133 6.7147303l0 0c0 5.2445316 -4.2515297 9.496063 -9.496063 9.496063l0 0c-5.2445297 0 -9.496061 -4.2515316 -9.496061 -9.496063z"
          fill-rule="evenodd"
        />
        <path
          stroke="currentColor"
          stroke-width="2.0"
          stroke-linejoin="round"
          stroke-linecap="butt"
          d="m34.16273 6.717848l6.3622017 0l0 6.2992125l-6.3622017 0z"
          fill-rule="evenodd"
        />
      </g>
      <g id="close-button">
        <rect width="24" height="24" x="48" fill="transparent"></rect>
        <path
          class="button-background"
          d="m55.118057 9.496072l0 0c0 -5.244531 4.2515297 -9.496063 9.496063 -9.496063l0 0c2.518509 0 4.9338684 1.0004753 6.7147293 2.7813325c1.7808533 1.7808573 2.781334 4.1962185 2.781334 6.714731l0 0c0 5.2445307 -4.2515335 9.496062 -9.496063 9.496062l0 0c-5.2445335 0 -9.496063 -4.2515316 -9.496063 -9.496062z"
          fill-rule="evenodd"
        />
        <path
          stroke="currentColor"
          stroke-width="2.0"
          stroke-linejoin="round"
          stroke-linecap="butt"
          d="m61.26077 6.1103663l6.740162 6.7716537"
          fill-rule="evenodd"
        />
        <path
          stroke="currentColor"
          stroke-width="2.0"
          stroke-linejoin="round"
          stroke-linecap="butt"
          d="m68.01668 6.1261144l-6.771656 6.7401576"
          fill-rule="evenodd"
        />
      </g>
    </svg>
  </button>

  <div id="navbar" class="theme-background-color theme-text-color windowDragHandle" tabindex="-1">
    <div id="mac-window-drag-area"></div>
    <button
      id="menu-button"
      class="navbar-action-button i carbon:overflow-menu-vertical"
      data-label="openMenu"
      tabindex="-1"
    ></button>
    <div id="toolbar-navigation-buttons" hidden>
      <button
        id="back-button"
        class="navbar-action-button i carbon:chevron-left"
        data-label="goBack"
        tabindex="-1"
      ></button>
      <button
        id="forward-button"
        class="navbar-action-button i carbon:chevron-right"
        data-label="goForward"
        tabindex="-1"
      ></button>
    </div>
    <div id="tabs">
      <div id="tab-editor" hidden>
        <input id="tab-editor-input" class="mousetrap" spellcheck="false" />
      </div>
      <div id="tabs-inner" role="tablist" class="has-thin-scrollbar"></div>
    </div>
    <div class="navbar-right-actions">
      <button
        id="add-tab-button"
        class="navbar-action-button i carbon:add"
        data-label="newTabAction"
        tabindex="-1"
      ></button>
    </div>
  </div>

  <button
    id="switch-task-button"
    class="navbar-action-button theme-text-color windowDragHandle i"
    data-label="viewTasks"
    tabindex="-1"
  >
    <svg
      version="1.1"
      viewBox="0.0 0.0 26.0 26.0"
      fill="none"
      stroke="none"
      stroke-linecap="square"
      stroke-miterlimit="10"
      xmlns:xlink="http://www.w3.org/1999/xlink"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clip-path="url(#p.0)">
        <path fill="currentColor" d="m0 0l32 0l0 4l-32 0z" fill-rule="evenodd" />
        <path fill="currentColor" d="m0 11l32 0l0 4l-32 0z" fill-rule="evenodd" />
        <path fill="currentColor" d="m0 22l32 0l0 4l-32 0z" fill-rule="evenodd" />
      </g>
    </svg>
  </button>

  <div id="searchbar" class="theme-background-color theme-text-color">
    <div class="top-answer-area"></div>
  </div>

  <div id="overlay"></div>

  <div id="webviews">
    <div id="leftArrowContainer" class="arrow-indicator">
      <i id="leftArrow" class="i carbon:chevron-left"></i>
    </div>
    <div id="rightArrowContainer" class="arrow-indicator">
      <i id="rightArrow" class="i carbon:chevron-right"></i>
    </div>
    <img id="webview-placeholder" hidden aria-hidden="true" />
    <div id="ntp-content">
      <img id="ntp-background" hidden />
      <div id="ntp-background-controls">
        <button id="ntp-image-remove"><i class="i carbon:trash-can"></i></button>
        <button id="ntp-image-picker"><i class="i carbon:camera"></i></button>
      </div>
    </div>
  </div>

  <!-- findinpage ui -->

  <div id="findinpage-bar" hidden class="theme-background-color theme-text-color">
    <input id="findinpage-input" class="mousetrap" />
    <span id="findinpage-count" class="inline-text"></span>
    <div class="divider"></div>
    <button id="findinpage-previous-match">
      <i class="i carbon:chevron-up navbar-action-button"></i>
    </button>
    <button id="findinpage-next-match">
      <i class="i carbon:chevron-down navbar-action-button"></i>
    </button>
    <div class="divider"></div>
    <button id="findinpage-end">
      <i class="i carbon:close navbar-action-button"></i>
    </button>
  </div>

  <div id="task-overlay" class="" hidden tabindex="-1">
    <div id="task-overlay-navbar" class="simulated-navbar windowDragHandle">
      <div class="task-search-input-container">
        <i class="i carbon:search"></i>
        <input id="task-search-input" type="search" class="mousetrap" />
      </div>
    </div>
    <div id="task-area"></div>
    <button id="add-task">
      <i class="i carbon:new-tab"></i>
      <span></span>
    </button>
  </div>

  <div id="download-bar" hidden>
    <div id="download-container" role="list" class="has-thin-scrollbar"></div>
    <button id="download-close-button" class="i carbon:close"></button>
  </div>

  <div id="manager-setup-dialog" class="modal" hidden>
    <h3 id="manager-setup-heading" class="modal-title"></h3>
    <button id="manager-setup-close" class="modal-close-button i carbon:close"></button>

    <div id="manager-setup-instructions-primary">
      <div class="light-fade" data-string="passwordManagerSetupStep1" data-allowHTML></div>
      <div class="spacer"></div>
      <div class="light-fade" data-string="passwordManagerSetupStep2" data-allowHTML></div>
    </div>

    <div id="manager-setup-instructions-secondary">
      <div class="light-fade" data-string="passwordManagerInstallerSetup" data-allowHTML></div>
    </div>

    <div class="spacer"></div>

    <div id="manager-setup-drop-box" class="drag-and-drop-box" data-string="passwordManagerSetupDragBox"></div>

    <div class="spacer"></div>
    <div class="spacer"></div>

    <div class="buttons">
      <input id="manager-setup-disable" type="button" data-value="disableAutofill" />
    </div>
  </div>

  <div id="password-capture-bar" hidden>
    <span id="password-capture-description"></span>
    <input id="password-capture-username" type="text" required />
    <span class="password-capture-section">
      <input id="password-capture-password" type="password" required />
      <button id="password-capture-reveal-password" class="i carbon:view"></button>
    </span>
    <span class="password-capture-section">
      <button id="password-capture-save" data-string="passwordCaptureSave"></button>
      <button id="password-capture-ignore" data-string="passwordCaptureDontSave"></button>
    </span>
    <button id="password-capture-never-save" data-string="passwordCaptureNeverSave"></button>
  </div>

  <div id="password-viewer" class="modal" hidden>
    <h2 class="modal-title" data-string="savedPasswordsHeading"></h2>
    <button class="modal-close-button i carbon:close"></button>
    <div id="password-viewer-empty" data-string="savedPasswordsEmpty" hidden></div>
    <div id="password-viewer-list"></div>
  </div>
</template>

<style scoped></style>
