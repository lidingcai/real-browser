import { TaskList } from './task'

export class TabList {
  tabs: TabType[]

  parentTaskList: TaskList

  constructor(tabs: TabType[], parentTaskList: TaskList) {
    this.tabs = tabs || []
    this.parentTaskList = parentTaskList
  }

  // tab properties that shouldn't be saved to disk

  static temporaryProperties = ['hasAudio', 'previewImage', 'loaded', 'hasBrowserView']

  add(tab: TabType = {}, options: { atEnd: boolean } = { atEnd: false }, emit = true) {
    const tabId = String(tab.id || Math.round(Math.random() * 100000000000000)) // you can pass an id that will be used, or a random one will be generated.

    const newTab = {
      url: tab.url || '',
      title: tab.title || '',
      id: tabId,
      lastActivity: tab.lastActivity || Date.now(),
      secure: tab.secure,
      private: tab.private || false,
      readerable: tab.readerable || false,
      themeColor: tab.themeColor,
      backgroundColor: tab.backgroundColor,
      scrollPosition: tab.scrollPosition || 0,
      selected: tab.selected || false,
      muted: tab.muted || false,
      loaded: tab.loaded || false,
      hasAudio: false,
      previewImage: '',
      isFileView: false,
      hasBrowserView: false,
    }

    if (options.atEnd) {
      this.tabs.push(newTab)
    } else {
      this.tabs.splice(this.getSelectedIndex() + 1, 0, newTab)
    }

    if (emit) {
      this.parentTaskList.emit('tab-added', tabId, newTab, options, this.parentTaskList.getTaskContainingTab(tabId)!.id)
    }

    return tabId
  }

  update(id: string, data: TabType, emit = true) {
    if (!this.has(id)) {
      throw new ReferenceError('Attempted to update a tab that does not exist.')
    }
    const index = this.getIndex(id)

    let key: keyof TabType
    for (key in data) {
      if (data[key] === undefined) {
        throw new ReferenceError(`Key ${key} is undefined.`)
      }
      this.tabs[index][key] = data[key] as any
      if (emit) {
        this.parentTaskList.emit(
          'tab-updated',
          id,
          key,
          data[key as keyof TabType],
          this.parentTaskList.getTaskContainingTab(id)!.id,
        )
      }
      // changing URL erases scroll position
      if (key === 'url') {
        this.tabs[index].scrollPosition = 0
        if (emit) {
          this.parentTaskList.emit(
            'tab-updated',
            id,
            'scrollPosition',
            0,
            this.parentTaskList.getTaskContainingTab(id)!.id,
          )
        }
      }
    }
  }

  destroy(id: string, emit = true) {
    const index = this.getIndex(id)
    if (index < 0) return false

    const containingTask = this.parentTaskList.getTaskContainingTab(id)!.id

    window.tasks.getTaskContainingTab(id)!.tabHistory.push(this.toPermanentState(this.tabs[index]))
    this.tabs.splice(index, 1)

    if (emit) {
      this.parentTaskList.emit('tab-destroyed', id, containingTask)
    }

    return index
  }

  get(id: string = '') {
    if (!id) {
      // no id provided, return an array of all tabs
      // it is important to copy the tab objects when returning them. Otherwise, the original tab objects get modified when the returned tabs are modified (such as when processing a url).
      const tabsToReturn = []
      for (let i = 0; i < this.tabs.length; i++) {
        tabsToReturn.push({ ...this.tabs[i] })
      }
      return tabsToReturn
    }
    for (let i = 0; i < this.tabs.length; i++) {
      if (this.tabs[i].id === id) {
        return { ...this.tabs[i] }
      }
    }
    return undefined
  }

  has(id: string) {
    return this.getIndex(id) > -1
  }

  getIndex(id: string) {
    for (let i = 0; i < this.tabs.length; i++) {
      if (this.tabs[i].id === id) {
        return i
      }
    }
    return -1
  }

  getSelected() {
    for (let i = 0; i < this.tabs.length; i++) {
      if (this.tabs[i].selected) {
        return this.tabs[i].id
      }
    }
    return null
  }

  getSelectedIndex() {
    for (let i = 0; i < this.tabs.length; i++) {
      if (this.tabs[i].selected) {
        return i
      }
    }
    return -1
  }

  getAtIndex(index: number) {
    return this.tabs[index] || undefined
  }

  setSelected(id: string, emit = true) {
    if (!this.has(id)) {
      throw new ReferenceError('Attempted to select a tab that does not exist.')
    }
    for (let i = 0; i < this.tabs.length; i++) {
      if (this.tabs[i].id === id) {
        this.tabs[i].selected = true
        this.tabs[i].lastActivity = Date.now()
      } else if (this.tabs[i].selected) {
        this.tabs[i].selected = false
        this.tabs[i].lastActivity = Date.now()
      }
    }
    if (emit) {
      this.parentTaskList.emit('tab-selected', id, this.parentTaskList.getTaskContainingTab(id)!.id)
    }
  }

  moveBy(id: string, offset: number) {
    const currentIndex = this.getIndex(id)
    const newIndex = currentIndex + offset
    const newIndexTab = this.getAtIndex(newIndex)
    if (newIndexTab) {
      const currentTab = this.getAtIndex(currentIndex)
      this.splice(currentIndex, 1, newIndexTab)
      this.splice(newIndex, 1, currentTab)
    }
    // This doesn't need to dispatch an event because splice will dispatch already
  }

  count() {
    return this.tabs.length
  }

  isEmpty() {
    if (!this.tabs || this.tabs.length === 0) {
      return true
    }

    if (this.tabs.length === 1 && !this.tabs[0].url) {
      return true
    }

    return false
  }

  forEach(fun: (value: TabType, index: number, array: TabType[]) => void) {
    return this.tabs.forEach(fun)
  }

  splice(...args: [start: number, deleteCount: number, ...items: TabType[]]) {
    const containingTask = this.parentTaskList.find((t) => t.tabs === this)!.id

    this.parentTaskList.emit('tab-splice', containingTask, ...args)
    // eslint-disable-next-line prefer-spread
    return this.tabs.splice.apply(this.tabs, args)
  }

  spliceNoEmit(...args: [start: number, deleteCount: number, ...items: TabType[]]) {
    // eslint-disable-next-line prefer-spread
    return this.tabs.splice.apply(this.tabs, args)
  }

  toPermanentState(tab: TabType) {
    // removes temporary properties of the tab that are lost on page reload

    const result: TabType = {}
    Object.keys(tab)
      .filter((key) => !TabList.temporaryProperties.includes(key))
      .forEach((key) => {
        result[key as keyof TabType] = tab[key as keyof TabType] as any
      })

    return result
  }

  getStringifyableState() {
    return this.tabs.map((tab) => this.toPermanentState(tab))
  }
}
