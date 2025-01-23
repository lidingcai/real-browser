<script setup lang="ts">
import '../pagebase.css'

import { onMounted } from 'vue'

import { initLocalizationHelpers } from '../../locales/localizationHelpers'
import { settings as settingsContent } from '../settingsContent'
import * as theme from '../theme'
import { initError } from './error'

onMounted(() => {
  console.log('onMounted Settings.vue')
  settingsContent.initialize()
  theme.initialize()
  initLocalizationHelpers()
  initError()
})
</script>
<template>
  <div id="page-wrapper">
    <h1 id="error-name"></h1>
    <h2 id="error-desc"></h2>

    <button id="secondary-button" class="secondary-button" hidden></button>
    <button id="primary-button" class="primary-button" data-string="errorPagePrimaryAction"></button>
  </div>
</template>
