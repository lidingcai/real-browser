import { ipcRenderer as ipc } from 'electron'

export const initTranslate = () => {
  const maxCharsToTranslate = 15000

  function isVisible(el: HTMLElement) {
    // https://github.com/jquery/jquery/blob/305f193aa57014dc7d8fa0739a3fefd47166cd44/src/css/hiddenVisibleSelectors.js
    return el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length)
  }

  function getNodes(doc: Document, _win: Window) {
    const maybeNodes = [].slice.call(doc.body.childNodes)
    const textNodes = []

    let ignore =
      'link, style, script, noscript, .hidden, [class*="-hidden"], .visually-hidden, .visuallyhidden, [role=presentation], [hidden], [style*="display:none"], [style*="display: none"], .ad, .dialog, .modal, select, svg, details:not([open])'

    ignore += ', pre, code'

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

    return textNodes
  }

  async function translate(destLang) {
    let nodes = getNodes(document, window)

    const titleElement = document.querySelector('title')
    if (titleElement && titleElement.childNodes && titleElement.childNodes[0]) {
      nodes.unshift(titleElement.childNodes[0])
    }

    // try to also extract text for same-origin iframes (such as the reader mode frame)

    const frames = document.querySelectorAll('iframe')

    for (let x = 0; x < frames.length; x++) {
      try {
        nodes = nodes.concat(getNodes(frames[x].contentDocument, frames[x].contentWindow))
      } catch (e) {
        //
      }
    }

    const nodesSet = nodes
      .filter((n) => n.textContent.replace(/[\s0-9]+/g, '').length > 2)
      .map((n) => ({ node: n, translated: false, originalLength: n.textContent.length, score: 0 }))

    function handleChunk() {
      // rescore the nodes

      let selectionParent
      try {
        selectionParent = window.getSelection().getRangeAt(0).commonAncestorContainer
      } catch (e) {
        //
      }

      const sortedNodes = nodesSet
        .map((item) => {
          item.score = 0
          if (selectionParent && selectionParent.contains(item.node)) {
            item.score += 2
          }
          try {
            const rect = item.node.parentNode.getBoundingClientRect()
            if (rect.bottom > 0 && rect.top < window.innerHeight) {
              item.score += 1
            }
          } catch (e) {
            //
          }
          return item
        })
        .sort((a, b) => b.score - a.score)

      // select up to 1k chars from the untranslated set

      const nodesInQuery = []
      let charsSelected = 0
      sortedNodes.forEach((item) => {
        if (charsSelected < 500 && !item.translated) {
          nodesInQuery.push(item.node)
          charsSelected += item.node.textContent.length
        }
      })

      const query = nodesInQuery.map((node) => node.textContent)
      const requestId = Math.random()

      ipc.send('translation-request', {
        query,
        lang: destLang,
        requestId,
      })

      ipc.once(`translation-response-${requestId}`, (_e, data) => {
        data.response.translatedText.forEach((text, i) => {
          const rootNodeIndex = nodesSet.findIndex((item) => item.node === nodesInQuery[i])

          if (query[i].startsWith(' ')) {
            text = ` ${text}`
          }
          if (query[i].endsWith(' ')) {
            text += ' '
          }

          /*
        When the Libretranslate model encounters unknown vocabulary (or the language auto-detect is wrong),
        it sometimes produces very long, nonsensical output. Try to detect that and skip the translation.
        */
          if (query[i].length > 2 && text.length / query[i].length > 20) {
            console.warn('skipping possibly invalid translation: ', query[i], ' -> ', text)
            return
          }

          /*
        The English model frequently produces translations in lowercase.
        As a workaround, capitalize the first character if the original was uppercase
        */
          if (destLang === 'en') {
            const originalFirstChar = query[i][0]
            if (originalFirstChar && originalFirstChar.toUpperCase() === originalFirstChar) {
              text = text[0].toUpperCase() + text.substring(1)
            }
          }

          nodesSet[rootNodeIndex].node.textContent = text
          nodesSet[rootNodeIndex].translated = true
        })

        console.log(
          'translated ',
          nodesSet
            .filter((item) => item.translated)
            .map((item) => item.originalLength)
            .reduce((a, b) => a + b),
          'chars',
        )
        if (
          nodesSet
            .filter((item) => item.translated)
            .map((item) => item.originalLength)
            .reduce((a, b) => a + b) < maxCharsToTranslate &&
          nodesSet.some((item) => !item.translated)
        ) {
          handleChunk()
        }
      })
    }

    handleChunk()
  }

  ipc.on('translate-page', (_e, lang) => {
    translate(lang)
  })
}
