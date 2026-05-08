import { jsx as _jsx } from "react/jsx-runtime";
export default function Icon({ name, filled = false, className = '', size }) {
    const style = {};
    if (filled)
        style.fontVariationSettings = "'FILL' 1";
    if (size != null)
        style.fontSize = `${size}px`;
    return (_jsx("span", { className: `material-symbols-outlined ${className}`, style: style, children: name }));
}
