"use client";

import { useSyncExternalStore } from "react";

/**
 * One editor open at a time on a page (a stop's More, a day's add box), so
 * a field filled by its label can only ever reach the entry being edited.
 * Opening another editor closes the current one, unless it has unsaved
 * changes: then it stays open and asks to save or cancel first.
 */

type State = { active: string | null; dirty: boolean; nudged: number };
let state: State = { active: null, dirty: false, nudged: 0 };
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  for (const l of listeners) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const SERVER: State = { active: null, dirty: false, nudged: 0 };

export function useEditor(key: string) {
  const s = useSyncExternalStore(subscribe, () => state, () => SERVER);
  const open = s.active === key;
  return {
    open,
    /** True right after someone tried to open another editor over unsaved changes here. */
    nudged: open && s.nudged > 0,
    /** Opens this editor, unless another one has unsaved changes. Returns whether it opened. */
    request: () => {
      if (state.active === key) return true;
      if (state.active && state.dirty) {
        set({ nudged: state.nudged + 1 });
        return false;
      }
      set({ active: key, dirty: false, nudged: 0 });
      return true;
    },
    /** Closes it, throwing away unsaved changes (Cancel). */
    close: () => {
      if (state.active === key) set({ active: null, dirty: false, nudged: 0 });
    },
    /** Closes it if nothing is unsaved; otherwise asks to save or cancel first. */
    closeIfClean: () => {
      if (state.active !== key) return;
      if (state.dirty) set({ nudged: state.nudged + 1 });
      else set({ active: null, dirty: false, nudged: 0 });
    },
    setDirty: (dirty: boolean) => {
      if (state.active === key && state.dirty !== dirty) set({ dirty });
    },
  };
}
