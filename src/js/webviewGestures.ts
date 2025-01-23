// var webviews = require('webviews.js')
import { webviews } from './webviews'

export const webviewGestures = {
  showBackArrow() {
    // this is temporarily disabled until we find a way to make it work with BrowserViews
    /*
    const backArrow = document.getElementById('leftArrowContainer')
    backArrow.classList.toggle('shown')
    backArrow.classList.toggle('animating')
    setTimeout(function () {
      backArrow.classList.toggle('shown')
    }, 600)
    setTimeout(function () {
      backArrow.classList.toggle('animating')
    }, 900)
    */
  },
  showForwardArrow() {
    // this is temporarily disabled until we find a way to make it work with BrowserViews
    /*
    const forwardArrow = document.getElementById('rightArrowContainer')
    forwardArrow.classList.toggle('shown')
    forwardArrow.classList.toggle('animating')
    setTimeout(function () {
      forwardArrow.classList.toggle('shown')
    }, 600)
    setTimeout(function () {
      forwardArrow.classList.toggle('animating')
    }, 900)
    */
  },
  zoomWebviewBy(tabId: string, amt: number) {
    webviews.callAsync(tabId, 'zoomFactor', (_err: any, oldFactor: number) => {
      webviews.callAsync(tabId, 'zoomFactor', Math.min(webviewMaxZoom, Math.max(webviewMinZoom, oldFactor + amt)))
    })
  },
  zoomWebviewIn(tabId: string) {
    return this.zoomWebviewBy(tabId, 0.2)
  },
  zoomWebviewOut(tabId: string) {
    return this.zoomWebviewBy(tabId, -0.2)
  },
  resetWebviewZoom(tabId: string) {
    webviews.callAsync(tabId, 'zoomFactor', 1.0)
  },
}

let swipeGestureDistanceResetTimeout: number | NodeJS.Timeout = -1
let swipeGestureScrollResetTimeout: number | NodeJS.Timeout = -1
let swipeGestureLowVelocityTimeout: number | NodeJS.Timeout = -1
const swipeGestureDelay = 100 // delay before gesture is complete
const swipeGestureScrollDelay = 750
const swipeGestureVelocityDelay = 70 // the time (in ms) that can elapse without a minimum amount of movement before the gesture is considered almost completed

let horizontalMouseMove = 0
let verticalMouseMove = 0

let leftMouseMove = 0
let rightMouseMove = 0

let beginningScrollLeft: number | null = null
let beginningScrollRight: number | null = null
let isInFrame = false

let hasShownSwipeArrow = false

let initialZoomKeyState: boolean | null = null
let initialSecondaryKeyState: boolean | null = null

const webviewMinZoom = 0.5
const webviewMaxZoom = 3.0

function resetDistanceCounters() {
  horizontalMouseMove = 0
  verticalMouseMove = 0
  leftMouseMove = 0
  rightMouseMove = 0

  hasShownSwipeArrow = false

  initialZoomKeyState = null
  initialSecondaryKeyState = null
}

function resetScrollCounters() {
  beginningScrollLeft = null
  beginningScrollRight = null
  isInFrame = false
}

function onSwipeGestureLowVelocity() {
  // we can't detect scroll position in an iframe, so never trigger a back gesture from it
  if (isInFrame) {
    return
  }

  webviews.callAsync(window.tabs.getSelected()!, 'getZoomFactor', (_err: any, result: number) => {
    const minScrollDistance = 150 * result

    if (leftMouseMove / rightMouseMove > 5 || rightMouseMove / leftMouseMove > 5) {
      // swipe to the left to go forward
      if (
        leftMouseMove - beginningScrollRight! > minScrollDistance &&
        Math.abs(horizontalMouseMove / verticalMouseMove) > 3
      ) {
        if (beginningScrollRight! < 5) {
          resetDistanceCounters()
          resetScrollCounters()
          webviews.callAsync(window.tabs.getSelected()!, 'goForward')
        }
      }

      // swipe to the right to go backwards
      if (
        rightMouseMove + beginningScrollLeft! > minScrollDistance &&
        Math.abs(horizontalMouseMove / verticalMouseMove) > 3
      ) {
        if (beginningScrollLeft! < 5) {
          resetDistanceCounters()
          resetScrollCounters()
          webviews.goBackIgnoringRedirects(window.tabs.getSelected()!)
        }
      }
    }
  })
}

webviews.bindIPC('wheel-event', (tabId: string, e: string | WheelEvent) => {
  e = JSON.parse(e as string) as WheelEvent

  if (e.defaultPrevented) {
    return
  }

  verticalMouseMove += e.deltaY
  horizontalMouseMove += e.deltaX
  if (e.deltaX > 0) {
    leftMouseMove += e.deltaX
  } else {
    rightMouseMove += e.deltaX * -1
  }

  const platformZoomKey = navigator.platform === 'MacIntel' ? e.metaKey : e.ctrlKey
  const platformSecondaryKey = navigator.platform === 'MacIntel' ? e.ctrlKey : false

  if (beginningScrollLeft === null || beginningScrollRight === null) {
    webviews.callAsync(
      window.tabs.getSelected()!,
      'executeJavaScript',
      `
    (function () {
      var left = 0
      var right = 0
      var isInFrame = false;
      
      var n = document.elementFromPoint(${e.clientX}, ${e.clientY})
      while (n) {
        if (n.tagName === 'IFRAME') {
          isInFrame = true;
        }
        if (n.scrollLeft !== undefined) {
            left = Math.max(left, n.scrollLeft)
            right = Math.max(right, n.scrollWidth - n.clientWidth - n.scrollLeft)
        }
        n = n.parentElement
      }  
      return {left, right, isInFrame}
    })()
    `,
      (err: any, result: { left: number; right: number; isInFrame: boolean }) => {
        if (err) {
          console.warn(err)
          return
        }
        if (beginningScrollLeft === null || beginningScrollRight === null) {
          beginningScrollLeft = result.left
          beginningScrollRight = result.right
        }
        isInFrame = isInFrame || result.isInFrame
      },
    )
  }

  if (initialZoomKeyState === null) {
    initialZoomKeyState = platformZoomKey
  }

  if (initialSecondaryKeyState === null) {
    initialSecondaryKeyState = platformSecondaryKey
  }

  if (Math.abs(e.deltaX) >= 20 || Math.abs(e.deltaY) >= 20) {
    clearTimeout(swipeGestureLowVelocityTimeout)
    swipeGestureLowVelocityTimeout = setTimeout(onSwipeGestureLowVelocity, swipeGestureVelocityDelay)

    if (horizontalMouseMove < -150 && Math.abs(horizontalMouseMove / verticalMouseMove) > 2.5 && !hasShownSwipeArrow) {
      hasShownSwipeArrow = true
      webviewGestures.showBackArrow()
    } else if (
      horizontalMouseMove > 150 &&
      Math.abs(horizontalMouseMove / verticalMouseMove) > 2.5 &&
      !hasShownSwipeArrow
    ) {
      hasShownSwipeArrow = true
      webviewGestures.showForwardArrow()
    }
  }

  clearTimeout(swipeGestureDistanceResetTimeout)
  clearTimeout(swipeGestureScrollResetTimeout)
  swipeGestureDistanceResetTimeout = setTimeout(resetDistanceCounters, swipeGestureDelay)
  swipeGestureScrollResetTimeout = setTimeout(resetScrollCounters, swipeGestureScrollDelay)

  /* cmd-key while scrolling should zoom in and out */

  if (platformZoomKey && initialZoomKeyState) {
    if (verticalMouseMove > 50) {
      verticalMouseMove = -10
      webviewGestures.zoomWebviewOut(window.tabs.getSelected()!)
    }

    if (verticalMouseMove < -50) {
      verticalMouseMove = -10
      webviewGestures.zoomWebviewIn(window.tabs.getSelected()!)
    }
  }
})

// module.exports = webviewGestures
