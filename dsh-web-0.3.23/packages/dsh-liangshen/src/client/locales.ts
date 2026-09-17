/**
 * Lever copy: zh-first dictionary with an English counterpart. The zh side is
 * the key-set source of truth; `packages/dsh-i18n` mirrors the keys into the
 * centralized ru dictionary and `pnpm i18n:check` enforces the parity.
 */

/** Lever copy, key source of truth. */
export const zh = {
  'lever.a11y': '梁神模式拨杆',
  'lever.name': '梁神模式',
  'lever.hint.pull': '拨下拨杆：开启「梁神模式」',
  'lever.hint.push': '上拨拨杆：返回「{preset}」',
  'lever.hint.locked': '会话已开始，模式不可再更改',
  'lever.hint.missing': '未找到「梁神模式」预设，请先启用该插件行',
  'lever.state.on': '梁神模式',
  'lever.state.off': '普通模式',
  'lever.busy': '正在切换…',
  'lever.failed.locked': '会话已经开始，模式已锁定',
  'lever.failed.missing': '没有找到「梁神模式」预设',
  'lever.failed.timeout': '切换超时，请重试',
  'lever.failed.failed': '切换失败：{reason}',
  'burst.line1': '三秒，三辈子的代码',
  'burst.line2': '文言文 · 二进制 · 摩斯电码',
}

/** English counterpart; the key set mirrors {@link zh} exactly. */
export const en: Record<keyof typeof zh, string> = {
  'lever.a11y': 'LiangShen mode lever',
  'lever.name': 'LiangShen mode',
  'lever.hint.pull': 'Pull the lever down to turn on LiangShen mode',
  'lever.hint.push': 'Push the lever up to return to "{preset}"',
  'lever.hint.locked': 'The session has started, so its mode can no longer change',
  'lever.hint.missing': 'The LiangShen preset is not installed; enable that plugin row first',
  'lever.state.on': 'LiangShen',
  'lever.state.off': 'Standard',
  'lever.busy': 'Switching…',
  'lever.failed.locked': 'The session already started, so the mode is locked',
  'lever.failed.missing': 'The LiangShen preset was not found',
  'lever.failed.timeout': 'The switch timed out; try again',
  'lever.failed.failed': 'Switch failed: {reason}',
  'burst.line1': 'Three seconds, three lifetimes of code',
  'burst.line2': 'Classical Chinese · Binary · Morse code',
}

/** One lever copy key. */
export type LiangShenKey = keyof typeof zh
