import { quickScore } from 'quick-score'

import { l } from '../../locales'
import * as browserUI from '../browserUI'
import { TabList } from '../tabState/tab'
import { urlParser } from '../util/urlParser'
import { searchbarPlugins } from './searchbarPlugins'
/*
var browserUI = require('browserUI.js')
var searchbarPlugins = require('searchbar/searchbarPlugins.js')

var urlParser = require('util/urlParser.js')

const { quickScore } = require('quick-score')
*/
// const { tabs, tasks } = window
const searchOpenTabs = (text: string, _input: HTMLInputElement, _event: Event) => {
  searchbarPlugins.reset('openTabs')

  const matches: { task: TaskType; tab: TabType; score: number }[] = []
  const searchText = text.toLowerCase()
  const currentTask = window.tasks.getSelected()!
  const currentTab = (currentTask.tabs as TabList).getSelected()

  window.tasks.forEach((task) => {
    task.tabs!.forEach((tab) => {
      if (tab.id === currentTab || !tab.title || !tab.url) {
        return
      }

      const tabUrl = urlParser.basicURL(tab.url) // don't search protocols

      const exactMatch =
        tab.title.toLowerCase().indexOf(searchText) !== -1 || tabUrl.toLowerCase().indexOf(searchText) !== -1
      const fuzzyTitleScore = quickScore(tab.title.substring(0, 50), text)
      const fuzzyUrlScore = quickScore(tabUrl, text)

      if (exactMatch || fuzzyTitleScore > 0.35 || fuzzyUrlScore > 0.35) {
        matches.push({
          task,
          tab,
          score: fuzzyTitleScore + fuzzyUrlScore,
        })
      }
    })
  })

  if (matches.length === 0) {
    return
  }

  function scoreMatch(match: { task: TaskType; tab: TabType; score: number }) {
    let score = 0
    if (match.task.id === currentTask.id) {
      score += 0.2
    }
    const age = Date.now() - (match.tab.lastActivity || 0)

    score += 0.3 / (1 + Math.exp(age / (30 * 24 * 60 * 60 * 1000)))
    return score
  }

  const finalMatches = matches
    .map((match) => {
      match.score += scoreMatch(match)
      return match
    })
    .sort((a, b) => {
      return b.score - a.score
    })
    .slice(0, 2)

  finalMatches.forEach((match) => {
    const data = {
      icon: 'carbon:arrow-up-right',
      title: match.tab.title,
      secondaryText: urlParser.basicURL(match.tab.url!),
      click: () => {},
      metadata: [] as string[],
    }

    if (match.task.id !== currentTask.id) {
      const taskName =
        match.task.name || l('taskN').replace('%n', (window.tasks.getIndex(match.task.id!) + 1) as unknown as string)
      data.metadata = [taskName]
    }

    data.click = () => {
      // if we created a new tab but are switching away from it, destroy the current (empty) tab
      const currentTabUrl = (window.tabs.get(window.tabs.getSelected()!) as TabType).url
      if (!currentTabUrl) {
        browserUI.closeTab(window.tabs.getSelected()!)
      }

      if (match.task.id !== currentTask.id) {
        browserUI.switchToTask(match.task.id!)
      }

      browserUI.switchToTab(match.tab.id!)
    }

    searchbarPlugins.addResult('openTabs', data)
  })
}

export function initialize() {
  searchbarPlugins.register('openTabs', {
    index: 3,
    trigger(text) {
      return text.length > 2
    },
    showResults: searchOpenTabs,
  })
}

// module.exports = { initialize }
