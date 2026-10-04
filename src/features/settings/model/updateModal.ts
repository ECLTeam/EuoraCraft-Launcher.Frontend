/** 根据目标版本的预发布标记显示通道，不以当前安装版本的通道代替。 */
export function getUpdateVersionChannel(version: string): 'alpha' | 'beta' | 'rc' | 'release' {
  const prerelease = version
    .split('+', 1)[0]
    ?.match(/-(alpha|beta|rc)(?:[.-]|$)/i)?.[1]
    ?.toLowerCase()
  if (prerelease === 'alpha' || prerelease === 'beta' || prerelease === 'rc') return prerelease
  return 'release'
}
