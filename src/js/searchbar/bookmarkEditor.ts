// var places = require('places/places.js')
// var { ipcRenderer } = require('electron')
import { ipcRenderer } from 'electron'

import { l } from '../../locales/index'
import { places } from '../places/places'
// const remoteMenu = require('remoteMenuRenderer.js')
import * as remoteMenu from '../remoteMenuRenderer'
// var autocomplete = require('util/autocomplete.js')
import { autocomplete } from '../util/autocomplete'

type OptionsType = {
  autoRemove?: boolean
  onModify?: Function
  simplified?: boolean
  autoFocus?: boolean
}
export const bookmarkEditor = {
  currentInstance: null as null | {
    editor?: HTMLDivElement
    onClose?: Function
    bookmark?: { url: string; title: string; tags: string[] }
  },
  getTagElement(tag: string, selected: boolean, onClick: Function, options: OptionsType = {}) {
    const el = document.createElement('button')
    el.className = 'tag'
    el.textContent = tag
    if (selected) {
      el.classList.add('selected')
      el.setAttribute('aria-pressed', 'true')
    } else {
      el.classList.add('suggested')
      el.setAttribute('aria-pressed', 'false')
    }
    el.addEventListener('click', () => {
      onClick()
      if (el.classList.contains('selected') && options.autoRemove !== false) {
        el.remove()
      } else {
        el.classList.remove('suggested')
        el.classList.add('selected')
      }
    })
    if (options.onModify) {
      el.addEventListener('contextmenu', () => {
        remoteMenu.open([
          [
            {
              label: l('bookmarksRenameTag'),
              click() {
                const res = ipcRenderer.sendSync('prompt', {
                  text: '',
                  values: [{ placeholder: l('bookmarksRenameTag'), id: 'name', type: 'text' }],
                  ok: l('dialogConfirmButton'),
                  cancel: l('dialogSkipButton'),
                  width: 500,
                  height: 140,
                })

                if (!res || !res.name) {
                  return
                }

                const newName = res.name

                places.getAllItems((items: { tags: string[]; url: string }[]) => {
                  items.forEach((item: { tags: string[]; url: string }) => {
                    if (item.tags.includes(tag)) {
                      item.tags = item.tags.filter((t) => t !== tag)
                      item.tags.push(newName)
                      places.updateItem(item.url, { tags: item.tags })
                    }
                  })
                  setTimeout(() => {
                    options.onModify!()
                  }, 50)
                })
              },
            },
            {
              label: l('bookmarksDeleteTag'),
              click() {
                places.getAllItems((items: { tags: string[]; url: string }[]) => {
                  items.forEach((item: { tags: string[]; url: string }) => {
                    if (item.tags.includes(tag)) {
                      item.tags = item.tags.filter((t: string) => t !== tag)
                      places.updateItem(item.url, { tags: item.tags })
                    }
                  })
                  setTimeout(() => {
                    options.onModify!()
                  }, 50)
                })
              },
            },
            {
              label: l('deleteBookmarksWithTag'),
              click() {
                places.getAllItems((items: { tags: string[]; url: string }[]) => {
                  items.forEach((item: { tags: string[]; url: string }) => {
                    if (item.tags.includes(tag)) {
                      places.deleteHistory(item.url)
                    }
                  })
                  setTimeout(() => {
                    options.onModify!()
                  }, 50)
                })
              },
            },
          ],
        ])
      })
    }
    return el
  },
  async render(url: string, options: OptionsType = {}) {
    bookmarkEditor.currentInstance = {}
    // TODO make places API return a promise
    bookmarkEditor.currentInstance.bookmark = await new Promise((resolve, _reject) => {
      places.getItem(url, (item: any) => resolve(item))
    })

    const editor = document.createElement('div')
    editor.className = 'bookmark-editor searchbar-item'

    if (options.simplified) {
      editor.className += ' simplified'
    }

    if (!options.simplified) {
      // title input
      const title = document.createElement('span')
      title.className = 'title wide'
      title.textContent = bookmarkEditor.currentInstance.bookmark!.title
      editor.appendChild(title)

      // URL
      const URLSpan = document.createElement('div')
      URLSpan.className = 'bookmark-url'
      URLSpan.textContent = bookmarkEditor.currentInstance.bookmark!.url
      editor.appendChild(URLSpan)
    }

    // tag area
    const tagArea = document.createElement('div')
    tagArea.className = 'tag-edit-area'
    editor.appendChild(tagArea)

    if (!options.simplified) {
      // save button
      const saveButton = document.createElement('button')
      saveButton.className = 'action-button always-visible i carbon:checkmark'
      saveButton.tabIndex = -1
      editor.appendChild(saveButton)
      saveButton.addEventListener('click', () => {
        editor.remove()
        bookmarkEditor.currentInstance!.onClose!(bookmarkEditor.currentInstance!.bookmark)
        bookmarkEditor.currentInstance = null
      })
    }

    // delete button
    const delButton = document.createElement('button')
    delButton.className = 'action-button always-visible bookmark-delete-button i carbon:trash-can'
    delButton.tabIndex = -1
    editor.appendChild(delButton)
    delButton.addEventListener('click', () => {
      editor.remove()
      bookmarkEditor.currentInstance!.onClose!(null)
      bookmarkEditor.currentInstance = null
    })

    const tags = {
      selected: [] as string[],
      suggested: [] as string[],
    }

    // show tags
    bookmarkEditor.currentInstance.bookmark!.tags.forEach((tag) => {
      tagArea.appendChild(
        bookmarkEditor.getTagElement(tag, true, () => {
          places.toggleTag(bookmarkEditor.currentInstance!.bookmark!.url, tag)
        }),
      )
    })
    tags.selected = bookmarkEditor.currentInstance.bookmark!.tags

    places.getSuggestedTags(bookmarkEditor.currentInstance.bookmark!.url, (suggestions: ConcatArray<string>) => {
      tags.suggested = tags.suggested.concat(suggestions)

      tags.suggested
        .filter((tag, idx) => {
          return tags.suggested.indexOf(tag) === idx && !tags.selected.includes(tag)
        })
        .slice(0, 3)
        .forEach((tag, _idx) => {
          tagArea.appendChild(
            bookmarkEditor.getTagElement(tag, false, () => {
              places.toggleTag(bookmarkEditor.currentInstance!.bookmark!.url, tag)
            }),
          )
        })
      // add option for new tag
      const newTagInput = document.createElement('input')
      newTagInput.className = 'tag-input'
      newTagInput.placeholder = l('bookmarksAddTag')
      newTagInput.classList.add('mousetrap')
      newTagInput.spellcheck = false
      tagArea.appendChild(newTagInput)

      newTagInput.addEventListener('keypress', (e) => {
        if (e.keyCode !== 8 && e.keyCode !== 13) {
          places.getAllTagsRanked(bookmarkEditor.currentInstance!.bookmark!.url, (results: any[]) => {
            autocomplete(
              newTagInput,
              results.map((r) => r.tag),
            )
          })
        }
      })

      // eslint-disable-next-line func-names
      newTagInput.addEventListener('change', function () {
        const val = this.value
        if (!tags.selected.includes(val)) {
          places.toggleTag(bookmarkEditor.currentInstance!.bookmark!.url, val)
          tagArea.insertBefore(
            bookmarkEditor.getTagElement(val, true, () => {
              places.toggleTag(bookmarkEditor.currentInstance!.bookmark!.url, val)
            }),
            tagArea.firstElementChild,
          )
        }
        this.value = ''
      })

      if (options.autoFocus) {
        newTagInput.focus()
      }
    })

    return editor
  },
  show(url: string, replaceItem: HTMLElement, onClose: Function, options: OptionsType) {
    if (bookmarkEditor.currentInstance) {
      if (bookmarkEditor.currentInstance.editor && bookmarkEditor.currentInstance.editor.parentNode) {
        bookmarkEditor.currentInstance.editor.remove()
      }
      if (bookmarkEditor.currentInstance.onClose) {
        bookmarkEditor.currentInstance.onClose(bookmarkEditor.currentInstance.bookmark)
      }
      bookmarkEditor.currentInstance = null
    }
    bookmarkEditor.render(url, options).then((editor) => {
      replaceItem.hidden = true
      replaceItem.parentNode!.insertBefore(editor, replaceItem)
      bookmarkEditor.currentInstance!.editor = editor
      bookmarkEditor.currentInstance!.onClose = onClose
    })
  },
}

// module.exports = bookmarkEditor
