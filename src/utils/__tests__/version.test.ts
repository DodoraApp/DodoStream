import { areVersionsDifferent, extractSemverFromText, normalizeVersion } from '@/utils/version';

describe('version utils', () => {
    it('normalizeVersion strips leading v', () => {
        expect(normalizeVersion('v1.2.3')).toBe('1.2.3');
        expect(normalizeVersion('V1.2.3')).toBe('1.2.3');
    });

    it('extractSemverFromText extracts semver from tags', () => {
        expect(extractSemverFromText('v1.2.3')).toBe('1.2.3');
        expect(extractSemverFromText('release-10.20.30')).toBe('10.20.30');
        expect(extractSemverFromText('1.2')).toBe('1.2');
        expect(extractSemverFromText('nope')).toBeNull();
    });

    it('areVersionsDifferent compares semver-ish versions', () => {
        expect(areVersionsDifferent('0.0.1', '0.0.1')).toBe(false);
        expect(areVersionsDifferent('0.0.1', 'v0.0.1')).toBe(false);
        expect(areVersionsDifferent('0.0.1', '0.0.2')).toBe(true);
        expect(areVersionsDifferent('1.2', '1.2.0')).toBe(false);
    });
});
