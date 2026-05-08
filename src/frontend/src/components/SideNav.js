import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { NavLink } from 'react-router-dom';
import { openSettings } from '../features/uiSlice';
import { useAppDispatch } from '../store/hooks';
import useT from '../i18n/useT';
import Icon from './Icon';
const NAV_ITEMS = [
    { to: '/', icon: 'dashboard', labelKey: 'nav.dashboard', end: true },
    { to: '/documents', icon: 'description', labelKey: 'nav.documents' },
    { to: '/upload', icon: 'upload_file', labelKey: 'nav.upload' },
];
function navClass({ isActive }) {
    return [
        'flex items-center gap-3 p-3 rounded-lg transition-colors text-sm font-semibold tracking-wide',
        isActive
            ? 'bg-white text-blue-700 shadow-sm'
            : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700',
    ].join(' ');
}
export default function SideNav() {
    const t = useT();
    const dispatch = useAppDispatch();
    return (_jsxs("aside", { className: "hidden md:flex fixed left-0 top-16 h-[calc(100vh-64px)] w-64 p-4 flex-col justify-between bg-slate-50 border-r border-slate-200 z-40", children: [_jsxs("div", { children: [_jsxs("div", { className: "mb-8 px-3", children: [_jsx("h2", { className: "text-lg font-extrabold text-slate-900 uppercase tracking-wide", children: t('sidebar.title') }), _jsx("p", { className: "text-xs text-slate-500 mt-1", children: t('sidebar.subtitle') })] }), _jsx("ul", { className: "space-y-2", children: NAV_ITEMS.map((item) => (_jsx("li", { children: _jsx(NavLink, { to: item.to, end: item.end, className: navClass, children: ({ isActive }) => (_jsxs(_Fragment, { children: [_jsx(Icon, { name: item.icon, filled: isActive }), t(item.labelKey)] })) }) }, item.to))) })] }), _jsx("ul", { className: "space-y-2 border-t border-slate-200 pt-4", children: _jsx("li", { children: _jsxs("button", { onClick: () => dispatch(openSettings()), className: "w-full flex items-center gap-3 text-slate-600 p-3 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors text-sm font-semibold tracking-wide", children: [_jsx(Icon, { name: "settings" }), t('nav.settings')] }) }) })] }));
}
