import { app, protocol, Session, session } from 'electron'

import { wholeAppUrl } from './constants'

// import { wholeAppUrl } from './constants'
// import { pathToFileURL } from 'url'

/*
export function registerBundleProtocol(ses: Session) {
  ses.protocol.handle('min', (req) => {
    // eslint-disable-next-line prefer-const
    let { host, pathname } = new URL(req.url)

    if (pathname.charAt(0) === '/') {
      pathname = pathname.substring(1)
    }

    if (host !== 'app') {
      return new Response('bad', {
        status: 400,
        headers: { 'content-type': 'text/html' },
      })
    }

    // NB, this checks for paths that escape the bundle, e.g.
    // app://bundle/../../secret_file.txt
    const pathToServe = path.resolve(__dirname, pathname)
    const relativePath = path.relative(__dirname, pathToServe)
    const isSafe = relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)

    if (!isSafe) {
      return new Response('bad', {
        status: 400,
        headers: { 'content-type': 'text/html' },
      })
    }

    return net.fetch(pathToFileURL(pathToServe).toString())
  })
}
*/
export function registerBundleProtocol(ses: Session) {
  ses.protocol.handle('min', (req) => {
    // let wholeAppUrl = process.env.VITE_DEV_SERVER_URL || 'write-production-url-here'
    // eslint-disable-next-line prefer-const
    let { host, pathname, search } = new URL(req.url)

    while (pathname.charAt(0) === '/') {
      pathname = pathname.substring(1)
    }
    let appUrl = wholeAppUrl
    while (appUrl.endsWith('/')) {
      appUrl = appUrl.substring(0, appUrl.length - 1)
    }
    pathname = pathname.replace('/index.html', '')
    console.log(`url = ${appUrl}`)
    console.log(`pathname=${pathname}`)
    console.log(`search=${search}`)
    if (host !== 'app') {
      return new Response('bad', {
        status: 400,
        headers: { 'content-type': 'text/html' },
      })
    }
    const redirectUrl = `${appUrl}/${pathname}${search}`
    return Response.redirect(redirectUrl)
  })
}
export const initMinInternalProtocol = () => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'min',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
      },
    },
  ])
  app.on('session-created', (ses) => {
    if (ses !== session.defaultSession) {
      registerBundleProtocol(ses)
    }
  })
}
