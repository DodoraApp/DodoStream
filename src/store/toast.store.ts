import { create } from 'zustand';
import {
    TOAST_DURATION_MEDIUM,
    TOAST_MAX_VISIBLE,
} from '@/constants/ui';

export type ToastPreset = 'default' | 'success' | 'error' | 'warning';
export type ToastHaptic = 'success' | 'warning' | 'error' | 'none';

export interface ToastOptions {
    /** Toast title (required) */
    title: string;
    /** Optional message/description */
    message?: string;
    /** Visual preset - affects icon and styling */
    preset?: ToastPreset;
    /** Haptic feedback type */
    haptic?: ToastHaptic;
    /** Duration in milliseconds before auto-dismiss */
    duration?: number;
    /** Unique identifier - auto-generated if not provided */
    id?: string;
}

export interface Toast extends Required<Omit<ToastOptions, 'message' | 'haptic'>> {
    message?: string;
    haptic: ToastHaptic;
    /** Timestamp when toast was created */
    createdAt: number;
}

interface ToastStore {
    toasts: Toast[];
    addToast: (options: ToastOptions) => string;
    removeToast: (id: string) => void;
    clearAllToasts: () => void;
}

let toastCounter = 0;

const generateToastId = (): string => {
    toastCounter += 1;
    return `toast-${Date.now()}-${toastCounter}`;
};

export const useToastStore = create<ToastStore>((set, get) => ({
    toasts: [],

    addToast: (options: ToastOptions) => {
        const id = options.id ?? generateToastId();
        const preset = options.preset ?? 'default';

        // Derive haptic from preset if not explicitly provided
        const haptic = options.haptic ?? ((): ToastHaptic => {
            switch (preset) {
                case 'success': return 'success';
                case 'error': return 'error';
                case 'warning': return 'warning';
                default: return 'none';
            }
        })();

        const toast: Toast = {
            id,
            title: options.title,
            message: options.message,
            preset,
            haptic,
            duration: options.duration ?? TOAST_DURATION_MEDIUM,
            createdAt: Date.now(),
        };

        set((state) => {
            // Limit to max visible toasts, removing oldest if needed
            const newToasts = [...state.toasts, toast];
            if (newToasts.length > TOAST_MAX_VISIBLE) {
                return { toasts: newToasts.slice(-TOAST_MAX_VISIBLE) };
            }
            return { toasts: newToasts };
        });

        // Schedule auto-removal
        if (toast.duration > 0) {
            setTimeout(() => {
                get().removeToast(id);
            }, toast.duration);
        }

        return id;
    },

    removeToast: (id: string) => {
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
        }));
    },

    clearAllToasts: () => {
        set({ toasts: [] });
    },
}));

/**
 * Show a toast notification.
 * This is the primary API for displaying toasts throughout the app.
 *
 * @example
 * ```ts
 * import { showToast } from '@/store/toast.store';
 *
 * // Simple toast
 * showToast({ title: 'Saved!' });
 *
 * // Error toast
 * showToast({
 *   title: 'Error',
 *   message: 'Something went wrong',
 *   preset: 'error',
 * });
 *
 * // Custom duration
 * showToast({
 *   title: 'Important',
 *   duration: 5000,
 * });
 * ```
 */
export const showToast = (options: ToastOptions): string => {
    return useToastStore.getState().addToast(options);
};
