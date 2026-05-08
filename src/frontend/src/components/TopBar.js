import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { openSettings } from '../features/uiSlice';
import { useAppDispatch } from '../store/hooks';
import useT from '../i18n/useT';
import Icon from './Icon';
export default function TopBar() {
    const t = useT();
    const dispatch = useAppDispatch();
    return (_jsxs("header", { className: "flex justify-between items-center h-16 px-6 w-full fixed top-0 left-0 z-50 bg-white border-b border-slate-200 shadow-sm", children: [_jsx("div", { className: "flex items-center gap-4", children: _jsx("span", { className: "text-xl font-bold tracking-tight text-slate-900", children: t('brand') }) }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsx("button", { onClick: () => dispatch(openSettings()), "aria-label": t('nav.settings'), className: "text-slate-500 hover:bg-slate-50 transition-colors p-2 rounded-full flex items-center justify-center", children: _jsx(Icon, { name: "settings" }) }), _jsx("button", { className: "ml-2 font-medium text-blue-700 hover:bg-slate-50 px-4 py-2 rounded-lg transition-colors", children: t('topbar.logIn') })] })] }));
}
