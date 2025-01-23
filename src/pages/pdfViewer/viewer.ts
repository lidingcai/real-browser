import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocumentProxy } from 'pdfjs-dist'
// import { PDFWorker } from 'pdfjs-dist'
import pdfjsViewer, { PDFPageView } from 'pdfjs-dist/web/pdf_viewer.mjs'

// pdfjsLib.GlobalWorkerOptions.workerSrc = PDFWorker
// pdfjsLib.GlobalWorkerOptions.workerSrc = '../../node_modules/pdfjs-dist/build/pdf.worker.js'

const url = new URLSearchParams(window.location.search.replace('?', '')).get('url')

const eventBus = new pdfjsViewer.EventBus()
const pageViews = [] as PDFPageView[]
let currentPage = null as null | number
let pageCount: number
const pdf = null as null | PDFDocumentProxy

/* page counter UI */
const pageCounter = {
  container: null as null | HTMLElement,
  input: null as null | HTMLInputElement,
  totalEl: null as null | HTMLElement,
  init() {
    pageCounter.container = document.getElementById('page-counter')!
    // eslint-disable-next-line prefer-destructuring
    pageCounter.input = pageCounter.container.getElementsByTagName('input')[0]!
    pageCounter.totalEl = pageCounter.container.querySelector('#total')

    pageCounter.container.addEventListener('click', () => {
      pageCounter.input!.focus()
      pageCounter.input!.select()
    })

    // eslint-disable-next-line func-names
    pageCounter.input.addEventListener('change', function () {
      const pageIndex = parseInt(this.value, 10) - 1
      if (pageViews[pageIndex] && pageViews[pageIndex].div) {
        pageViews[pageIndex].div.scrollIntoView()
      }
      updateVisiblePages()
      pageCounter.update()
      pageCounter.input!.blur()
    })
  },
  update() {
    pageCounter.input!.value = (currentPage! + 1) as unknown as string
    pageCounter.totalEl!.textContent = pageCount as unknown as string
  },
}

pageCounter.init()

/* progress bar UI */

const progressBar = {
  element: document.getElementById('progress-bar')!,
  enabled: false,
  progress: 0,
  incrementProgress(progress: number) {
    // progress: amount by which to increase the progress bar (number 0-1, 1 = 100%)
    progressBar.progress += progress

    if (!progressBar.enabled) {
      return
    }

    if (progressBar.progress >= 1) {
      progressBar.enabled = false
      progressBar.element.style.transform = 'translateX(0%)'
      setTimeout(() => {
        progressBar.element.hidden = true
      }, 200)
      return
    }

    progressBar.element.hidden = false

    const width = progressBar.progress * 90
    progressBar.element.style.transform = `translateX(-${100 - width}%)`
  },
  init() {
    setTimeout(function () {
      if (!pdf) {
        progressBar.enabled = true
        progressBar.incrementProgress(0.05)

        const loadingFakeInterval = setInterval(function () {
          // we can't reliably determine actual download progress, so instead we make the bar move very slowly until the first page has loaded, then show how many pages have rendered
          if (progressBar.progress < 0.125) {
            progressBar.incrementProgress(0.002)
          } else {
            clearInterval(loadingFakeInterval)
          }
        }, 250)
      }
    }, 3000)
  },
}

progressBar.init()

const downloadButton = document.getElementById('download-button')!

downloadButton.addEventListener('click', function () {
  downloadPDF()
})

document.querySelectorAll('.side-gutter').forEach(function (el) {
  el.addEventListener('mouseenter', function () {
    showViewerUI()
  })
  el.addEventListener('mouseleave', function () {
    hideViewerUI()
  })
})

function showViewerUI() {
  document.querySelectorAll('.viewer-ui').forEach((el) => el.classList.remove('hidden'))
  pageCounter.update()
}

const hideViewerUI = debounce(function () {
  if (!document.querySelector('.side-gutter:hover')) {
    document.querySelectorAll('.viewer-ui').forEach((el) => el.classList.add('hidden'))
  }
}, 600)

function updateGutterWidths() {
  let gutterWidth
  if (!pageViews[0]) {
    // PDF hasn't loaded yet
    gutterWidth = 64
  } else {
    gutterWidth = Math.round(Math.max(64, (window.innerWidth - pageViews[0].viewport.width) / 2)) - 2
  }

  document.querySelectorAll('.side-gutter').forEach(function (el) {
    ;(el as HTMLElement).style.width = `${gutterWidth}px`
  })
}

function createContainer() {
  const el = document.createElement('div')
  el.classList.add('page-container')
  document.body.appendChild(el)
  return el
}

let pageBuffer = 15

/* adapted from PDFPageView.draw(), without actually painting the page onto the canvas */
function setupPageDom(pageView: pdfjsViewer.PDFPageView) {
  const { pdfPage } = pageView
  const { div } = pageView
  const canvasWrapper = document.createElement('div')
  canvasWrapper.style.width = div.style.width
  canvasWrapper.style.height = div.style.height
  canvasWrapper.classList.add('canvasWrapper')
  if (pageView.annotationLayer && pageView.annotationLayer.div && !pageView.annotationLayer.div.parentNode) {
    div.appendChild(pageView.annotationLayer.div)
  }
  if (pageView.annotationLayer && pageView.annotationLayer.div) {
    div.insertBefore(canvasWrapper, pageView.annotationLayer.div)
  } else {
    div.appendChild(canvasWrapper)
  }
  let textLayer = null
  if (pageView.textLayerFactory) {
    const textLayerDiv = document.createElement('div')
    textLayerDiv.className = 'textLayer'
    textLayerDiv.style.width = canvasWrapper.style.width
    textLayerDiv.style.height = canvasWrapper.style.height
    if (pageView.annotationLayer && pageView.annotationLayer.div) {
      div.insertBefore(textLayerDiv, pageView.annotationLayer.div)
    } else {
      div.appendChild(textLayerDiv)
    }
    textLayer = pageView.textLayerFactory.createTextLayerBuilder(
      textLayerDiv,
      pageView.id - 1,
      pageView.viewport,
      pageView.enhanceTextSelection,
    )
  }
  if (pageView.annotationLayerFactory) {
    const annotationLayer = pageView.annotationLayerFactory.createAnnotationLayerBuilder(
      div,
      pdfPage,
      null,
      null,
      false,
      pageView.l10n,
      null,
      null,
      null,
      null,
      null,
    )
  }
  pageView.textLayer = textLayer
  pageView.annotationLayer = annotationLayer
  setUpPageAnnotationLayer(pageView)
}

function DefaultTextLayerFactory() {}
DefaultTextLayerFactory.prototype = {
  createTextLayerBuilder(textLayerDiv, pageIndex, viewport, enhanceTextSelection) {
    return new pdfjsViewer.TextLayerBuilder({
      textLayerDiv,
      pageIndex,
      viewport,
      enhanceTextSelection: true,
      eventBus,
    })
  },
}

const updateCachedPages = throttle(function () {
  if (currentPage == null) {
    return
  }

  if (!pageViews[currentPage].canvas) {
    redrawPageCanvas(currentPage)
  }

  for (let i = 0; i < pageViews.length; i++) {
    ;(function (i) {
      if (i === currentPage) {
        // already checked above
        return
      }
      if (Math.abs(i - currentPage) > pageBuffer && pageViews[i].canvas) {
        pageViews[i].canvas.remove()
        pageViews[i].canvas = null
      }
      if (Math.abs(i - currentPage) < pageBuffer && !pageViews[i].canvas) {
        redrawPageCanvas(i)
      }
    })(i)
  }
}, 500)

function setUpPageAnnotationLayer(pageView) {
  pageView.annotationLayer.linkService.goToDestination = async function (dest) {
    // Adapted from https://github.com/mozilla/pdf.js/blob/8ac0ccc2277a7c0c85d6fec41c0f3fc3d1a2d232/web/pdf_link_service.js#L238
    let explicitDest
    if (typeof dest === 'string') {
      explicitDest = await pdf.getDestination(dest)
    } else {
      explicitDest = await dest
    }

    const destRef = explicitDest[0]
    let pageNumber

    if (typeof destRef === 'object' && destRef !== null) {
      pageNumber = await pdf.getPageIndex(destRef)
    } else if (Number.isInteger(destRef)) {
      pageNumber = destRef + 1
    }

    pageViews[pageNumber].div.scrollIntoView()
  }
}

pdfjsLib
  .getDocument({ url, withCredentials: true })
  .promise.then(async function (pdf: PDFDocumentProxy) {
    window.pdf = pdf

    pageCount = pdf.numPages

    if (pageCount < 25) {
      pageBuffer = 25
    } else {
      pageBuffer = 4
    }

    pdf.getMetadata().then(function (metadata) {
      document.title = metadata.Title || url.split('/').slice(-1)
    })

    for (let i = 1; i <= pageCount; i++) {
      const pageNumber = i

      await pdf.getPage(pageNumber).then(function (page) {
        progressBar.incrementProgress(1 / pageCount)

        const defaultScale = 1.15
        const minimumPageWidth = 625 // px

        let scale = defaultScale

        let viewport = page.getViewport({ scale })

        if (viewport.width * 1.5 > window.innerWidth) {
          scale = (window.innerWidth / viewport.width) * 0.75

          viewport = page.getViewport({ scale })
        }

        if (viewport.width * 1.33 < minimumPageWidth) {
          scale = (minimumPageWidth / viewport.width) * scale * 0.75
          viewport = page.getViewport({ scale })
        }

        if (pageCount > 200) {
          scale = Math.min(scale, 1.1)
          viewport = page.getViewport({ scale })
        }

        const pageContainer = createContainer()
        const pdfPageView = new pdfjsViewer.PDFPageView({
          container: pageContainer,
          id: pageNumber,
          scale,
          defaultViewport: viewport,
          eventBus,
          textLayerFactory: new DefaultTextLayerFactory(),
          annotationLayerFactory: new pdfjsViewer.DefaultAnnotationLayerFactory(),
        })
        pdfPageView.setPdfPage(page)
        pageViews.push(pdfPageView)

        if (pageNumber === 1) {
          updateGutterWidths()
        }

        ;(function (pageNumber, pdfPageView) {
          setTimeout(
            function () {
              if (pageNumber < pageBuffer || (currentPage && Math.abs(currentPage - pageNumber) < pageBuffer)) {
                pageContainer.classList.add('loading')
                pdfPageView
                  .draw()
                  .then(function () {
                    setUpPageAnnotationLayer(pdfPageView)
                  })
                  .then(function () {
                    pageContainer.classList.remove('loading')
                    if (pageNumber === 1) {
                      showViewerUI()
                      setTimeout(function () {
                        hideViewerUI()
                      }, 4000)
                    }
                  })
                setTimeout(function () {
                  pageContainer.classList.remove('loading')
                }, 2000)
              } else {
                setupPageDom(pdfPageView)
                requestIdleCallback(
                  function () {
                    pdfPageView.pdfPage.getTextContent({ normalizeWhitespace: true }).then(function (text) {
                      pdfPageView.textLayer.setTextContent(text)
                      pdfPageView.textLayer.render(0)
                      pdfPageView.annotationLayer.render(pdfPageView.viewport, 'display')
                    })
                  },
                  { timeout: 10000 },
                )
              }
            },
            100 * (pageNumber - 1),
          )
        })(pageNumber, pdfPageView)
      })
    }
  })
  .catch(function (e) {
    console.warn('error while loading PDF', e)
    // we can't display a preview, offer to download instead
    downloadPDF()
  })

let isFindInPage = false

function updateVisiblePages() {
  if (isPrinting) {
    return
  }

  const pageRects = new Array(pageViews.length)

  for (var i = 0; i < pageViews.length; i++) {
    pageRects[i] = pageViews[i].div.getBoundingClientRect()
  }

  const ih = window.innerHeight + 80
  const { innerHeight } = window

  const visiblePages = []

  for (var i = 0; i < pageViews.length; i++) {
    const rect = pageRects[i]
    const { textLayer } = pageViews[i]

    if (!isFindInPage && (rect.bottom < -80 || rect.top > ih)) {
      pageViews[i].div.style.visibility = 'hidden'
      if (textLayer) {
        textLayer.textLayerDiv.style.display = 'none'
      }
    } else {
      pageViews[i].div.style.visibility = 'visible'
      if (textLayer) {
        textLayer.textLayerDiv.style.display = 'block'
      }

      if (
        (rect.top >= 0 && innerHeight - rect.top > innerHeight / 2) ||
        (rect.bottom <= innerHeight && rect.bottom > innerHeight / 2) ||
        (rect.top <= 0 && rect.bottom >= innerHeight)
      ) {
        currentPage = i
      }
    }
  }

  if (currentPage !== undefined) {
    updateCachedPages(currentPage)
  }
}

window.addEventListener(
  'scroll',
  throttle(function () {
    pageCounter.update()
    updateVisiblePages()
  }, 50),
)

/* keep the UI size constant, regardless of the zoom level.
It would probably be better to add API's in Min for this. */

window.addEventListener('resize', function () {
  // this works in Chromium and Safari, but not in Firefox, and it will probably break at some point.
  window.zoomLevel = window.outerWidth / window.innerWidth

  // make UI elements stay a constant size regardless of zoom level
  document.querySelectorAll('.viewer-ui').forEach(function (el) {
    el.style.zoom = 1 / zoomLevel
  })

  updateGutterWidths()
})

function redrawPageCanvas(i, cb) {
  const canvasWrapperNode = pageViews[i].div.getElementsByClassName('canvasWrapper')[0]
  if (!canvasWrapperNode) {
    return
  }
  const oldCanvas = pageViews[i].canvas
  pageViews[i].paintOnCanvas(canvasWrapperNode).promise.then(function () {
    if (oldCanvas) {
      oldCanvas.remove()
    }
    if (cb) {
      cb()
    }
  })
}

let isRedrawing = false

function redrawAllPages() {
  if (isRedrawing) {
    console.log('ignoring redraw')
    return
  }

  isRedrawing = true

  let completedPages = 0
  function pageCompleteCallback() {
    completedPages++
    if (completedPages === Math.min(pageCount, pageBuffer)) {
      isRedrawing = false
    }
  }

  const visiblePageList = []
  const invisiblePageList = []

  // redraw the currently visible pages first

  for (var i = 0; i < pageViews.length; i++) {
    if (!pageViews[i].canvas) {
      continue
    }
    const rect = pageViews[i].div.getBoundingClientRect()
    // if the page is visible, add it to the beginning of the redraw list
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      visiblePageList.push(pageViews[i])
    } else {
      invisiblePageList.push(pageViews[i])
    }
  }

  const redrawList = visiblePageList.concat(invisiblePageList)

  for (var i = 0; i < redrawList.length; i++) {
    ;(function (i) {
      requestIdleCallback(function () {
        redrawPageCanvas(redrawList[i].id - 1, pageCompleteCallback)
      })
    })(i)
  }
}

let lastPixelRatio = window.devicePixelRatio
window.addEventListener(
  'resize',
  debounce(function () {
    // update visible pages in case the page size was increased
    updateVisiblePages()

    if (window.devicePixelRatio !== lastPixelRatio) {
      // if the page was zoomed
      lastPixelRatio = window.devicePixelRatio

      redrawAllPages()
      console.log('redraw triggered')
    }
  }, 750),
)

// https://remysharp.com/2010/07/21/throttling-function-calls

function debounce(fn, delay) {
  let timer = null
  return function () {
    const context = this
    const args = arguments
    clearTimeout(timer)
    timer = setTimeout(function () {
      fn.apply(context, args)
    }, delay)
  }
}

function throttle(fn, threshhold, scope) {
  threshhold || (threshhold = 250)
  let last
  let deferTimer
  return function () {
    const context = scope || this

    const now = +new Date()
    const args = arguments
    if (last && now < last + threshhold) {
      // hold on to it
      clearTimeout(deferTimer)
      deferTimer = setTimeout(function () {
        last = now
        fn.apply(context, args)
      }, threshhold)
    } else {
      last = now
      fn.apply(context, args)
    }
  }
}

function downloadPDF() {
  function startDownload(title) {
    const a = document.createElement('a')
    a.download = title || ''
    a.href = url
    a.click()
  }
  if (pdf) {
    pdf.getMetadata().then(function (data) {
      startDownload(data.info.Title)
    })
  } else {
    // there is no PDF data available
    // this can happen if the download is happening because the file isn't a PDF and we can't show a preview
    // or if the file hasn't loaded yet
    startDownload('')
  }
}

/* printing */

var isPrinting = false

let printPreviousScaleList = []

function afterPrintComplete() {
  for (let i = 0; i < pageViews.length; i++) {
    pageViews[i].viewport = pageViews[i].viewport.clone({ scale: printPreviousScaleList[i] * (4 / 3) })
    pageViews[i].cssTransform({ target: pageViews[i].canvas })
  }
  printPreviousScaleList = []
  isPrinting = false
  updateVisiblePages()
}

function printPDF() {
  let begunCount = 0
  let doneCount = 0

  isPrinting = true

  function onAllRenderingDone() {
    // we can print the document now
    setTimeout(function () {
      window.print()
    }, 100)
  }

  function onPageRenderComplete() {
    doneCount++
    if (doneCount === begunCount) {
      onAllRenderingDone()
    }
  }

  // we can't print very large documents because of memory usage, so offer to download the file instead
  if (pageCount > 100) {
    isPrinting = false
    downloadPDF()
  } else {
    const minimumAcceptableScale = 3.125 / devicePixelRatio
    // redraw each page at a high-enough scale for printing
    for (let i = 0; i < pageViews.length; i++) {
      ;(function (i) {
        printPreviousScaleList.push(pageViews[i].scale)
        const needsScaleChange = pageViews[i].scale < minimumAcceptableScale

        if (needsScaleChange) {
          pageViews[i].viewport = pageViews[i].viewport.clone({ scale: minimumAcceptableScale * (4 / 3) })
        }

        if (needsScaleChange || !pageViews[i].canvas) {
          begunCount++
          redrawPageCanvas(i, function () {
            if (needsScaleChange) {
              pageViews[i].cssTransform({ target: pageViews[i].canvas })
            }
            onPageRenderComplete()
          })
        }
      })(i)
    }
    if (begunCount === 0) {
      // we don't have to redraw any pages
      onAllRenderingDone()
    }
  }
}

const mediaQueryList = window.matchMedia('print')
mediaQueryList.onchange = function (mql) {
  if (!mql.matches) {
    setTimeout(function () {
      afterPrintComplete()
    }, 1000)
  }
}

/* find in page mode - make all pages visible so that Chromium's search can search the whole PDF */

function startFindInPage() {
  isFindInPage = true

  for (let i = 0; i < pageViews.length; i++) {
    pageViews[i].div.style.visibility = 'visible'
    if (pageViews[i].textLayer) {
      pageViews[i].textLayer.textLayerDiv.style.display = 'block'
    }
  }
}

function endFindInPage() {
  isFindInPage = false
  updateVisiblePages()
}

/* these functions are called from the parent process */

const parentProcessActions = {
  downloadPDF,
  printPDF,
  startFindInPage,
  endFindInPage,
}
