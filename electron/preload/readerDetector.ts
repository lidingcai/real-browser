/* detects if a page is readerable, and tells the main process if it is */
import { ipcRenderer as ipc } from 'electron'

export const initReaderDetector = () => {
  function pageIsReaderable() {
    const paragraphMap = new Map()

    const paragraphs = document.querySelectorAll('p')
    let totalLength = 0

    if (!paragraphs) {
      return false
    }

    for (let i = 0; i < paragraphs.length; i++) {
      const pLength = Math.max(paragraphs[i].textContent.replace(/\s+/g, ' ').length - 100, -30)
      totalLength += pLength

      const prev = paragraphMap.get(paragraphs[i].parentNode) || 0
      paragraphMap.set(paragraphs[i].parentNode, prev + pLength)
    }

    let largestValue = 0

    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    paragraphMap.forEach((value, key) => {
      if (value > largestValue) {
        largestValue = value
      }
    })

    if (
      (largestValue > 600 && largestValue / totalLength > 0.33) ||
      (largestValue > 400 && document.querySelector('article, meta[property="og:type"][content="article"]'))
    ) {
      return true
    }
    return false
  }

  function checkReaderStatus() {
    if (pageIsReaderable()) {
      ipc.send('canReader')
    }
  }

  if (process.isMainFrame) {
    // unlike DOMContentLoaded, readystatechange doesn't wait for <script defer>, so it happens a bit sooner
    document.addEventListener('readystatechange', () => {
      if (document.readyState === 'interactive') {
        checkReaderStatus()
      }
    })
    window.addEventListener('load', checkReaderStatus)
  }
}
