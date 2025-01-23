// a neural network for determing which text color to use, generated using http://harthur.github.io/brain/
export const runNetwork = function anonymous(input: Record<string, number>) {
  const net = {
    layers: [
      {
        r: {},
        g: {},
        b: {},
      },
      {
        '0': {
          bias: 14.176907520571566,
          weights: {
            r: -3.2764240497480652,
            g: -16.90247884718719,
            b: -2.9976364179397814,
          },
        },
        '1': {
          bias: 9.086071102351246,
          weights: {
            r: -4.327474143397604,
            g: -15.780660155750773,
            b: 2.879230202567851,
          },
        },
        '2': {
          bias: 22.274487339773476,
          weights: {
            r: -3.5830205067960965,
            g: -25.498384261673618,
            b: -6.998329189107962,
          },
        },
      },
      {
        black: {
          bias: 17.873962570788997,
          weights: {
            '0': -15.542217788633987,
            '1': -13.377152708685674,
            '2': -24.52215186113144,
          },
        },
      },
    ],
    outputLookup: true,
    inputLookup: true,
  }
  let output = {} as Record<string, number>
  for (let i = 1; i < net.layers.length; i++) {
    const layer = net.layers[i] as unknown as Record<
      string,
      {
        bias: number
        weights: Record<string, number>
      }
    >
    output = {}

    for (const id in layer) {
      const node = layer[id]
      let sum = node.bias

      for (const iid in node.weights) {
        sum += node.weights[iid] * input[iid]
      }
      output[id] = 1 / (1 + Math.exp(-sum))
    }
    input = output
  }
  return output
}

// module.exports = runNetwork
