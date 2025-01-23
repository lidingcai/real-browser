// var searchbarPlugins = require('searchbar/searchbarPlugins.js')
import { searchbarPlugins } from './searchbarPlugins'

export function initialize() {
  searchbarPlugins.register('developmentModeNotification', {
    index: 0,
    trigger(_text: string) {
      return 'development-mode' in window.globalArgs
    },
    showResults() {
      searchbarPlugins.reset('developmentModeNotification')
      searchbarPlugins.addResult('developmentModeNotification', {
        title: 'Development Mode Enabled',
      })
    },
  })
}

// module.exports = { initialize }
