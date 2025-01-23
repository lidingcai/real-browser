export class TabStack {
  depth = 0

  stack = [] as TabType[]

  constructor(tabStack: TabStack) {
    this.depth = 10
    if (tabStack) {
      this.stack = tabStack.stack
    } else {
      this.stack = []
    }
  }

  push(closedTab: TabType) {
    if (closedTab.private || closedTab.url === '') {
      return
    }
    if (this.stack.length >= this.depth) {
      this.stack.shift()
    }
    this.stack.push(closedTab)
  }

  pop() {
    this.stack.pop()
  }
}
