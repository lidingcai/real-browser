import { ipcRenderer as ipc } from 'electron'

window.globalArgs = {}

process.argv.forEach((arg) => {
  if (arg.startsWith('--')) {
    const key = arg.split('=')[0].replace('--', '')
    const value = arg.split('=')[1]
    window.globalArgs[key] = value
  }
})

window.windowId = window.globalArgs['window-id']
if (navigator.platform === 'MacIntel') {
  document.body.classList.add('mac')
  window.platformType = 'mac'
} else if (navigator.platform === 'Win32') {
  document.body.classList.add('windows')
  window.platformType = 'windows'
} else {
  document.body.classList.add('linux')
  window.platformType = 'linux'
}
if (navigator.maxTouchPoints > 0) {
  document.body.classList.add('touch')
}

/* add classes so that the window state can be used in CSS */
ipc.on('enter-full-screen', () => {
  document.body.classList.add('fullscreen')
})

ipc.on('leave-full-screen', () => {
  document.body.classList.remove('fullscreen')
})

ipc.on('maximize', () => {
  document.body.classList.add('maximized')
})

ipc.on('unmaximize', () => {
  document.body.classList.remove('maximized')
})

document.body.classList.add('focused')

ipc.on('focus', () => {
  document.body.classList.add('focused')
})

ipc.on('blur', () => {
  document.body.classList.remove('focused')
})

// https://remysharp.com/2010/07/21/throttling-function-calls

// eslint-disable-next-line func-names
window.throttle = function (
  fn: { apply: (arg0: any, arg1: IArguments) => void },
  threshhold: number | undefined,
  scope: Window & typeof globalThis,
) {
  // eslint-disable-next-line no-unused-expressions
  threshhold || (threshhold = 250)
  let last = 0
  let deferTimer: string | number | NodeJS.Timeout | undefined
  return () => {
    const context = scope || this

    const now = +new Date()
    // eslint-disable-next-line prefer-rest-params
    const args = arguments
    if (last && now < last + (threshhold as number)) {
      // hold on to it
      clearTimeout(deferTimer)
      deferTimer = setTimeout(() => {
        last = now
        fn.apply(context, args)
      }, threshhold)
    } else {
      last = now
      fn.apply(context, args)
    }
  }
}

// https://remysharp.com/2010/07/21/throttling-function-calls

// eslint-disable-next-line func-names
window.debounce = function (fn: Function, delay: number) {
  let timer: string | number | NodeJS.Timeout = 0
  // eslint-disable-next-line func-names
  return function (this: any) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const context = this
    // eslint-disable-next-line prefer-rest-params
    const args = arguments
    clearTimeout(timer)
    // eslint-disable-next-line func-names
    timer = setTimeout(function () {
      fn.apply(context, args)
    }, delay)
  }
}

window.empty = (node: HTMLElement) => {
  let n
  // eslint-disable-next-line no-cond-assign
  while ((n = node.firstElementChild)) {
    node.removeChild(n)
  }
}

/* prevent a click event from firing after dragging the window */

window.addEventListener('load', () => {
  let isMouseDown = false
  let isDragging = false
  let distance = 0

  document.body.addEventListener('mousedown', () => {
    isMouseDown = true
    isDragging = false
    distance = 0
  })

  document.body.addEventListener('mouseup', () => {
    isMouseDown = false
  })

  const dragHandles = document.getElementsByClassName('windowDragHandle')

  for (let i = 0; i < dragHandles.length; i++) {
    // eslint-disable-next-line no-loop-func
    dragHandles[i].addEventListener('mousemove', (e: Event) => {
      if (isMouseDown) {
        isDragging = true
        distance += Math.abs((e as MouseEvent).movementX) + Math.abs((e as MouseEvent).movementY)
      }
    })
  }

  document.body.addEventListener(
    'click',
    (e) => {
      if (isDragging && distance >= 10.0) {
        e.stopImmediatePropagation()
        isDragging = false
      }
    },
    true,
  )
})
