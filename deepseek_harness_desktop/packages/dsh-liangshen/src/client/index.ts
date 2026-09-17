/**
 * dsh-liangshen browser half: the LiangShen lever in the composer tool row.
 *
 * The slot is `conversation.input.right` — "compact controls before the
 * composer submit action", which renders immediately left of the model
 * selector (`conversation.input.model`) inside the same composer card, on the
 * homepage's new-session hero as well as in a session. The lever lives only
 * while the session is still blank, because that is the only window in which a
 * preset can change at all: `agentPresets.select` refuses an already-started
 * session, and the arm would have nothing to do in one.
 *
 * This half talks to the host over the agent-preset Remote namespace rather
 * than through the official preset package's browser module: cross-plugin
 * collaboration here goes through cordis services and Remote surfaces, not
 * value imports.
 *
 * Failure policy: a missing slot or a refused Remote call is handled, never
 * thrown — one external plugin must not take the GUI boot down.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ui-conversation SlotMap merge (the composer tool row).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { LiangShenLever } from './LiangShenLever.tsx'
import { LeverController } from './lever-controller.ts'
import { en, zh, type LiangShenKey } from './locales.ts'

/** Locale namespace this half owns. */
export const NS = 'liangshen'

/**
 * Required client services: the slot registry, locale, sessions, and the roster
 * Remote. Both `remote` and `remote.agentPresets` are declared: the context
 * proxy refuses an uninjected service, and a nested service name does not imply
 * its parent, so reading `ctx.remote.agentPresets` needs `remote` as well.
 */
export const inject = ['slots', 'locale', 'sessions', 'remote', 'remote.agentPresets']

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The LiangShen lever copy. */
    'liangshen': LiangShenKey
  }
}

export { LiangShenLever } from './LiangShenLever.tsx'
export { LeverController, type LeverFace, type LeverSnapshot } from './lever-controller.ts'
export { LIANGSHEN_PRESET_ID, leverState, restoreTarget, type LeverFacts, type LeverState } from '../core/lever.ts'

/**
 * Mount the lever: register the copy, follow the roster and the current
 * session, and claim the composer tool row.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    try {
      return ctx.locale.register(NS, { zh, en })
    } catch {
      return () => {}
    }
  }, 'liangshen: lever dictionaries')

  const controller = new LeverController(ctx)
  ctx.effect(() => () => controller.dispose(), 'liangshen: lever controller')
  try {
    controller.start()
  } catch {
    // An unavailable sessions or Remote service leaves the lever inert; the
    // view still renders and reports what it knows.
  }

  ctx.slots.inject('conversation.input.right', () => {
    try {
      const unregister = ctx.slots.register({
        name: 'conversation.input.right',
        id: 'liangshen-lever',
        order: 20,
        inject: () => controller.face(),
      }, LiangShenLever)
      return () => { unregister() }
    } catch {
      return () => {}
    }
  })
}
