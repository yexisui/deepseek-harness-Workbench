'use strict'

exports.execute = async ({ action, input }) => {
  if (typeof input !== 'string') throw new Error('请输入文本内容')
  if (action === 'tidy') return input.split(/\r?\n/).map(line => line.trim().replace(/[ \t]+/g, ' ')).join('\n').trim()
  if (action === 'count') return { characters: [...input].length, nonEmptyLines: input.split(/\r?\n/).filter(line => line.trim()).length }
  throw new Error('未知的文字动作')
}
