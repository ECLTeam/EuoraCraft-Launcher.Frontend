/** 按 JSON 配置的传输语义比较内容；对象键顺序不影响结果，数组顺序保留。 */
export function configValuesEqual(left: unknown, right: unknown): boolean {
  const serialize = (input: unknown) =>
    JSON.stringify(input, (_key, value: unknown) => {
      if (value && typeof value === 'object' && !Array.isArray(value))
        return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
      return value
    })
  return serialize(left) === serialize(right)
}

/** 配置快照只含 JSON 值，复制时同时解除嵌套 Vue proxy 与调用方的可变引用。 */
export function copyConfigValue<T>(value: T): T {
  if (value === undefined) return value
  return JSON.parse(JSON.stringify(value)) as T
}

/** 只提交实际编辑的字段，保留其他消费者更新的配置。 */
export function changedConfigFields<T extends object>(confirmed: T, draft: T): Partial<T> {
  const patch: Partial<T> = {}
  for (const key of Object.keys(draft) as Array<keyof T>) {
    if (!configValuesEqual(confirmed[key], draft[key])) patch[key] = copyConfigValue(draft[key])
  }
  return patch
}
