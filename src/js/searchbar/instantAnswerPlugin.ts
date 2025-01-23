// var searchbar = require('searchbar/searchbar.js')
import { l } from '../../locales'
// var searchbarAutocomplete = require('util/autocomplete.js')
import * as searchbarAutocomplete from '../util/autocomplete'
// var searchEngine = require('util/searchEngine.js')
import { searchEngine } from '../util/searchEngine'
// var urlParser = require('util/urlParser.js')
import { urlParser } from '../util/urlParser'
import { searchbar } from './searchbar'
// var searchbarPlugins = require('searchbar/searchbarPlugins.js')
import { searchbarPlugins } from './searchbarPlugins'

const ddgAttribution = l('resultsFromDDG')

function removeTags(text: string) {
  return text.replace(/<.*?>/g, '')
}

// custom instant answers

const instantAnswers = {
  color_code(searchText: string, answer: string) {
    const data = {
      title: searchText,
      descriptionBlock: answer.replace(/\n/g, ' · ').replace(/\s~\s/g, ' · '),
      attribution: ddgAttribution,
      colorCircle: '',
    }

    const rgb = answer.split(' ~ ').filter((format) => {
      return format.startsWith('RGBA')
    })

    if (rgb[0]) {
      // eslint-disable-next-line prefer-destructuring
      data.colorCircle = rgb[0]
    }

    return data
  },
  currency_in(_searchText: string, answer: any) {
    let title = ''
    if (typeof answer === 'string') {
      // there is only one currency
      title = answer
    } else {
      // multiple currencies
      const currencyArr = []
      for (const countryCode in answer) {
        currencyArr.push(`${answer[countryCode]} (${countryCode})`)
      }

      title = currencyArr.join(', ')
    }

    let descriptionBlock
    if (answer.data) {
      descriptionBlock = answer.data.title
    } else {
      descriptionBlock = l('DDGAnswerSubtitle')
    }

    return {
      title,
      descriptionBlock,
      attribution: ddgAttribution,
    }
  },
}

function showSearchbarInstantAnswers(text: string, input: HTMLInputElement, event: KeyboardEvent) {
  // only make requests to the DDG api if DDG is set as the search engine
  if (searchEngine.getCurrent().name !== 'DuckDuckGo') {
    return
  }

  // don't make a request if the searchbar has already closed

  if (!searchbar.associatedInput) {
    return
  }
  fetch(`https://api.duckduckgo.com/?t=min&skip_disambig=1&no_redirect=1&format=json&q=${encodeURIComponent(text)}`, {
    method: 'GET',
    // mode: 'no-cors', // no-cors
  })
    .then((data) => {
      return data.json()
    })
    .then(
      (res: {
        RelatedTopics: { Result: string; Text: string; FirstURL: string }[]
        AnswerType?: 'color_code' | 'currency_in'
        Answer?: string
        Abstract?: string
        AbstractURL?: string
        Image: string
        ImageIsLogo: boolean
        Heading: string
        Entity: string
        Results: { FirstURL: string }[]
      }) => {
        searchbarPlugins.reset('instantAnswers')

        let data:
          | { title: string; image?: string; descriptionBlock: string; attribution: string; url?: string }
          | undefined

        // const hasAnswer = instantAnswers[res.AnswerType!] || (res.Answer && typeof res.Answer === 'string')
        // change for typescript
        const hasAnswer =
          res.AnswerType === 'color_code' ||
          res.AnswerType === 'currency_in' ||
          (res.Answer && typeof res.Answer === 'string')
        // if there is a custom format for the answer, use that
        if (instantAnswers[res.AnswerType!]) {
          data = instantAnswers[res.AnswerType!](text, res.Answer!)

          // use the default format
        } else if (res.Abstract || (res.Answer && typeof res.Answer === 'string')) {
          data = {
            title: (typeof res.Answer === 'string' && removeTags(res.Answer)) || removeTags(res.Heading),
            descriptionBlock: res.Abstract || l('DDGAnswerSubtitle'),
            attribution: ddgAttribution,
            url: res.AbstractURL || text,
          }

          if (res.Image && !res.ImageIsLogo) {
            data.image = res.Image
            if (data.image.startsWith('/')) {
              // starting 11/2020, the DDG API returns relative URLs rather than absolute ones
              data.image = `https://duckduckgo.com${data.image}`
            }
          }

          // show a disambiguation
        } else if (res.RelatedTopics) {
          res.RelatedTopics.slice(0, 3).forEach((item: { Result: string; Text: string; FirstURL: string }) => {
            // the DDG api returns the entity name inside an <a> tag
            const entityName = item.Result.replace(/.*>(.+?)<.*/g, '$1')

            // the text starts with the entity name, remove it
            const desc = item.Text.replace(entityName, '')

            // try to convert the given url to a wikipedia link
            const entityNameRegex = /https:\/\/duckduckgo.com\/(.*?)\/?$/

            let url
            if (entityNameRegex.test(item.FirstURL)) {
              url = `https://wikipedia.org/wiki/${entityNameRegex.exec(item.FirstURL)![1]}`
            } else {
              url = item.FirstURL
            }

            searchbarPlugins.addResult(
              'instantAnswers',
              {
                title: entityName,
                descriptionBlock: desc,
                url,
              },
              { allowDuplicates: true },
            )
          })
        }

        if (data) {
          // answers are more relevant, they should be displayed at the top
          if (hasAnswer) {
            searchbarPlugins.setTopAnswer('instantAnswers', data)
          } else {
            searchbarPlugins.addResult('instantAnswers', data, { allowDuplicates: true })
          }
        }

        // suggested site links
        if (searchbarPlugins.getResultCount('places') < 4 && res.Results && res.Results[0] && res.Results[0].FirstURL) {
          const url = res.Results[0].FirstURL

          const suggestedSiteData = {
            icon: 'carbon:earth-filled',
            title: urlParser.basicURL(url),
            url,
            classList: ['ddg-answer'],
            fakeFocus: false,
          }

          if (searchbarPlugins.getTopAnswer()) {
            searchbarPlugins.addResult('instantAnswers', suggestedSiteData)
          } else {
            if (event && event.keyCode !== 8) {
              // don't autocomplete if delete key pressed
              const autocompletionType = searchbarAutocomplete.autocompleteURL(input, url)

              if (autocompletionType !== -1) {
                suggestedSiteData.fakeFocus = true
              }
            }
            searchbarPlugins.setTopAnswer('instantAnswers', suggestedSiteData)
          }
        }

        // if we're showing a location, show a "Search on OpenStreetMap" link

        const entitiesWithLocations = ['location', 'country', 'u.s. state', 'protected area']

        if (entitiesWithLocations.indexOf(res.Entity) !== -1) {
          searchbarPlugins.addResult('instantAnswers', {
            icon: 'carbon:search',
            title: res.Heading,
            secondaryText: l('searchWith').replace('%s', 'OpenStreetMap'),
            classList: ['ddg-answer'],
            url: `https://www.openstreetmap.org/search?query=${encodeURIComponent(res.Heading)}`,
          })
        }
      },
    )
    .catch((e) => {
      console.error(e)
    })
}

export function initialize() {
  searchbarPlugins.register('instantAnswers', {
    index: 4,
    trigger(text) {
      return (
        text.length > 3 &&
        !urlParser.isPossibleURL(text) &&
        !(window.tabs.get(window.tabs.getSelected()!) as TabType).private
      )
    },
    showResults: window.debounce(showSearchbarInstantAnswers, 150),
  })
}

// module.exports = { initialize }
