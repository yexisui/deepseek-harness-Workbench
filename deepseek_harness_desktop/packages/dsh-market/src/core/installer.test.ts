import { describe, expect, it } from 'vitest'
import { isSafeRel, MAX_FILES_PER_ASSET, PROVENANCE_FILENAME } from './installer.ts'

describe('passive asset contracts', () => {
  it('retains provenance identity and the build-time file cap', () => {
    expect(PROVENANCE_FILENAME).toBe('dsh-market.provenance.json')
    expect(MAX_FILES_PER_ASSET).toBe(2000)
  })
  it('accepts ordinary relative paths and rejects traversal and absolute paths', () => {
    expect(isSafeRel('assets/pet.webp')).toBe(true)
    for (const path of ['../outside', '/outside', 'a//b', 'a/../../b', 'C:/x', 'a\\b']) expect(isSafeRel(path), path).toBe(false)
  })
})
