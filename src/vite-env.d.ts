/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Window {
  electron: import('electron')
  ipc: import('electron').IpcRenderer
  // expose in the `electron/preload/index.ts`
  ipcRenderer: import('electron').IpcRenderer
  fs: import('fs')
  EventEmitter: import('events')
  windowId: string
  globalArgs: Record<string, string> // { 'window-id': string; 'user-data-path': string; 'app-version': string; 'app-name': string }
  platformType: string
  throttle: any
  empty: (HTMLElement) => void
  debounce: any
  tasks: import('./js/tabState/task').TaskList
  tabs: import('./js/tabState/tab').TabList
  isDarkMode: boolean
  currentPasswordManager: { name: string } | null
  createdNewTaskOnStartup: boolean
}

type contrastColorType = { color: string; textColor: string; isLowContrast: boolean }
type TabType = {
  id?: string
  url?: string
  title?: string
  lastActivity?: number
  secure?: boolean
  private?: boolean
  readerable?: boolean
  themeColor?: { color: string; textColor: string; isLowContrast: boolean } | null
  backgroundColor?: contrastColorType | string
  scrollPosition?: number
  selected?: boolean
  muted?: boolean
  hasAudio?: boolean
  loaded?: boolean
  previewImage?: string
  favicon?: string | { url: string; luminance: number }
  isFileView?: boolean
  hasBrowserView?: boolean
  previewImage?: string
}

type TaskType = {
  collapsed?: boolean
  id?: string
  name?: string | null
  tabs?: TabType[] | import('./js/tabState/tab').TabList
  tabHistory?: TabStack
  selectedInWindow?: string | null
}

// searchbar
type DataType = {
  allowDuplicates?: boolean
  url?: string
  text?: string
  title?: string
  metadata?: string[]
  secondaryText?: string
  icon?: string
  image?: string
  iconImage?: string
  descriptionBlock?: string
  attribution?: string
  delete?: Function
  showDeleteButton?: boolean
  button?: { icon: string; fn: Function }
  classList?: string[]
  fakeFocus?: boolean
  colorCircle?: string
  opacity?: number
  click?: (this: HTMLDivElement, ev: MouseEvent) => any
  highlightedTerms?: string[]
}

interface Navigator {
  locale: string
}
