// After a click, take focus off the control. Otherwise Space (record a take,
// SPEC 0.6) would press the focused button again or reopen the focused list.
export function releaseFocus(element: HTMLElement): void {
  element.blur()
}
