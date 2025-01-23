// var searchbar = require('searchbar/searchbar.js')
// var tabEditor = require('navbar/tabEditor.js')

import { l } from '../../locales'
import { tabEditor } from '../navbar/tabEditor'
// var places = require('places/places.js')
import { places } from '../places/places'
// var formatRelativeDate = require('util/relativeDate.js')
import { formatRelativeDate } from '../util/relativeDate'
// var urlParser = require('util/urlParser.js')
import { urlParser } from '../util/urlParser'
// var bangsPlugin = require('searchbar/bangsPlugin.js')
import * as bangsPlugin from './bangsPlugin'
// var bookmarkEditor = require('searchbar/bookmarkEditor.js')
import { bookmarkEditor } from './bookmarkEditor'
import { searchbar } from './searchbar'
// var searchbarPlugins = require('searchbar/searchbarPlugins.js')
import { searchbarPlugins } from './searchbarPlugins'
// var searchbarUtils = require('searchbar/searchbarUtils.js')
import * as searchbarUtils from './searchbarUtils'

interface ItemType {
  url: string
  title: string
  tags: string[]
  lastVisit: number
}
const maxTagSuggestions = 12

function parseBookmarkSearch(text: string) {
  const tags = text
    .split(/\s/g)
    .filter((word) => {
      return word.startsWith('#') && word.length > 1
    })
    .map((t) => t.substring(1))

  let newText = text
  tags.forEach((word) => {
    newText = newText.replace(`#${word}`, '')
  })
  newText = newText.trim()
  return {
    tags,
    text: newText,
  }
}

function itemMatchesTags(item: ItemType, tags: string[]) {
  for (let i = 0; i < tags.length; i++) {
    if (!item.tags.filter((t: string) => t.startsWith(tags[i])).length) {
      return false
    }
  }
  return true
}

function showBookmarkEditor(url: string, item: HTMLElement) {
  bookmarkEditor.show(
    url,
    item,
    (newBookmark: ItemType) => {
      if (newBookmark) {
        if (item.parentNode) {
          // item could be detached from the DOM if the searchbar is closed
          item.parentNode.replaceChild(searchbarUtils.createItem(getBookmarkListItemData(newBookmark)), item)
        }
      } else {
        places.deleteHistory(url)
        item.remove()
      }
    },
    {},
  )
}

function getBookmarkListItemData(result: ItemType, focus: boolean = false) {
  return {
    title: result.title,
    secondaryText: urlParser.basicURL(urlParser.getSourceURL(result.url)),
    fakeFocus: focus,
    click(e: KeyboardEvent | MouseEvent | undefined) {
      searchbar.openURL(result.url, e)
    },
    classList: ['bookmark-item'],
    delete() {
      places.deleteHistory(result.url)
    },
    button: {
      icon: 'carbon:edit',
      fn(el: { parentNode: HTMLElement }) {
        showBookmarkEditor(result.url, el.parentNode)
      },
    },
  }
}

export const bookmarkManager = {
  showBookmarks(text: string, input: HTMLInputElement, event: Event) {
    const container = searchbarPlugins.getContainer('bangs')!

    const lazyList = searchbarUtils.createLazyList(container.parentNode as Element)

    const parsedText = parseBookmarkSearch(text)

    const displayedURLset: string[] = []
    places.searchPlaces(
      parsedText.text,
      (results: ItemType[]) => {
        places.autocompleteTags(parsedText.tags, (suggestedTags: string[]) => {
          searchbarPlugins.reset('bangs')

          const tagBar = document.createElement('div')
          tagBar.id = 'bookmark-tag-bar'
          container.appendChild(tagBar)

          parsedText.tags.forEach((tag) => {
            tagBar.appendChild(
              bookmarkEditor.getTagElement(
                tag,
                true,
                () => {
                  tabEditor.show(window.tabs.getSelected()!, `!bookmarks ${text.replace(`#${tag}`, '').trim()}`)
                },
                {
                  autoRemove: false,
                  onModify: () => bookmarkManager.showBookmarks(text, input, event),
                },
              ),
            )
          })
          // it doesn't make sense to display tag suggestions if there's a search, since the suggestions are generated without taking the search into account
          if (!parsedText.text) {
            suggestedTags.forEach((suggestion: string, index: number) => {
              const el = bookmarkEditor.getTagElement(
                suggestion,
                false,
                () => {
                  const needsSpace = text.slice(-1) !== ' ' && text.slice(-1) !== ''
                  tabEditor.show(
                    window.tabs.getSelected()!,
                    `!bookmarks ${text}${needsSpace ? ' #' : '#'}${suggestion} `,
                  )
                },
                {
                  onModify: () => bookmarkManager.showBookmarks(text, input, event),
                },
              )
              if (index >= maxTagSuggestions) {
                el.classList.add('overflowing')
              }
              tagBar.appendChild(el)
            })

            if (suggestedTags.length > maxTagSuggestions) {
              const expandEl = bookmarkEditor.getTagElement('\u2026', false, () => {
                tagBar.classList.add('expanded')
                expandEl.remove()
              })
              tagBar.appendChild(expandEl)
            }
          }

          let lastRelativeDate = '' // used to generate headings

          results
            .filter((result: ItemType) => {
              if (itemMatchesTags(result, parsedText.tags)) {
                return true
              }
              return false
            })
            .sort((a, b) => {
              // order by last visit
              return b.lastVisit - a.lastVisit
            })
            .forEach((result, index) => {
              displayedURLset.push(result.url)

              const thisRelativeDate = formatRelativeDate(result.lastVisit)
              if (thisRelativeDate !== lastRelativeDate) {
                searchbarPlugins.addHeading('bangs', { text: thisRelativeDate })
                lastRelativeDate = thisRelativeDate
              }

              const itemData = getBookmarkListItemData(result, index === 0 && !!parsedText.text)
              const placeholder = lazyList.createPlaceholder()
              container.appendChild(placeholder)
              lazyList.lazyRenderItem(placeholder, itemData)
            })

          if (text === '' && results.length < 3) {
            container.appendChild(
              searchbarUtils.createItem({
                title: l('importBookmarks'),
                icon: 'carbon:upload',
                click() {
                  searchbar.openURL('!importbookmarks', undefined)
                },
              }),
            )
          }

          if (parsedText.tags.length > 0) {
            places.getSuggestedItemsForTags(parsedText.tags, (suggestedResults: ItemType[]) => {
              suggestedResults = suggestedResults.filter((res: ItemType) => !displayedURLset.includes(res.url))
              if (suggestedResults.length === 0) {
                return
              }
              searchbarPlugins.addHeading('bangs', { text: l('bookmarksSimilarItems') })
              suggestedResults.forEach((result: ItemType, _index: number) => {
                const item = searchbarUtils.createItem(getBookmarkListItemData(result, false))
                container.appendChild(item)
              })
            })
          }
        })
      },
      {
        searchBookmarks: true,
        limit: Infinity,
      },
    )
  },
  initialize() {
    bangsPlugin.registerCustomBang({
      phrase: '!bookmarks',
      snippet: l('searchBookmarks'),
      isAction: false,
      showSuggestions: bookmarkManager.showBookmarks,
      fn(text: string) {
        const parsedText = parseBookmarkSearch(text)
        if (!parsedText.text) {
          return
        }
        places.searchPlaces(
          parsedText.text,
          (results: ItemType[]) => {
            results = results
              .filter((r) => itemMatchesTags(r, parsedText.tags))
              .sort((a, b) => {
                return b.lastVisit - a.lastVisit
              })
            if (results.length !== 0) {
              searchbar.openURL(results[0].url, undefined)
            }
          },
          { searchBookmarks: true },
        )
      },
    })
  },
}

// module.exports = bookmarkManager
