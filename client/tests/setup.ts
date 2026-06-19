import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom does not implement smooth scrolling; ChatPopup calls scrollTo on its
// message container.
Element.prototype.scrollTo = vi.fn()

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
