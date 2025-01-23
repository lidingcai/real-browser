import { TaskList } from './tabState/task'

export function initialize() {
  window.tasks = new TaskList()
  // window.tabs = undefined
}
