/*
Helper class to control child process output.
Bufferizes output from stdout and stderr, waits until the process exits,
and then resolves the promise with gathered data.
*/

// const { spawn, spawnSync } = require('child_process')
import { ChildProcess, spawn, spawnSync } from 'node:child_process'
import { env } from 'node:process'

// const worker = new Worker('js/util/processWorker.js')
import MyWorkder from './processWorker?worker'

const worker = new MyWorkder()
console.log('process=')
console.log(process)
console.log('env=')
console.log(env)
let processPath = env.PATH!
console.log(`processPath=${processPath}`)
// we need to locate the op binary in this directory on macOS - see https://github.com/minbrowser/min/issues/1028
// normally, it is present in the path when running in development, but not when the app is launched after being packaged
if (window.platformType === 'mac' && !processPath.includes('/usr/local/bin')) {
  processPath += ':/usr/local/bin'
}

const customEnv = { ...env, PATH: processPath }

// see https://github.com/minbrowser/min/issues/1028#issuecomment-647235653
const maxBufferSize = 25 * 1024 * 1024

export class ProcessSpawner {
  command: string

  args: string[]

  data: string

  error: string

  timeout: undefined | number

  env: { PATH: string; TZ?: string | undefined }

  constructor(command: string, args: string[] = [], env = {}, timeout: number | undefined = undefined) {
    this.command = command
    this.args = args
    this.data = ''
    this.error = ''
    this.timeout = timeout
    this.env = { ...customEnv, ...env }
  }

  async execute() {
    return new Promise((resolve, reject) => {
      const process: ChildProcess = spawn(this.command, this.args, {
        env: this.env,
        // maxBuffer: maxBufferSize,
      })

      process.stdout!.on('data', (data) => {
        this.data += data
      })

      process.stderr!.on('data', (data) => {
        this.error += data
      })

      process.on('close', (code) => {
        if (code !== 0) {
          // eslint-disable-next-line prefer-promise-reject-errors
          reject({ error: this.error, data: this.data })
        } else {
          resolve(this.data)
        }
      })

      process.on('error', (data) => {
        // eslint-disable-next-line prefer-promise-reject-errors
        reject({ error: data })
      })
    })
  }

  executeSync(input: string | NodeJS.ArrayBufferView | undefined) {
    const process = spawnSync(this.command, this.args, {
      input,
      encoding: 'utf8',
      env: this.env,
      maxBuffer: maxBufferSize,
      timeout: this.timeout,
    })
    return process.output[1]!.slice(0, -1)
  }

  executeSyncInAsyncContext(input: string = '') {
    return new Promise((resolve, reject) => {
      const taskId = Math.random()
      worker.onmessage = (e) => {
        if (e.data.taskId === taskId) {
          if (e.data.error) {
            reject(e.data.error)
          } else {
            resolve(e.data.result)
          }
        }
      }
      worker.postMessage({
        command: this.command,
        args: this.args,
        input,
        customEnv: this.env,
        maxBuffer: maxBufferSize,
        taskId,
        timeout: this.timeout,
      })
    })
  }

  checkCommandExists() {
    return new Promise((resolve, _reject) => {
      const checkCommand = window.platformType === 'windows' ? 'where' : 'which'
      const process = spawn(checkCommand, [this.command], { env: this.env, timeout: this.timeout })

      process.stdout.on('data', (data) => {
        if (data.length > 0) {
          resolve(true)
        }
      })

      process.on('close', (_code) => {
        // if we didn't get any output, the command doesn't exist
        resolve(false)
      })

      process.on('error', (_data) => {
        resolve(false)
      })
    })
  }
}

// module.exports = ProcessSpawner
