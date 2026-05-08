import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Icon from './Icon';
export default function ChatFab() {
    return (_jsxs("button", { "aria-label": "Open AI Assistant", className: "fixed bottom-8 right-8 z-50 w-14 h-14 bg-primary text-on-primary rounded-full shadow-[0_8px_30px_rgba(4,22,39,0.3)] flex items-center justify-center hover:bg-primary-container focus:outline-none focus:ring-4 focus:ring-primary-fixed transition-transform hover:scale-105 group", children: [_jsx("span", { className: "absolute -top-1 -right-1 w-3 h-3 bg-secondary rounded-full border-2 border-white" }), _jsx(Icon, { name: "smart_toy", filled: true, size: 28, className: "group-hover:scale-110 transition-transform" })] }));
}
