// @vitest-environment jsdom
/**
 * "Parse pasted text" section of the new-task form (issue #1540): it appears
 * only where the deployment can parse, sends the pasted text plus the picked
 * model route to the Host, fills the three fields from the draft, and shows a
 * plain-language reason when the parse fails.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NewTaskModal } from '../src/client/board/NewTaskModal.tsx'
import { t } from '../src/client/locales.ts'
import type { BoardController, ControllerSnapshot } from '../src/core/controller.ts'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const roots: Root[] = []

afterEach(() => {
  for (const root of roots.splice(0)) act(() => { root.unmount() })
  document.body.replaceChildren()
})

const draft = { title: 'Parsed title', description: 'Parsed description', prompt: 'Parsed prompt' }

function renderModal(options: { canParseTask?: boolean; parseTaskDraft?: unknown } = {}): {
  container: HTMLElement
  parseTaskDraft: ReturnType<typeof vi.fn>
} {
  const parseTaskDraft = (options.parseTaskDraft ?? vi.fn(async () => draft)) as ReturnType<typeof vi.fn>
  const snapshot: ControllerSnapshot = {
    tasks: [],
    boardOpen: true,
    archiveView: false,
    selectedTaskId: undefined,
    executionOptions: {
      workspaces: [],
      presets: [],
      models: [{ id: 'deepseek/deepseek-chat', name: 'deepseek-chat' }],
    },
    pendingTaskIds: [],
    ...(options.canParseTask === false ? {} : { canParseTask: true }),
  }
  const controller = {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    createTaskConfirmed: vi.fn(),
    parseTaskDraft,
  } as unknown as BoardController
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  act(() => { root.render(<NewTaskModal controller={controller} onClose={() => undefined} />) })
  return { container, parseTaskDraft }
}

function field(container: HTMLElement, placeholder: string): HTMLInputElement | HTMLTextAreaElement {
  const element = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[placeholder="${placeholder}"]`)
  if (element === null) throw new Error(`no field with placeholder ${placeholder}`)
  return element
}

function typeInto(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')!.set!
  act(() => {
    setter.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function parseButton(container: HTMLElement): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find(candidate => candidate.textContent === t('new.aiParseRun'))
  if (button === undefined) throw new Error('no parse button')
  return button as HTMLButtonElement
}

describe('new-task AI parse section (#1540)', () => {
  it('stays hidden when the deployment cannot parse', () => {
    const { container } = renderModal({ canParseTask: false })
    expect(container.querySelector('[data-dsh-part="ai-parse"]')).toBeNull()
  })

  it('sends the pasted text and the picked model, then fills the form', async () => {
    const { container, parseTaskDraft } = renderModal()
    const section = container.querySelector('[data-dsh-part="ai-parse"]')
    expect(section).not.toBeNull()
    // The model roster arrives from the runtime: the first entry is preselected.
    expect(section!.querySelector('select')!.value).toBe('deepseek/deepseek-chat')
    expect(parseButton(container).disabled).toBe(true)

    typeInto(field(container, t('new.aiParsePlaceholder')), '  下周三前把报价发给张工  ')
    await act(async () => { parseButton(container).dispatchEvent(new MouseEvent('click', { bubbles: true })) })

    expect(parseTaskDraft).toHaveBeenCalledOnce()
    expect(parseTaskDraft.mock.calls[0]![0]).toEqual({ text: '下周三前把报价发给张工', model: 'deepseek/deepseek-chat' })
    expect(field(container, t('new.titlePlaceholder'))).toHaveProperty('value', draft.title)
    expect(field(container, t('new.descriptionPlaceholder'))).toHaveProperty('value', draft.description)
    expect(field(container, t('new.promptPlaceholder'))).toHaveProperty('value', draft.prompt)
  })

  it('shows the reason a parse failed', async () => {
    const { container } = renderModal({ parseTaskDraft: vi.fn(async () => { throw new Error('没有可用的模型') }) })
    typeInto(field(container, t('new.aiParsePlaceholder')), 'some note')
    await act(async () => { parseButton(container).dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(container.querySelector('[data-dsh-part="ai-parse"]')!.textContent).toContain('没有可用的模型')
    // A failed parse never overwrites what the user already typed.
    expect(field(container, t('new.titlePlaceholder'))).toHaveProperty('value', '')
  })

  it('keeps already typed fields when the parse fails', async () => {
    const { container } = renderModal({ parseTaskDraft: vi.fn(async () => { throw new Error('boom') }) })
    typeInto(field(container, t('new.titlePlaceholder')), '手工写的标题')
    typeInto(field(container, t('new.aiParsePlaceholder')), 'some note')
    await act(async () => { parseButton(container).dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(field(container, t('new.titlePlaceholder'))).toHaveProperty('value', '手工写的标题')
  })
})
