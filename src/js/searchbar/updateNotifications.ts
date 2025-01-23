import { l } from '../../locales/index'
// const UPDATE_URL = 'https://minbrowser.org/min/updates/latestVersion.json'
// var settings = require('util/settings/settings.js')
// var compareVersions = require('util/compareVersions.js')
import { compareVersions } from '../util/compareVersions'
// import { settings } from '../util/settings/settings'
// var searchbarPlugins = require('searchbar/searchbarPlugins.js')
import { searchbarPlugins } from './searchbarPlugins'

/*
function getUpdateRandomNum() {
  // the update JSON might indicate that the update is only available to a % of clients, in order to avoid notifying everyone to update to a new version until there's time to report bugs.
  //    Create a random number that is saved locally, and compare this to the indicated % to determine if the update notification should be shown. 

  if (!localStorage.getItem('updateRandomNumber')) {
    localStorage.setItem('updateRandomNumber', Math.random() as unknown as string)
  }
  return parseFloat(localStorage.getItem('updateRandomNumber') as string)
}
*/

/*
function getAvailableUpdates() {
  if (settings.get('updateNotificationsEnabled') !== false) {
    console.info('checking for updates')
    fetch(UPDATE_URL, {
      cache: 'no-cache',
    })
      .then((res) => res.json())
      .then((response) => {
        console.info('got response from update check', response)
        if (
          response.version &&
          compareVersions(window.globalArgs['app-version'], response.version) > 0 &&
          (!response.availabilityPercent || getUpdateRandomNum() < response.availabilityPercent)
        ) {
          console.info('an update is available')
          localStorage.setItem('availableUpdate', JSON.stringify(response))
        } else {
          console.info('update is not available')
          // this can happen if either the update is no longer being offered, or the update has already been installed 
          localStorage.removeItem('availableUpdate')
        }
      })
      .catch((e) => {
        console.info('failed to get update info', e)
      })
  } else {
    console.info('update checking is disabled')
  }
}
*/

function showUpdateNotification(_text: any, _input: any, _event: any) {
  function displayUpdateNotification() {
    searchbarPlugins.reset('updateNotifications')
    searchbarPlugins.addResult(
      'updateNotifications',
      {
        title: l('updateNotificationTitle'),
        descriptionBlock: update.releaseHeadline || 'View release notes',
        url: update.releaseNotes,
        icon: 'carbon:renew',
      },
      { allowDuplicates: true },
    )
  }
  // is there an update?
  const update = JSON.parse(localStorage.getItem('availableUpdate') as string)
  if (update) {
    // was the update already installed?
    if (compareVersions(window.globalArgs['app-version'], update.version) <= 0) {
      return
    }
    const updateAge = Date.now() - update.releaseTime
    /* initially, only show an update notification when no tabs are open, in order to minimize disruption */
    if (updateAge < 3 * 7 * 24 * 60 * 60 * 1000) {
      if (window.tabs.isEmpty()) {
        displayUpdateNotification()
      }
    } else {
      /* after 3 weeks, start showing a notification on all new tabs */
      // eslint-disable-next-line no-lonely-if
      if (!(window.tabs.get(window.tabs.getSelected() as string) as TabType).url) {
        displayUpdateNotification()
      }
    }
  }
}

// setTimeout(getAvailableUpdates, 30000)
// setInterval(getAvailableUpdates, 24 * 60 * 60 * 1000)

export function initialize() {
  searchbarPlugins.register('updateNotifications', {
    index: 11,
    trigger(text) {
      return !text && performance.now() > 5000
    },
    showResults: showUpdateNotification,
  })
}

// module.exports = { initialize }
