/** Presentation adapter only: native resolution and historical session presets remain intact. */
export function isManagedPreset(id: string) { return /^workbench-role-[a-z][a-z0-9-]*-v[1-9][0-9]*$/.test(id) }
type Roster = { rows: { id: string }[] }
type RosterHook<S extends Roster> = <T>(selector: (snapshot: S) => T) => T
export function nativePresetHook<S extends Roster>(useRoster: RosterHook<S>): RosterHook<S> {
  const projected = new WeakMap<S, S>()
  return function useNativePresets<T>(selector: (snapshot: S) => T) {
    return useRoster(snapshot => {
      let value = projected.get(snapshot)
      if (!value) { value = { ...snapshot, rows: snapshot.rows.filter(row => !isManagedPreset(row.id)) }; projected.set(snapshot, value) }
      return selector(value)
    })
  }
}
