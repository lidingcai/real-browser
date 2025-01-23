import fs from 'node:fs'

export const hosts: string[] = []

const HOSTS_FILE = process.platform === 'win32' ? 'C:/Windows/System32/drivers/etc/hosts' : '/etc/hosts'

function truncatedHostsFileLines(data: string, limit: number) {
  return data.length > limit ? data.substring(0, limit).split('\n').slice(0, -1) : data.split('\n')
}

fs.readFile(HOSTS_FILE, 'utf8', (err, data) => {
  if (err) {
    console.warn('error retrieving hosts file', err)
    return
  }

  const hostsMap: Record<string, boolean> = {} // this is used to deduplicate the list

  const lines = truncatedHostsFileLines(data, 128 * 1024)

  lines.forEach((line) => {
    if (line.startsWith('#')) {
      return
    }
    line.split(/\s/g).forEach((host) => {
      if (host.length > 0 && host !== '255.255.255.255' && host !== 'broadcasthost' && !hostsMap[host]) {
        hosts.push(host)
        hostsMap[host] = true
      }
    })
  })
})

// module.exports = hosts
