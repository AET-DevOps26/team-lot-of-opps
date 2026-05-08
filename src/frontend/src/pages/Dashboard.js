import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import useT from '../i18n/useT';
import Icon from '../components/Icon';
const EXPENSE_BARS = [
    { label: 'Fachliteratur', amount: '€850', width: '65%', bar: 'bg-primary' },
    { label: 'Fahrtkosten', amount: '€420', width: '45%', bar: 'bg-surface-tint' },
    { label: 'Arbeitsmittel', amount: '€310', width: '30%', bar: 'bg-primary-fixed-dim' },
    { label: 'Reisekosten', amount: '€1200', width: '80%', bar: 'bg-surface-container-highest' },
];
const CARD_SHADOW = 'shadow-[0px_4px_20px_rgba(26,43,60,0.05)]';
const CARD_BASE = `bg-surface-container-lowest border border-outline-variant rounded-xl p-6 ${CARD_SHADOW}`;
function IntelligenceRail() {
    return _jsx("div", { className: "absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#9333ea] to-[#2563eb]" });
}
function SummaryCard({ label, value, hint, hintIcon, hintColor, highlight = false }) {
    const containerClass = highlight
        ? `relative overflow-hidden bg-[#ECFDF5] border border-secondary-fixed-dim rounded-xl p-6 ${CARD_SHADOW}`
        : CARD_BASE;
    const labelClass = highlight ? 'text-on-secondary-container' : 'text-on-surface-variant';
    const valueClass = highlight ? 'text-secondary' : 'text-primary';
    const hintTextClass = highlight ? 'text-on-secondary-fixed-variant' : hintColor || 'text-on-surface-variant';
    return (_jsxs("div", { className: containerClass, children: [highlight && _jsx(IntelligenceRail, {}), _jsx("p", { className: `font-label-caps text-label-caps mb-2 uppercase tracking-widest ${labelClass}`, children: label }), _jsx("p", { className: `font-h2 text-h2 mb-1 ${valueClass}`, children: value }), hint && (_jsxs("div", { className: `flex items-center gap-1 ${hintTextClass}`, children: [hintIcon && _jsx(Icon, { name: hintIcon, size: 16 }), _jsx("span", { className: "font-body-sm text-body-sm", children: hint })] }))] }));
}
export default function Dashboard() {
    const t = useT();
    const summaryCards = [
        {
            label: t('dashboard.cards.totalExpenses'),
            value: '€4,250.00',
            hint: t('dashboard.cards.sinceLastUpload'),
            hintIcon: 'trending_up',
            hintColor: 'text-secondary',
        },
        {
            label: t('dashboard.cards.carryforward'),
            value: '€3,800.00',
            highlight: true,
        },
        {
            label: t('dashboard.cards.futureRefund'),
            value: '~€1,140.00',
            hint: t('dashboard.cards.taxRateNote'),
            hintIcon: 'info',
        },
    ];
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "mb-10", children: [_jsx("h1", { className: "font-h1 text-h1 text-primary mb-2", children: t('dashboard.title') }), _jsx("p", { className: "font-body-lg text-body-lg text-on-surface-variant", children: t('dashboard.subtitle') })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6 mb-10", children: summaryCards.map((card) => (_jsx(SummaryCard, { ...card }, card.label))) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-8", children: [_jsxs("div", { className: "lg:col-span-2 space-y-8", children: [_jsxs("section", { className: CARD_BASE, children: [_jsxs("div", { className: "flex justify-between items-center mb-6", children: [_jsx("h3", { className: "font-h3 text-h3 text-primary", children: t('dashboard.categories.title') }), _jsxs("button", { className: "font-body-sm text-body-sm text-surface-tint flex items-center gap-1 hover:text-primary transition-colors", children: [t('dashboard.categories.filter'), " ", _jsx(Icon, { name: "filter_list", size: 18 })] })] }), _jsx("div", { className: "space-y-4", children: EXPENSE_BARS.map((row) => (_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "w-32 font-body-sm text-body-sm text-on-surface-variant truncate", children: row.label }), _jsx("div", { className: "flex-1 h-3 bg-surface-container rounded-full overflow-hidden", children: _jsx("div", { className: `h-full ${row.bar}`, style: { width: row.width } }) }), _jsx("div", { className: "w-16 text-right font-data-mono text-data-mono text-primary", children: row.amount })] }, row.label))) })] }), _jsxs("section", { className: CARD_BASE, children: [_jsxs("h3", { className: "font-h3 text-h3 text-primary mb-4 flex items-center gap-2", children: [_jsx(Icon, { name: "calculate", className: "text-surface-tint" }), t('dashboard.savings.title')] }), _jsxs("div", { className: "bg-surface p-4 rounded-lg border border-surface-container-highest", children: [_jsx("p", { className: "font-body-sm text-body-sm text-on-surface-variant mb-4", children: t('dashboard.savings.intro') }), _jsxs("div", { className: "space-y-2 border-l-2 border-primary-fixed-dim pl-4", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "font-body-sm text-body-sm text-on-surface-variant", children: t('dashboard.savings.recordedExpenses') }), _jsx("span", { className: "font-data-mono text-data-mono text-primary", children: "\u20AC3,800" })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "font-body-sm text-body-sm text-on-surface-variant", children: t('dashboard.savings.futureTaxRate') }), _jsx("span", { className: "font-data-mono text-data-mono text-primary", children: "x 0.30" })] }), _jsx("div", { className: "w-full h-px bg-surface-container-highest my-2" }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "font-body-md text-body-md font-semibold text-primary", children: t('dashboard.savings.futureRefund') }), _jsx("span", { className: "font-data-mono text-data-mono text-secondary font-semibold", children: "\u20AC1,140" })] })] })] })] })] }), _jsx("aside", { className: "space-y-6", children: _jsxs("section", { className: `relative overflow-hidden ${CARD_BASE}`, children: [_jsx(IntelligenceRail, {}), _jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(Icon, { name: "auto_awesome", className: "text-[#9333ea]" }), _jsx("h3", { className: "font-h3 text-h3 text-primary", children: t('dashboard.ai.title') })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-error-container/30 border border-error-container p-4 rounded-lg", children: [_jsx("p", { className: "font-body-sm text-body-sm text-on-surface mb-3", children: t('dashboard.ai.suggestion1') }), _jsxs("button", { className: "bg-white border border-outline-variant text-primary font-body-sm text-body-sm px-3 py-1.5 rounded hover:bg-surface-container transition-colors flex items-center gap-1 w-full justify-center", children: [_jsx(Icon, { name: "upload", size: 16 }), " ", t('dashboard.ai.uploadFlight')] })] }), _jsxs("div", { className: "bg-surface p-4 rounded-lg border border-surface-container-highest", children: [_jsx("p", { className: "font-body-sm text-body-sm text-on-surface mb-3", children: t('dashboard.ai.suggestion2') }), _jsxs("button", { className: "text-surface-tint font-body-sm text-body-sm hover:text-primary transition-colors flex items-center gap-1", children: [t('dashboard.ai.addPauschale'), " ", _jsx(Icon, { name: "arrow_forward", size: 16 })] })] })] })] }) })] })] }));
}
