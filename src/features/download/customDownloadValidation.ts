export interface HeaderRow {
  id: number
  name: string
  value: string
}

export function isValidDownloadFilename(name: string): boolean {
  const deviceName = name.split('.')[0]!.replace(/ +$/, '').toUpperCase()
  return (
    !!name &&
    new TextEncoder().encode(name).length <= 255 &&
    !/[<>:"/\\|?*]/u.test(name) &&
    !Array.from(name).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) &&
    !/[ .]$/.test(name) &&
    !/^(CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|COM[1-9¹²³]|LPT[1-9¹²³])$/.test(deviceName)
  )
}

export function downloadValidationKey(options: {
  namingMode: 'original' | 'custom'
  customName: string
  userAgent: string
  headerRows: HeaderRow[]
}): string {
  if (options.namingMode === 'custom' && !isValidDownloadFilename(options.customName))
    return 'advanced.downloadInvalidName'
  const invalidHeader = (value: string) =>
    Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) > 126)
  if (options.userAgent.length > 4096 || invalidHeader(options.userAgent)) return 'advanced.downloadInvalidHeaders'
  const seen = new Set<string>()
  let size = 0
  for (const header of options.headerRows) {
    if (!header.name && !header.value) continue
    const key = header.name.toLowerCase()
    if (key === 'user-agent') return 'advanced.downloadUaHeader'
    if (seen.has(key) || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(header.name) || invalidHeader(header.value))
      return 'advanced.downloadInvalidHeaders'
    seen.add(key)
    size += header.name.length + header.value.length
  }
  return seen.size > 64 || size > 32768 ? 'advanced.downloadInvalidHeaders' : ''
}
