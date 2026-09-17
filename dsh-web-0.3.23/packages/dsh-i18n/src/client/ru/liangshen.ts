/**
 * Russian dictionary for the "liangshen" locale namespace.
 * Source package: packages/dsh-liangshen (its zh dictionary is the key source).
 * Maintained centrally by the dsh-i18n language pack; when a zh key is added
 * or changed upstream, mirror it here and run `pnpm i18n:check`.
 */

export const ru: Record<string, string> = {
  'burst.line1': 'Три секунды, три жизни кода',
  'burst.line2': 'Вэньянь · двоичный код · азбука Морзе',
  'lever.a11y': 'Рычаг режима Ляншэнь',
  'lever.busy': 'Переключение…',
  'lever.failed.failed': 'Не удалось переключить: {reason}',
  'lever.failed.locked': 'Сессия уже началась, режим заблокирован',
  'lever.failed.missing': 'Пресет «Ляншэнь» не найден',
  'lever.failed.timeout': 'Тайм-аут переключения; повторите попытку',
  'lever.hint.locked': 'Сессия уже началась, режим больше не изменить',
  'lever.hint.missing': 'Пресет «Ляншэнь» не установлен; сначала включите эту строку плагина',
  'lever.hint.pull': 'Потяните рычаг вниз, чтобы включить режим Ляншэнь',
  'lever.hint.push': 'Поднимите рычаг вверх, чтобы вернуться к «{preset}»',
  'lever.name': 'Режим Ляншэнь',
  'lever.state.off': 'Обычный режим',
  'lever.state.on': 'Режим Ляншэнь',
}
