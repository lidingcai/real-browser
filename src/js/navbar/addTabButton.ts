// const browserUI = require('browserUI.js')
import * as browserUI from '../browserUI'

export function initialize() {
  const addTabButton = document.getElementById('add-tab-button')!

  addTabButton.addEventListener('click', (_e) => {
    browserUI.addTab()
  })
}

// module.exports = { initialize }
