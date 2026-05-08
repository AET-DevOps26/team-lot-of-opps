import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import useT from '../i18n/useT';
import Icon from '../components/Icon';
const CARD_SHADOW = 'shadow-[0_4px_20px_rgba(26,43,60,0.05)]';
function QueueItemCard({ item, t }) {
    return (_jsxs("article", { className: `bg-surface-container-lowest rounded-lg border ${CARD_SHADOW} overflow-hidden flex flex-col sm:flex-row items-start sm:items-center p-sm gap-md relative ${item.borderClass || 'border-surface-variant'}`, children: [item.type === 'processing' && (_jsx("div", { className: "absolute top-0 left-0 w-full h-1 bg-[linear-gradient(90deg,#8b5cf6,#3b82f6)]" })), _jsx("div", { className: `p-3 rounded-md ${item.iconWrap}`, children: _jsx(Icon, { name: item.icon }) }), _jsxs("div", { className: "flex-1 flex flex-col gap-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: "font-body-md text-body-md font-medium text-on-surface truncate", children: item.name }), _jsx("span", { className: `font-label-caps text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${item.statusClass}`, children: item.status })] }), _jsx("p", { className: `font-body-sm text-body-sm ${item.metaClass || 'text-on-surface-variant'}`, children: item.meta })] }), item.type === 'processing' && (_jsxs("div", { className: "hidden md:flex items-center gap-xl pr-md", children: [_jsxs("div", { className: "flex flex-col gap-1 w-24", children: [_jsx("div", { className: "h-3 bg-surface-container rounded w-full" }), _jsx("div", { className: "h-4 bg-surface-variant rounded w-3/4" })] }), _jsxs("div", { className: "flex flex-col gap-1 w-24", children: [_jsx("div", { className: "h-3 bg-surface-container rounded w-full" }), _jsx("div", { className: "h-4 bg-surface-variant rounded w-1/2" })] })] })), item.extracted && (_jsx("div", { className: "hidden md:flex items-center gap-xl pr-md text-right", children: item.extracted.map((field) => (_jsxs("div", { className: "flex flex-col", children: [_jsx("span", { className: "font-label-caps text-label-caps text-outline uppercase", children: field.label }), _jsx("span", { className: field.mono
                                ? 'font-data-mono text-data-mono text-on-surface'
                                : 'font-body-md text-body-md text-on-surface font-medium', children: field.value })] }, field.label))) })), item.type === 'error' && (_jsx("div", { className: "hidden md:flex items-center pr-md", children: _jsxs("button", { className: "font-body-sm text-body-sm text-primary font-medium hover:underline flex items-center gap-1", children: [t('upload.review'), " ", _jsx(Icon, { name: "arrow_forward", size: 16 })] }) }))] }));
}
export default function Upload() {
    const t = useT();
    const queueItems = [
        {
            type: 'processing',
            name: 'Q3_Office_Supplies_Invoice.pdf',
            meta: t('upload.meta.uploadedToday'),
            status: t('upload.status.extracting'),
            statusClass: 'bg-primary-fixed text-on-primary-fixed',
            icon: 'receipt_long',
            iconWrap: 'bg-surface-container text-outline',
        },
        {
            type: 'verified',
            name: 'AWS_Server_Hosting_Aug2023.pdf',
            meta: t('upload.meta.uploadedYesterday'),
            status: t('upload.status.verified'),
            statusClass: 'bg-secondary-container text-on-secondary-container',
            icon: 'check_circle',
            iconWrap: 'bg-[#ECFDF5] text-secondary',
            extracted: [
                { label: t('upload.fields.vendor'), value: 'Amazon Web Services' },
                { label: t('upload.fields.amount'), value: '€ 1,245.00', mono: true },
            ],
        },
        {
            type: 'error',
            name: 'Unknown_Receipt_Scan_001.jpg',
            meta: t('upload.meta.missingVendor'),
            metaClass: 'text-error',
            status: t('upload.status.actionNeeded'),
            statusClass: 'bg-tertiary-container text-on-tertiary-container',
            icon: 'error',
            iconWrap: 'bg-error-container text-error',
            borderClass: 'border-error-container',
        },
    ];
    return (_jsxs("div", { className: "flex flex-col gap-lg", children: [_jsxs("header", { className: "flex flex-col gap-base", children: [_jsx("h1", { className: "font-h1 text-h1 text-on-surface", children: t('upload.title') }), _jsx("p", { className: "font-body-lg text-body-lg text-on-surface-variant max-w-2xl", children: t('upload.subtitle') })] }), _jsxs("section", { className: "bg-surface-container-lowest rounded-xl border-2 border-dashed border-outline-variant hover:border-primary focus-within:border-primary focus-within:ring-4 focus-within:ring-primary-fixed cursor-pointer flex flex-col items-center justify-center py-20 px-6 text-center relative overflow-hidden group transition-colors", children: [_jsx("div", { className: "absolute inset-0 bg-primary opacity-0 group-hover:opacity-[0.02] pointer-events-none" }), _jsx("div", { className: "w-16 h-16 mb-6 rounded-full bg-surface-container flex items-center justify-center text-primary group-hover:scale-105 transition-transform", children: _jsx(Icon, { name: "cloud_upload", size: 32 }) }), _jsx("h2", { className: "font-h2 text-h2 text-on-surface mb-2", children: t('upload.dropzone.title') }), _jsx("p", { className: "font-body-md text-body-md text-on-surface-variant mb-6", children: t('upload.dropzone.subtitle') }), _jsxs("div", { className: "flex items-center gap-4 text-outline font-label-caps text-label-caps uppercase", children: [_jsx("span", { children: "PDF" }), _jsx("div", { className: "w-1 h-1 rounded-full bg-outline-variant" }), _jsx("span", { children: "JPG" }), _jsx("div", { className: "w-1 h-1 rounded-full bg-outline-variant" }), _jsx("span", { children: "PNG" }), _jsx("div", { className: "w-1 h-1 rounded-full bg-outline-variant" }), _jsx("span", { children: t('upload.dropzone.maxSize') })] }), _jsx("input", { "aria-label": t('upload.dropzone.title'), className: "absolute inset-0 w-full h-full opacity-0 cursor-pointer", multiple: true, type: "file" })] }), _jsxs("section", { className: "flex flex-col gap-md", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-surface-variant pb-2", children: [_jsx("h3", { className: "font-h3 text-h3 text-on-surface", children: t('upload.queue.title') }), _jsx("button", { className: "font-body-sm text-body-sm text-primary font-medium hover:underline", children: t('upload.queue.viewAll') })] }), _jsx("div", { className: "grid grid-cols-1 gap-sm", children: queueItems.map((item) => (_jsx(QueueItemCard, { item: item, t: t }, item.name))) })] })] }));
}
