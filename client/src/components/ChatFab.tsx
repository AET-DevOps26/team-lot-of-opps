import { useState } from 'react'
import useT from '../i18n/useT'
import Icon from './Icon'
import ChatPopup from './ChatPopup'

export default function ChatFab() {
  const t = useT()
  const [open, setOpen] = useState(false)

  return (
    <>
      <ChatPopup open={open} onClose={() => setOpen(false)} />
      <button
        aria-label={open ? t('chat.close') : t('chat.open')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-8 right-8 z-50 w-14 h-14 bg-primary text-on-primary rounded-full shadow-[0_8px_30px_rgba(4,22,39,0.3)] flex items-center justify-center hover:bg-primary-container focus:outline-none focus:ring-4 focus:ring-primary-fixed transition-transform hover:scale-105 group"
      >
        {!open && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-secondary rounded-full border-2 border-white" />
        )}
        <Icon
          name={open ? 'close' : 'smart_toy'}
          filled
          size={28}
          className="group-hover:scale-110 transition-transform"
        />
      </button>
    </>
  )
}
