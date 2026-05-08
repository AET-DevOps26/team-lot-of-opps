import type { CSSProperties } from 'react'

interface IconProps {
  name: string
  filled?: boolean
  className?: string
  size?: number
}

export default function Icon({ name, filled = false, className = '', size }: IconProps) {
  const style: CSSProperties = {}
  if (filled) style.fontVariationSettings = "'FILL' 1"
  if (size != null) style.fontSize = `${size}px`

  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {name}
    </span>
  )
}
