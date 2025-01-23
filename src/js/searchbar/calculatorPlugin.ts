/*
  this plugin will provide the ability to perform simple calculations
*/

import { clipboard } from 'electron'
// const Parser = require('expr-eval').Parser
import { Parser } from 'expr-eval'

import { l } from '../../locales'
// const searchbarPlugins = require('searchbar/searchbarPlugins.js')
import { searchbarPlugins } from './searchbarPlugins'

const math = new Parser()
math.consts.pi = Math.PI
math.consts.e = Math.E

// get all expr-eval tokens (operators, constants, etc.)
const mathOps = {
  get all() {
    let ops: string[] = []
    for (const op of Object.keys(math)) {
      ops = ops.concat(Object.keys(math[op as keyof Parser]))
    }
    return ops
  },
}

/* avoid processing input that is only numbers and spaces */
const validRegex = new RegExp(
  `^([ 0-9()[\\],;.]+|${mathOps.all
    .join('|')
    .replace(/([+*[\]/?^$])/g, '\\$1')
    .replace('||||', '|\\|\\||')})+$`,
)

function doMath(text: string, _input: HTMLInputElement, _event: Event) {
  searchbarPlugins.reset('calculatorPlugin')
  let result

  try {
    result = math.evaluate(text).toString()
    if (result.includes('NaN')) {
      return
    }
  } catch (e) {
    return
  }

  searchbarPlugins.addResult('calculatorPlugin', {
    icon: 'carbon:calculator',
    title: result,
    descriptionBlock: l('clickToCopy'),
  })

  const container = searchbarPlugins.getContainer('calculatorPlugin')!

  if (container.childNodes.length === 1) {
    const item = container.childNodes[0]
    item.addEventListener('click', (_e) => {
      const titleEl = (item as HTMLElement).querySelector('.title') as HTMLElement
      const descriptionBlockEl = (item as HTMLElement).querySelector('.description-block') as HTMLElement

      clipboard.writeText(titleEl.innerText)
      descriptionBlockEl.innerText = `${l('copied')}!`
    })
  }
}

export function initialize() {
  searchbarPlugins.register('calculatorPlugin', {
    index: 1,
    trigger(text) {
      if (
        text.length < 3 ||
        text.length > 100 ||
        (!/__proto__|prototype|constructor/i.test(text) && // dangerous keywords
          !validRegex.test(text)) // valid tokens
      ) {
        return false
      }

      try {
        const expression = math.parse(text)
        if ((expression as unknown as { tokens: any[] }).tokens.length <= 1) {
          return false
        }
      } catch (e) {
        return false
      }
      return true
    },
    showResults: window.debounce(doMath, 200),
  })
}

// module.exports = { initialize }
