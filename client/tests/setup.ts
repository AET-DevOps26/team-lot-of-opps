import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom does not implement smooth scrolling; ChatPopup calls scrollTo on its
// message container.
Element.prototype.scrollTo = vi.fn()

declare global {
  // eslint-disable-next-line no-var
  var jsdom: { window: Window }
}
Object.defineProperty(globalThis, 'localStorage', {
  value: globalThis.jsdom.window.localStorage,
  configurable: true,
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
