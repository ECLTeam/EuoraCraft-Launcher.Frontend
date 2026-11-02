import { expect, it } from 'vitest'
import { reactive } from 'vue'
import { changedConfigFields, configValuesEqual, copyConfigValue } from './configValue'

it('配置比较忽略对象键顺序及 JSON 不传输的 undefined，保留数组与 null 语义', () => {
  expect(configValuesEqual({ b: [1, 2], a: { enabled: true } }, { a: { enabled: true }, b: [1, 2] })).toBe(true)
  expect(configValuesEqual({ a: undefined }, {})).toBe(true)
  expect(configValuesEqual({ a: null }, {})).toBe(false)
  expect(configValuesEqual([1, 2], [2, 1])).toBe(false)
})

it('复制嵌套响应式配置并仅返回已编辑字段', () => {
  const current = reactive({ list: [{ value: 'a' }], enabled: false })
  const draft = copyConfigValue(current)
  draft.list[0]!.value = 'b'
  expect(current.list[0]!.value).toBe('a')
  expect(changedConfigFields(current, draft)).toEqual({ list: [{ value: 'b' }] })
})
