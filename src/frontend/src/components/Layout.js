import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import SideNav from './SideNav';
import ChatFab from './ChatFab';
import SettingsModal from './SettingsModal';
export default function Layout() {
    return (_jsxs("div", { className: "min-h-screen bg-background text-on-background", children: [_jsx(TopBar, {}), _jsx(SideNav, {}), _jsx("main", { className: "pt-16 md:pl-64 min-h-screen", children: _jsx("div", { className: "max-w-container-max mx-auto w-full px-gutter py-lg", children: _jsx(Outlet, {}) }) }), _jsx(ChatFab, {}), _jsx(SettingsModal, {})] }));
}
