<script setup lang="ts">
import './viewer.css'
import '../../icons/iconfont.css'
import '../settingsDropdown.css'

import { onMounted } from 'vue'

import { initLocalizationHelpers } from '../../locales/localizationHelpers'
import { settings as settingsContent } from '../settingsContent'
import * as theme from '../theme'

onMounted(() => {
  settingsContent.initialize()
  theme.initialize()
  initLocalizationHelpers()
})
</script>
<template>
  <div id="progress-bar" class="viewer-ui"></div>

  <div id="side-gutter-left" class="side-gutter">
    <div id="page-counter" class="viewer-ui hidden" data-string="PDFPageCounter" data-allowHTML></div>
  </div>
  <div id="side-gutter-right" class="side-gutter">
    <button id="download-button" class="i carbon:download viewer-ui hidden"></button>

    <button id="settings-button" class="i carbon:settings-adjust viewer-ui hidden" data-label="viewSettings"></button>

    <div id="settings-dropdown" class="viewer-ui" hidden>
      <div class="setting-section theme-circles">
        <button class="theme-circle selected" data-theme="light" data-label="buttonReaderLightTheme"></button>
        <button class="theme-circle" data-theme="sepia" data-label="buttonReaderSepiaTheme"></button>
        <button class="theme-circle" data-theme="dark" data-label="buttonReaderDarkTheme"></button>
      </div>
      <div id="invert-pdf-section" class="setting-section">
        <input id="invert-pdf-checkbox" type="checkbox" /><label
          for="invert-pdf-checkbox"
          data-string="PDFInvertPage"
        ></label>
      </div>
    </div>
  </div>
  <script src="../../node_modules/pdfjs-dist/web/pdf_viewer.js"></script>
  <script src="viewer.js"></script>
  <script src="pdfThemeSelector.js"></script>
</template>
