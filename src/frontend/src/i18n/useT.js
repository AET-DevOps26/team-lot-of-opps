import { useCallback } from 'react';
import { useAppSelector } from '../store/hooks';
import translations from './translations';
function resolve(obj, path) {
    return path.split('.').reduce((acc, key) => {
        if (acc != null && typeof acc === 'object' && key in acc) {
            return acc[key];
        }
        return undefined;
    }, obj);
}
export default function useT() {
    const language = useAppSelector((state) => state.i18n.language);
    return useCallback((key) => {
        const value = resolve(translations[language], key) ?? resolve(translations.en, key);
        return typeof value === 'string' ? value : key;
    }, [language]);
}
