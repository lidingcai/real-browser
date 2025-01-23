import { TabStack } from '../tabRestore'
import { TabList } from './tab'

export class TaskList {
  tasks: TaskType[]

  events: { name: string; fn: Function }[]

  pendingCallbacks: [Function, string[]][]

  pendingCallbackTimeout: null | NodeJS.Timeout

  constructor() {
    this.tasks = [] // each task is {id, name, tabs: [], tabHistory: TabStack}
    this.events = []
    this.pendingCallbacks = []
    this.pendingCallbackTimeout = null
  }

  on(name: string, fn: Function) {
    this.events.push({ name, fn })
  }

  static temporaryProperties = ['selectedInWindow']

  emit(name: string, ...data: any[]) {
    this.events.forEach((listener) => {
      if (listener.name === name || listener.name === '*') {
        this.pendingCallbacks.push([listener.fn, (listener.name === '*' ? [name] : []).concat(data)])

        // run multiple events in one timeout, since calls to setTimeout() appear to be slow (at least based on timeline data)
        if (!this.pendingCallbackTimeout) {
          this.pendingCallbackTimeout = setTimeout(() => {
            this.pendingCallbacks.forEach((t) => t[0].apply(this, t[1] as []))
            this.pendingCallbacks = []
            this.pendingCallbackTimeout = null
          }, 0)
        }
      }
    })
  }

  add(task: TaskType = {}, index: number = 0, emit = true) {
    const newTask = {
      name: task.name || null,
      tabs: new TabList(task.tabs as TabType[], this),
      tabHistory: new TabStack(task.tabHistory),
      collapsed: task.collapsed, // this property must stay undefined if it is already (since there is a difference between "explicitly uncollapsed" and "never collapsed")
      id: task.id || String(TaskList.getRandomId()),
      selectedInWindow: task.selectedInWindow || null,
    }

    if (index) {
      this.tasks.splice(index, 0, newTask)
    } else {
      this.tasks.push(newTask)
    }

    if (emit) {
      this.emit('task-added', newTask.id, { ...newTask, tabHistory: task.tabHistory, tabs: task.tabs }, index)
    }

    return newTask.id
  }

  update(id: string, data: TaskType, emit = true) {
    const task = this.get(id)

    if (!task) {
      throw new ReferenceError('Attempted to update a task that does not exist.')
    }

    for (const key in data) {
      if (data[key as keyof TaskType] === undefined) {
        throw new ReferenceError(`Key ${key} is undefined.`)
      }
      task[key as keyof TaskType] = data[key as keyof TaskType] as any
      if (emit) {
        this.emit('task-updated', id, key, data[key as keyof TaskType])
      }
    }
  }

  getStringifyableState() {
    return {
      tasks: this.tasks
        .map((task) => ({ ...task, tabs: (task.tabs as TabList).getStringifyableState() }))
        .map((task) => {
          // remove temporary properties from task
          const result: TaskType = {
            collapsed: false,
            id: '',
            name: null,
            tabs: undefined,
            tabHistory: undefined,
            selectedInWindow: null,
          }
          const keys = Object.keys(task) as (keyof TaskType)[]
          keys
            .filter((key) => !TaskList.temporaryProperties.includes(key))
            // eslint-disable-next-line no-return-assign
            .forEach((key) => {
              result[key] = task[key]
            })
          return result
        }),
    }
  }

  getCopyableState() {
    return {
      tasks: this.tasks.map((task) => ({ ...task, tabs: (task.tabs as TabList).tabs })),
    }
  }

  get(id: string) {
    return this.find((task) => task.id === id) || null
  }

  getSelected() {
    return this.find((task) => task.selectedInWindow === window.windowId)
  }

  byIndex(index: number) {
    return this.tasks[index]
  }

  getTaskContainingTab(tabId: string) {
    return this.find((task) => (task.tabs as TabList).has(tabId)) || null
  }

  getIndex(id: string) {
    return this.tasks.findIndex((task) => task.id === id)
  }

  setSelected(id: string, emit = true, onWindow = window.windowId) {
    for (let i = 0; i < this.tasks.length; i++) {
      if (this.tasks[i].selectedInWindow === onWindow) {
        this.tasks[i].selectedInWindow = null
      }
      if (this.tasks[i].id === id) {
        this.tasks[i].selectedInWindow = onWindow
      }
    }
    if (onWindow === window.windowId) {
      window.tabs = this.get(id)!.tabs! as TabList
      if (emit) {
        this.emit('task-selected', id)
        if ((window.tabs as TabList).getSelected()) {
          this.emit('tab-selected', (window.tabs as TabList).getSelected() as string, id)
        }
      }
    }
  }

  destroy(id: string, emit = true) {
    const index = this.getIndex(id)

    if (emit) {
      // emit the tab-destroyed event for all tabs in this task
      this.get(id)!.tabs!.forEach((tab: TabType) => this.emit('tab-destroyed', tab.id as string, id))

      this.emit('task-destroyed', id)
    }

    if (index < 0) return false

    this.tasks.splice(index, 1)

    return index
  }

  getLastActivity(id: string) {
    const tabs = this.get(id)!.tabs! as TabList
    let lastActivity = 0

    for (let i = 0; i < tabs.count(); i++) {
      if (tabs.getAtIndex(i).lastActivity! > lastActivity) {
        lastActivity = tabs.getAtIndex(i).lastActivity!
      }
    }

    return lastActivity
  }

  isCollapsed(id: string) {
    const task = this.get(id)!
    return (
      task.collapsed ||
      (task.collapsed === undefined && Date.now() - window.tasks.getLastActivity(task.id!) > 7 * 24 * 60 * 60 * 1000)
    )
  }

  getLength() {
    return this.tasks.length
  }
  /*
  map(fun) {
    return this.tasks.map(fun)
  }

  forEach(fun) {
    return this.tasks.forEach(fun)
  }

  indexOf(task) {
    return this.tasks.indexOf(task)
  }

  slice(...args) {
    return this.tasks.slice.apply(this.tasks, args)
  }

  splice(...args) {
    return this.tasks.splice.apply(this.tasks, args)
  }
*/

  map(fun: (value: TaskType, index: number, array: TaskType[]) => unknown) {
    return this.tasks.map(fun)
  }

  forEach(fun: (value: TaskType, index: number, array: TaskType[]) => void) {
    return this.tasks.forEach(fun)
  }

  indexOf(task: TaskType) {
    return this.tasks.indexOf(task)
  }

  slice(...args: [start?: number | undefined, end?: number | undefined]) {
    // eslint-disable-next-line prefer-spread
    return this.tasks.slice.apply(this.tasks, args)
  }

  splice(...args: [start: number, deleteCount: number, ...items: TaskType[]]) {
    // eslint-disable-next-line prefer-spread
    return this.tasks.splice.apply(this.tasks, args)
  }

  /*
  filter(...args: any[]) {
    // eslint-disable-next-line prefer-spread
    return this.tasks.filter.apply(this.tasks, args)
  }
  */
  filter(...args: [predicate: (value: TaskType, index: number, array: TaskType[]) => unknown, thisArg?: any]) {
    // eslint-disable-next-line prefer-spread
    return this.tasks.filter.apply(this.tasks, args)
  }

  find(filter: (arg1: TaskType, arg2: number, arg3: TaskType[]) => boolean) {
    for (let i = 0, len = this.tasks.length; i < len; i++) {
      if (filter(this.tasks[i], i, this.tasks)) {
        return this.tasks[i]
      }
    }
    return undefined
  }

  static getRandomId() {
    return Math.round(Math.random() * 100000000000000000)
  }
}
