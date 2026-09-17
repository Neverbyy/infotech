import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import PhoneInput from './PhoneInput.vue'

function mountInput(modelValue = '') {
  return mount(PhoneInput, { props: { modelValue, 'onUpdate:modelValue': () => {} } })
}

function field(wrapper: VueWrapper) {
  return wrapper.find('input')
}

function value(wrapper: VueWrapper): string {
  return (field(wrapper).element as HTMLInputElement).value
}

function model(wrapper: VueWrapper): string | undefined {
  const emitted = wrapper.emitted('update:modelValue')
  return emitted ? (emitted.at(-1)?.[0] as string) : undefined
}

function caret(wrapper: VueWrapper): number | null {
  return (field(wrapper).element as HTMLInputElement).selectionStart
}

/** Печатает символ в позицию каретки, как при правке в середине строки. */
async function typeAt(wrapper: VueWrapper, position: number, char: string): Promise<void> {
  const input = field(wrapper)
  const element = input.element as HTMLInputElement

  element.value = element.value.slice(0, position) + char + element.value.slice(position)
  element.setSelectionRange(position + 1, position + 1)
  await input.trigger('input')
  await nextTick()
}

/** Печатает текст посимвольно в конец поля, как это делает человек. */
async function type(wrapper: VueWrapper, text: string): Promise<void> {
  const input = field(wrapper)
  const element = input.element as HTMLInputElement

  for (const char of text) {
    element.value += char
    element.setSelectionRange(element.value.length, element.value.length)
    await input.trigger('input')
    await nextTick()
  }
}

/** Имитирует вставку: значение заменяется целиком. */
async function paste(wrapper: VueWrapper, text: string): Promise<void> {
  const input = field(wrapper)
  const element = input.element as HTMLInputElement

  element.value = text
  element.setSelectionRange(text.length, text.length)
  await input.trigger('input')
  await nextTick()
}

describe('PhoneInput', () => {
  it('накладывает маску по мере ввода', async () => {
    const wrapper = mountInput()

    await type(wrapper, '9')
    expect(value(wrapper)).toBe('+7 (9')

    await type(wrapper, '99')
    expect(value(wrapper)).toBe('+7 (999')

    await type(wrapper, '1')
    expect(value(wrapper)).toBe('+7 (999) 1')

    await type(wrapper, '23')
    expect(value(wrapper)).toBe('+7 (999) 123')

    await type(wrapper, '45')
    expect(value(wrapper)).toBe('+7 (999) 123-45')

    await type(wrapper, '67')
    expect(value(wrapper)).toBe('+7 (999) 123-45-67')
  })

  it('ставит каретку сразу за первой введённой цифрой', async () => {
    const wrapper = mountInput()

    await type(wrapper, '2')

    expect(value(wrapper)).toBe('+7 (2')
    // Каретка должна стоять после «2», а не между «(» и «2».
    expect(caret(wrapper)).toBe(5)
  })

  it('держит каретку в конце по мере набора', async () => {
    const wrapper = mountInput()

    for (const expected of [5, 6, 7, 10, 11, 12, 14, 15, 17, 18]) {
      await type(wrapper, '9')
      expect(caret(wrapper)).toBe(expected)
    }
  })

  it('перескакивает через разделитель, когда группа заполнена', async () => {
    const wrapper = mountInput()

    await type(wrapper, '999')
    expect(value(wrapper)).toBe('+7 (999')
    expect(caret(wrapper)).toBe(7)

    await type(wrapper, '1')
    // Каретка встаёт за «1», а не перед скобкой и пробелом.
    expect(value(wrapper)).toBe('+7 (999) 1')
    expect(caret(wrapper)).toBe(10)
  })

  it('оставляет каретку у правки в середине номера', async () => {
    const wrapper = mountInput()
    await type(wrapper, '9991234567')

    // Вставляем «8» после «+7 (999»
    await typeAt(wrapper, 7, '8')

    expect(value(wrapper)).toBe('+7 (999) 812-34-56')
    expect(caret(wrapper)).toBe(10)
  })

  it('уводит каретку в конец после вставки', async () => {
    const wrapper = mountInput()

    await paste(wrapper, '+7 (999) 123-45-67')

    expect(caret(wrapper)).toBe('+7 (999) 123-45-67'.length)
  })

  it('отдаёт в модель номер в формате шлюза', async () => {
    const wrapper = mountInput()

    await type(wrapper, '9991234567')

    expect(model(wrapper)).toBe('79991234567')
  })

  it('съедает ведущую 8 как код страны', async () => {
    const wrapper = mountInput()

    await type(wrapper, '89991234567')

    expect(value(wrapper)).toBe('+7 (999) 123-45-67')
    expect(model(wrapper)).toBe('79991234567')
  })

  it('игнорирует буквы и лишние символы', async () => {
    const wrapper = mountInput()

    await type(wrapper, 'abc999xyz1234567!!!')

    expect(value(wrapper)).toBe('+7 (999) 123-45-67')
    expect(model(wrapper)).toBe('79991234567')
  })

  it('не даёт ввести больше десяти цифр номера', async () => {
    const wrapper = mountInput()

    await type(wrapper, '99912345678888')

    expect(value(wrapper)).toBe('+7 (999) 123-45-67')
    expect(model(wrapper)).toBe('79991234567')
  })

  it.each([
    ['+7 (999) 123-45-67', '79991234567'],
    ['8 999 123 45 67', '79991234567'],
    ['79991234567', '79991234567'],
    ['9991234567', '79991234567'],
  ])('разбирает вставленный номер «%s»', async (pasted, expected) => {
    const wrapper = mountInput()

    await paste(wrapper, pasted)

    expect(value(wrapper)).toBe('+7 (999) 123-45-67')
    expect(model(wrapper)).toBe(expected)
  })

  it('стирает цифру по Backspace, не залипая на разделителе', async () => {
    const wrapper = mountInput()
    await type(wrapper, '999123')
    expect(value(wrapper)).toBe('+7 (999) 123')

    const input = field(wrapper)
    const element = input.element as HTMLInputElement

    // Backspace: браузер убирает символ, компонент пересобирает маску.
    for (const expected of ['+7 (999) 12', '+7 (999) 1', '+7 (999', '+7 (99']) {
      element.value = element.value.slice(0, -1)
      await input.trigger('input')
      await nextTick()
      expect(value(wrapper)).toBe(expected)
    }
  })

  it('очищает поле, когда стёрли всё', async () => {
    const wrapper = mountInput()
    await type(wrapper, '9')

    const input = field(wrapper)
    const element = input.element as HTMLInputElement
    element.value = ''
    await input.trigger('input')
    await nextTick()

    expect(value(wrapper)).toBe('')
    expect(model(wrapper)).toBe('')
  })

  it('показывает номер, пришедший из модели', () => {
    const wrapper = mountInput('79991234567')
    expect(value(wrapper)).toBe('+7 (999) 123-45-67')
  })

  it('сообщает родителю об уходе фокуса', async () => {
    const wrapper = mountInput()

    await field(wrapper).trigger('blur')

    expect(wrapper.emitted('blur')).toHaveLength(1)
  })

  it('помечает поле как некорректное, когда есть ошибка', () => {
    const wrapper = mount(PhoneInput, { props: { modelValue: '7999', error: 'Формат: +7 999 123-45-67' } })

    expect(field(wrapper).attributes('aria-invalid')).toBe('true')
    expect(wrapper.text()).toContain('Формат: +7 999 123-45-67')
  })
})
