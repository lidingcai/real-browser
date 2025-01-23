/* imports common modules */
import { ipcRenderer as ipc } from 'electron'

export const initDefault = () => {
  // const ipc = electron.ipcRenderer

  const propertiesToClone = ['deltaX', 'deltaY', 'metaKey', 'ctrlKey', 'defaultPrevented', 'clientX', 'clientY']

  function cloneEvent(e: WheelEvent) {
    const obj = {}

    for (let i = 0; i < propertiesToClone.length; i++) {
      obj[propertiesToClone[i]] = e[propertiesToClone[i]]
    }
    return JSON.stringify(obj)
  }

  // workaround for Electron bug
  setTimeout(() => {
    /* Used for swipe gestures */
    window.addEventListener('wheel', (e) => {
      ipc.send('wheel-event', cloneEvent(e))
    })

    let scrollTimeout = null

    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        ipc.send('scroll-position-change', Math.round(window.scrollY))
      }, 200)
    })
  }, 0)

  /* Used for picture in picture item in context menu */
  ipc.on('getContextMenuData', (event, data) => {
    // check for video element to show picture-in-picture menu
    const hasVideo = Array.from(document.elementsFromPoint(data.x, data.y)).some((el) => el.tagName === 'VIDEO')
    ipc.send('contextMenuData', { hasVideo })
  })

  ipc.on('enterPictureInPicture', (event, data) => {
    const videos = Array.from(document.elementsFromPoint(data.x, data.y)).filter(
      (el) => el.tagName === 'VIDEO',
    ) as HTMLVideoElement[]
    if (videos[0]) {
      videos[0].requestPictureInPicture()
    }
  })

  window.addEventListener('message', (e) => {
    if (!e.origin.startsWith('min://')) {
      return
    }

    if (e.data?.message === 'showCredentialList') {
      ipc.send('showCredentialList')
    }

    if (e.data?.message === 'showUserscriptDirectory') {
      ipc.send('showUserscriptDirectory')
    }
  })
}
