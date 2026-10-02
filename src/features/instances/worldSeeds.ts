/** 保留种子的全部数位；未知或越界值不能用于编辑、保存及地图链接。 */
export function normalizeWorldSeed(value: string | undefined): string | undefined {
  if (typeof value !== 'string' || value.length > 20 || !/^-?[0-9]+$/.test(value)) return undefined
  const seed = BigInt(value)
  if (seed < -9223372036854775808n || seed > 9223372036854775807n) return undefined
  return seed.toString()
}
