export function compareVersions(v1: string | number[], v2: string | number[]) {
  /*
    1: v2 is newer than v1
    -1: v1 is newer than v2
    0: the two versions are equal
    */
  v1 = (v1 as string).split('.').map((i) => parseInt(i, 10))
  v2 = (v2 as string).split('.').map((i) => parseInt(i, 10))

  for (let i = 0; i < v1.length; i++) {
    if (v2[i] > v1[i]) {
      return 1
    }
    if (v1[i] > v2[i]) {
      return -1
    }
  }

  return 0
}

// module.exports = compareVersions
