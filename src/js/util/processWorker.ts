// const { spawnSync } = require('child_process')
import { spawnSync } from 'child_process'

onmessage = (e) => {
  const { taskId } = e.data
  const { command } = e.data
  const { args } = e.data
  const { input } = e.data
  const { customEnv } = e.data
  const { maxBuffer } = e.data
  const { timeout } = e.data

  try {
    const process = spawnSync(command, args, {
      input,
      encoding: 'utf8',
      env: customEnv,
      maxBuffer,
      timeout,
    })

    if (process.error || process.signal || process.status) {
      throw new Error(`Process terminated: ${process.stderr}, ${process.signal}, ${process.error}, ${process.status}`)
    }

    let output = process.output[1]
    if (output!.slice(-1) === '\n') {
      output = output!.slice(0, -1)
    }

    postMessage({ taskId, result: output })
  } catch (e) {
    console.log(e)
    postMessage({ taskId, error: (e as Error).toString() })
  }
}
