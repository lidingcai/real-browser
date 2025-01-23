/* Handles importing / exporting bookmarks to HTML */

// var places = require('places/places.js')
// var path = require('path')
// var fs = require('fs')
import fs from 'node:fs'
import path from 'node:path'

import { places } from './places/places'
// var settings = require('util/settings/settings.js')
import { settings } from './util/settings/settings'
// var urlParser = require('util/urlParser.js')
import { urlParser } from './util/urlParser'

interface PlacesDataType {
  title: string
  isBookmarked: boolean
  tags: string[]
  lastVisit: number
  url: string
}
export const bookmarkConverter = {
  import(data: string) {
    const tree = new DOMParser().parseFromString(data, 'text/html')
    const bookmarks = Array.from(tree.getElementsByTagName('a'))
    bookmarks.forEach((bookmark) => {
      const url = bookmark.getAttribute('href')
      if (!url || (!url.startsWith('http:') && !url.startsWith('https:') && !url.startsWith('file:'))) {
        return
      }

      const data = {
        title: bookmark.textContent,
        isBookmarked: true,
        tags: [] as string[],
        lastVisit: Date.now(),
      }
      try {
        const last = parseInt(bookmark.getAttribute('add_date')!, 10) * 1000
        if (!Number.isNaN(last)) {
          data.lastVisit = last
        }
      } catch (e) {
        //
      }

      let parent = bookmark.parentElement
      while (parent != null) {
        if (parent.children[0] && parent.children[0].tagName === 'H3') {
          data.tags.push(parent.children[0].textContent!.replace(/\s/g, '-'))
          break
        }
        parent = parent.parentElement
      }
      if (bookmark.getAttribute('tags')) {
        data.tags = data.tags.concat(bookmark.getAttribute('tags')!.split(','))
      }
      places.updateItem(url, data, () => {})
    })
  },
  exportAll(): Promise<string> {
    return new Promise((resolve, _reject) => {
      // build the tree structure
      const root = document.createElement('body')
      const heading = document.createElement('h1')
      heading.textContent = 'Bookmarks'
      root.appendChild(heading)
      const innerRoot = document.createElement('dl')
      root.appendChild(innerRoot)

      const folderRoot = document.createElement('dt')
      innerRoot.appendChild(folderRoot)
      // var folderHeading = document.createElement('h3')
      // folderHeading.textContent = 'Min Bookmarks'
      // folderRoot.appendChild(folderHeading)
      const folderBookmarksList = document.createElement('dl')
      folderRoot.appendChild(folderBookmarksList)

      places.getAllItems((items: PlacesDataType[]) => {
        items.forEach((item: PlacesDataType) => {
          if (item.isBookmarked) {
            const itemRoot = document.createElement('dt')
            const a = document.createElement('a')
            itemRoot.appendChild(a)
            folderBookmarksList.appendChild(itemRoot)

            a.href = urlParser.getSourceURL(item.url)
            a.setAttribute('add_date', Math.round(item.lastVisit / 1000) as unknown as string)
            if (item.tags.length > 0) {
              a.setAttribute('tags', item.tags.join(','))
            }
            a.textContent = item.title
            // Chrome will only parse the file if it contains newlines after each bookmark
            const textSpan = document.createTextNode('\n')
            folderBookmarksList.appendChild(textSpan)
          }
        })

        resolve(root.outerHTML)
      })
    })
  },
  initialize() {
    // how often to create a new backup file
    const interval = 3 * 24 * 60 * 60 * 1000
    // min size in bytes for a backup
    // This is necessary because after the database is destroyed, the browser will launch with no bookmarks
    // and the bookmarks backup shouldn't be overwritten in that case
    const minSize = 512

    const checkAndExport = () => {
      if (!settings.get('lastBookmarksBackup') || Date.now() - settings.get('lastBookmarksBackup') > interval) {
        bookmarkConverter
          .exportAll()
          .then((res) => {
            if (res.length > minSize) {
              fs.writeFile(
                path.join(window.globalArgs['user-data-path'], 'bookmarksBackup.html'),
                res,
                { encoding: 'utf-8' },
                (err) => {
                  if (err) {
                    console.warn(err)
                  }
                },
              )
              settings.set('lastBookmarksBackup', Date.now())
            }
          })
          .catch((e) => console.warn('error generating bookmarks backup', e))
      }
    }

    setTimeout(checkAndExport, 10000)
    setInterval(checkAndExport, interval / 3)
  },
}

// module.exports = bookmarkConverter
