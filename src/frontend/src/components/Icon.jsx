export default function Icon({ name, filled = false, className = '', size }) {
  const style = {}
  if (filled) style.fontVariationSettings = "'FILL' 1"
  if (size) style.fontSize = `${size}px`
  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {name}
    </span>
  )
}
