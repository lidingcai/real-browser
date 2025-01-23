// const places = require('places/places.js')

import { l } from '../../locales'
import { places } from '../places/places'
// const bookmarkEditor = require('searchbar/bookmarkEditor.js')
import { bookmarkEditor } from '../searchbar/bookmarkEditor'
// const searchbar = require('searchbar/searchbar.js')
import { searchbar } from '../searchbar/searchbar'
// const searchbarPlugins = require('searchbar/searchbarPlugins.js')
import { searchbarPlugins } from '../searchbar/searchbarPlugins'

export const bookmarkStar = {
  create() {
    const star = document.createElement('button')
    star.className = 'tab-editor-button bookmarks-button i carbon:star'
    star.setAttribute('aria-pressed', 'false')
    star.setAttribute('title', l('addBookmark'))
    star.setAttribute('aria-label', l('addBookmark'))

    star.addEventListener('click', (_e) => {
      bookmarkStar.onClick(star)
    })

    return star
  },
  onClick(star: HTMLButtonElement) {
    const tabId = star.getAttribute('data-tab') as string

    searchbarPlugins.clearAll()

    places.updateItem(
      (window.tabs.get(tabId) as TabType).url as string,
      {
        isBookmarked: true,
        title: (window.tabs.get(tabId) as TabType).title, // if this page is open in a private tab, the title may not be saved already, so it needs to be included here
      },
      () => {
        star.classList.remove('carbon:star')
        star.classList.add('carbon:star-filled')
        star.setAttribute('aria-pressed', 'true')

        const editorInsertionPoint = document.createElement('div')
        searchbarPlugins.getContainer('simpleBookmarkTagInput')!.appendChild(editorInsertionPoint)
        bookmarkEditor.show(
          (window.tabs.get(window.tabs.getSelected() as string) as TabType).url as string,
          editorInsertionPoint,
          (newBookmark: boolean) => {
            if (!newBookmark) {
              // bookmark was deleted
              star.classList.add('carbon:star')
              star.classList.remove('carbon:star-filled')
              star.setAttribute('aria-pressed', 'false')
              searchbar.showResults('')
              searchbar.associatedInput!.focus()
            }
          },
          { simplified: true, autoFocus: true },
        )
      },
    )
  },
  update(tabId: string, star: HTMLButtonElement) {
    star.setAttribute('data-tab', tabId)
    const currentURL = (window.tabs.get(tabId) as TabType).url

    if (!currentURL) {
      // no url, can't be bookmarked
      star.hidden = true
    } else {
      star.hidden = false
    }

    // check if the page is bookmarked or not, and update the star to match

    places.getItem(currentURL as string, (item: { isBookmarked: any }) => {
      if (item && item.isBookmarked) {
        star.classList.remove('carbon:star')
        star.classList.add('carbon:star-filled')
        star.setAttribute('aria-pressed', 'true')
      } else {
        star.classList.add('carbon:star')
        star.classList.remove('carbon:star-filled')
        star.setAttribute('aria-pressed', 'false')
      }
    })
  },
  initialize() {
    searchbarPlugins.register('simpleBookmarkTagInput', {
      index: 0,
    })
  },
}
/*
searchbarPlugins.register('simpleBookmarkTagInput', {
  index: 0,
})
*/
// module.exports = bookmarkStar
