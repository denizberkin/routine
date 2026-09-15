import type { Slot } from './types'

/** The user's color as a fill (checkboxes, bars, buttons) — vivid in both themes. */
export const fillOf = (slot: Slot) => `var(--${slot})`
/** The same hue for text — darkened in light mode so it stays readable on white. */
export const inkOf = (slot: Slot) => `var(--${slot}-ink)`
