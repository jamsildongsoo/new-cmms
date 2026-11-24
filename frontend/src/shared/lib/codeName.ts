export function codeName(code: string | null | undefined, name: string | null | undefined) {
  if (!code) return ''
  return name ? `${code}(${name})` : code
}
