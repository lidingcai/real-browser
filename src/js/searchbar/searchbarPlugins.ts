// const searchbar = document.getElementById('searchbar')!
// var searchbarUtils = require('searchbar/searchbarUtils.js')
import { createHeading, createItem, createLazyList, getRealTitle } from './searchbarUtils'

const searchbarUtils = { createHeading, createItem, createLazyList, getRealTitle }
const plugins = [] as {
  name: string
  container: HTMLElement
  trigger?: (arg0: string) => boolean
  showResults?: Function
}[] // format is {name, container, trigger, showResults}
const results = {} as Record<string, DataType[]> // format is {pluginName: [results]}
let URLOpener: (arg0: string, arg1: MouseEvent) => boolean
const URLHandlers = [] as ((arg0: string) => boolean)[] // format is {trigger, action}

let topAnswer = {
  plugin: null as string | null,
  item: null as HTMLDivElement | null,
}

export const searchbarPlugins = {
  topAnswerArea: null as null | HTMLElement,
  // empties all containers in the searchbar
  clearAll() {
    window.empty(searchbarPlugins.topAnswerArea)
    topAnswer = {
      plugin: null,
      item: null,
    }
    for (let i = 0; i < plugins.length; i++) {
      window.empty(plugins[i].container)
    }
  },

  reset(pluginName: string) {
    window.empty(searchbarPlugins.getContainer(pluginName))

    const ta = searchbarPlugins.getTopAnswer(pluginName)
    if (ta) {
      ta.remove()
      topAnswer = {
        plugin: null,
        item: null,
      }
    }

    results[pluginName] = []
  },

  getTopAnswer(pluginName: string = '') {
    if (pluginName) {
      if (topAnswer.plugin === pluginName) {
        return topAnswer.item
      }
      return null
    }
    return searchbarPlugins.topAnswerArea!.firstChild
  },

  setTopAnswer(pluginName: string, data: DataType) {
    window.empty(searchbarPlugins.topAnswerArea)

    const item = searchbarUtils.createItem(data)
    item.setAttribute('data-plugin', pluginName)
    item.setAttribute('data-url', data.url as string)
    searchbarPlugins.topAnswerArea!.appendChild(item)

    item.addEventListener('click', (e) => {
      URLOpener(data.url as string, e)
    })

    topAnswer = {
      plugin: pluginName,
      item,
    }

    results[pluginName].push(data)
  },

  addResult(pluginName: string, data: DataType, options: { allowDuplicates?: boolean } = {}) {
    if (options.allowDuplicates) {
      data.allowDuplicates = true
    }
    if (data.url && !data.allowDuplicates) {
      // skip duplicates
      for (const plugin in results) {
        for (let i = 0; i < results[plugin].length; i++) {
          if (results[plugin][i].url === data.url && !results[plugin][i].allowDuplicates) {
            return
          }
        }
      }
    }
    const item = searchbarUtils.createItem(data)

    if (data.url) {
      item.setAttribute('data-url', data.url)
      item.addEventListener('click', (e) => {
        URLOpener(data.url as string, e)
      })

      item.addEventListener('keyup', (e) => {
        /*  right arrow or space should autocomplete with selected item if it's
            a search suggestion */
        if (e.keyCode === 39 || e.keyCode === 32) {
          const input = document.getElementById('tab-editor-input') as HTMLInputElement
          input.value = data.url as string
          input.focus()
        }
      })
    }

    searchbarPlugins.getContainer(pluginName)!.appendChild(item)

    results[pluginName].push(data)
  },

  addHeading(pluginName: string, data: DataType) {
    searchbarPlugins.getContainer(pluginName)!.appendChild(searchbarUtils.createHeading(data))
  },

  getContainer(pluginName: string) {
    for (let i = 0; i < plugins.length; i++) {
      if (plugins[i].name === pluginName) {
        return plugins[i].container
      }
    }
    return null
  },

  register(name: string, object: { index: number; trigger?: (arg0: string) => boolean; showResults?: Function }) {
    // add the container
    const searchbar = document.getElementById('searchbar')!

    const container = document.createElement('div')
    container.classList.add('searchbar-plugin-container')
    container.setAttribute('data-plugin', name)
    searchbar.insertBefore(container, searchbar.childNodes[object.index + 2])

    plugins.push({
      name,
      container,
      trigger: object.trigger,
      showResults: object.showResults,
    })

    results[name] = []
  },

  run(text: string, input: any, event: any) {
    for (let i = 0; i < plugins.length; i++) {
      try {
        if (plugins[i].showResults && (!plugins[i].trigger || plugins[i].trigger!(text))) {
          plugins[i].showResults!(text, input, event)
        } else {
          searchbarPlugins.reset(plugins[i].name)
        }
      } catch (e) {
        console.error(`error in searchbar plugin "${plugins[i].name}":`, e)
      }
    }
  },

  registerURLHandler(handler: (arg0: string) => boolean) {
    URLHandlers.push(handler)
  },

  runURLHandlers(text: string) {
    for (let i = 0; i < URLHandlers.length; i++) {
      if (URLHandlers[i](text)) {
        return true
      }
    }
    return false
  },

  getResultCount(pluginName: string = '') {
    if (pluginName) {
      return results[pluginName].length
    }
    let resultCount = 0
    for (const plugin in results) {
      resultCount += results[plugin].length
    }
    return resultCount
  },

  initialize(opener: (arg0: string, arg1: MouseEvent) => boolean) {
    const searchbar = document.getElementById('searchbar')!
    searchbarPlugins.topAnswerArea = searchbar.querySelector('.top-answer-area')
    URLOpener = opener
  },
}

// module.exports = searchbarPlugins
