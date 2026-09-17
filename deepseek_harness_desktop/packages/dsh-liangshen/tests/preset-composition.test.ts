/**
 * Composition guard for the shipped preset file: the committed
 * `agent.cordis.yml` must stay structurally valid, mount the two preset-local
 * plugins, and keep the persona row on the schema the installed SDK accepts.
 *
 * The persona section-name assertion is the regression guard for the class of
 * defect where a harness rename silently stops matching a hardcoded name —
 * the filter then drops every section and the session runs on an empty system
 * prompt. The names are pinned against the installed SDK constant instead of a
 * copy of it.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PERSONA_PREFIX_SECTION, PERSONA_SUFFIX_SECTION } from '@deepseek-ai/dsh-system-prompt'
import { describe, expect, it } from 'vitest'

import { PERSONA_SECTION_NAMES, PLAN_POLICY_SECTION_NAME, name as promptName } from '../presets/liangshen/minimal-prompt.mjs'
import { name as catalogName } from '../presets/liangshen/tool-catalog.mjs'
import { validateAgentCordis } from '../src/schema.ts'

const preset = readFileSync(join(process.cwd(), 'presets/liangshen/agent.cordis.yml'), 'utf8')

/** The text of one top-level `- id: <id>` row, up to the next row. */
function row(id: string): string {
  const start = preset.indexOf(`- id: ${id}\n`)
  if (start < 0) return ''
  const rest = preset.slice(start + 1)
  const next = rest.search(/^- id: /m)
  return next < 0 ? rest : rest.slice(0, next)
}

describe('liangshen preset composition', () => {
  it('is structurally valid for the preset loader', () => {
    expect(validateAgentCordis(preset)).toEqual([])
  })

  it('mounts the minimal-prompt and tool-catalog plugins', () => {
    expect(promptName).toBe('liangshen-minimal-prompt')
    expect(catalogName).toBe('liangshen-tool-catalog')
    expect(row('minimal-prompt')).toContain('name: ./minimal-prompt.mjs')
    expect(row('tool-catalog')).toContain('name: ./tool-catalog.mjs')
    expect(preset).not.toContain('tool-bootstrap')
  })

  it('keeps the persona row on the current schema with the discipline prefix', () => {
    const persona = row('persona')
    expect(persona).toContain("name: '@deepseek-ai/dsh-persona'")
    expect(persona).toContain('prefix: |-')
    expect(persona).toContain('You are a helpful software engineer assistant.')
    // The standing working discipline ships inside the persona prefix.
    expect(persona).toContain('Avoid falling into repetitive loops during thinking')
    expect(persona).toContain('YAGNI programming philosophy and the PDCA behavioral standard')
    expect(persona).toContain('No need to write comments for the code.')
    expect(persona).not.toContain('text:')
    expect(persona).not.toContain('complete:')
    // Runtime contexts are durable user-role messages, not prompt text: they
    // stay enabled.
    expect(persona).not.toContain('includeRuntimeContext')
  })

  it('declares both plugin configs explicitly', () => {
    expect(row('minimal-prompt')).toContain('keepPlanPolicy: true')
    expect(row('minimal-prompt')).toContain('instructionSource: system-prompt')
    expect(row('minimal-prompt')).toContain('instructionMaxBytes: 65536')
    expect(row('tool-catalog')).toContain('descriptionMaxLength: 200')
  })

  it('anchors the first turn on bash, str_replace_editor, exit_plan_mode, skill and presents PTC after it', () => {
    expect(row('tool-catalog')).toContain('anchorTools: [bash, str_replace_editor, exit_plan_mode, skill]')
    expect(row('tool-catalog')).toContain('ptcPresentation: true')
  })

  it('supports bash-only configuration experiment via anchorTools row without registry changes', () => {
    const bashOnlyPreset = preset.replace(
      'anchorTools: [bash, str_replace_editor, exit_plan_mode, skill]',
      'anchorTools: [bash]'
    )
    expect(validateAgentCordis(bashOnlyPreset)).toEqual([])
  })

  it('keeps run_code the only model-authored orchestration surface', () => {
    // The builtin PTC preset's one roster difference: the engine row stays for
    // `ralph`, the workflow tool does not publish beside `run_code`.
    const workflow = row('workflow-worker-thread')
    expect(workflow).toContain("name: '@deepseek-ai/dsh-tool-workflow'")
    expect(workflow).toContain('disabled: true')
  })

  it('accepts the persona section name the installed SDK registers', () => {
    expect(PERSONA_SECTION_NAMES).toContain(PERSONA_PREFIX_SECTION)
    expect(PERSONA_SECTION_NAMES).not.toContain(PERSONA_SUFFIX_SECTION)
    expect(PLAN_POLICY_SECTION_NAME).toBe('plan:policy')
  })
})
