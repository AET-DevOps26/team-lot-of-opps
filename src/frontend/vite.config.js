var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
var apiTarget = process.env.VITE_API_TARGET;
export default defineConfig({
    plugins: [react()],
    server: __assign({ port: 5173, open: true }, (apiTarget && {
        proxy: {
            '/api': {
                target: apiTarget,
                changeOrigin: true,
            },
        },
    })),
});
