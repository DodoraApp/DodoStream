/**
 * Deterministic E2E/visual-regression mode flag.
 *
 * Set `EXPO_PUBLIC_E2E=1` only for the Android E2E build variant. Production
 * builds never receive this flag, so the deterministic hero selection and
 * auto-scroll suppression stay confined to the test path.
 */
export const IS_E2E = process.env.EXPO_PUBLIC_E2E === '1';
