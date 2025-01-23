/* send bookmarks data.  */

import electron, { ipcRenderer as ipc } from 'electron'

export const initTextExtractor = () => {
  function isVisible(el: HTMLElement) {
    // https://github.com/jquery/jquery/blob/305f193aa57014dc7d8fa0739a3fefd47166cd44/src/css/hiddenVisibleSelectors.js
    return el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length)
  }

  function extractPageText(doc: Document, _win: Window) {
    const maybeNodes = [].slice.call(doc.body.childNodes)
    const textNodes = []

    const ignore =
      'link, style, script, noscript, .hidden, .visually-hidden, .visuallyhidden, [role=presentation], [hidden], [style*="display:none"], [style*="display: none"], .ad, .dialog, .modal, select, svg, details:not([open]), header, nav, footer'

    while (maybeNodes.length) {
      const node = maybeNodes.shift()

      // if the node should be ignored, skip it and all of it's child nodes
      if (node.matches && node.matches(ignore)) {
        continue
      }

      // if the node is a text node, add it to the list of text nodes

      if (node.nodeType === 3) {
        textNodes.push(node)
        continue
      }

      if (!isVisible(node)) {
        continue
      }

      // otherwise, add the node's text nodes to the list of text, and the other child nodes to the list of nodes to check
      const { childNodes } = node
      const cnl = childNodes.length

      for (let i = cnl - 1; i >= 0; i--) {
        const childNode = childNodes[i]
        maybeNodes.unshift(childNode)
      }
    }

    let text = ''

    const tnl = textNodes.length

    // combine the text of all of the accepted text nodes together
    for (let i = 0; i < tnl; i++) {
      text += `${textNodes[i].textContent} `
    }

    // special meta tags

    const mt = doc.head.querySelector('meta[name=description]') as HTMLMetaElement

    if (mt) {
      text += ` ${mt.content}`
    }

    text = text.trim()

    text = text.replace(/[\n\t]/g, ' ') // remove useless newlines/tabs that increase filesize

    text = text.replace(/\s{2,}/g, ' ') // collapse multiple spaces into one
    return text
  }

  function getPageData(cb) {
    requestAnimationFrame(() => {
      let text = extractPageText(document, window)

      // try to also extract text for same-origin iframes (such as the reader mode frame)

      const frames = document.querySelectorAll('iframe')

      for (let x = 0; x < frames.length; x++) {
        try {
          text += `. ${extractPageText(frames[x].contentDocument, frames[x].contentWindow)}`
        } catch (e) {
          //
        }
      }

      // limit the amount of text that is collected

      text = text.substring(0, 300000)

      cb({
        extractedText: text,
      })
    })
  }

  // send the data when the page loads
  if (process.isMainFrame) {
    window.addEventListener('load', (_e) => {
      setTimeout(() => {
        getPageData((data) => {
          ipc.send('pageData', data)
        })
      }, 500)
    })

    setTimeout(() => {
      // https://stackoverflow.com/a/52809105
      electron.webFrame.executeJavaScript(`
      history.pushState = ( f => function pushState(){
        var ret = f.apply(this, arguments);
        window.postMessage('_minInternalLocationChange', '*')
        return ret;
    })(history.pushState);
    
    history.replaceState = ( f => function replaceState(){
        var ret = f.apply(this, arguments);
        window.postMessage('_minInternalLocationReplacement', '*')
        return ret;
    })(history.replaceState);
  `)
    }, 0)

    window.addEventListener('message', (e) => {
      if (e.data === '_minInternalLocationChange') {
        setTimeout(() => {
          getPageData((data) => {
            ipc.send('pageData', data)
          })
        }, 500)
      }
    })
  }
}
