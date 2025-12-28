export function normalizeVersion(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return '';
    return trimmed.replace(/^v/i, '');
}

export function extractSemverFromText(input: string): string | null {
    const normalized = normalizeVersion(input);

    // Prefer full x.y.z
    const full = normalized.match(/(\d+)\.(\d+)\.(\d+)/);
    if (full) return `${full[1]}.${full[2]}.${full[3]}`;

    // Fallback: x.y
    const partial = normalized.match(/(\d+)\.(\d+)/);
    if (partial) return `${partial[1]}.${partial[2]}`;

    return null;
}

type VersionParts = [number, number, number];

function parseVersionParts(input: string): VersionParts | null {
    const normalized = normalizeVersion(input);

    const full = normalized.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
    if (full) return [Number(full[1]), Number(full[2]), Number(full[3])];

    const partial = normalized.match(/^(\d+)\.(\d+)(?:[-+].*)?$/);
    if (partial) return [Number(partial[1]), Number(partial[2]), 0];

    const majorOnly = normalized.match(/^(\d+)(?:[-+].*)?$/);
    if (majorOnly) return [Number(majorOnly[1]), 0, 0];

    return null;
}

export function areVersionsDifferent(installed: string, latest: string): boolean {
    const installedParts = parseVersionParts(installed);
    const latestParts = parseVersionParts(latest);

    if (installedParts && latestParts) {
        return (
            installedParts[0] !== latestParts[0] ||
            installedParts[1] !== latestParts[1] ||
            installedParts[2] !== latestParts[2]
        );
    }

    return normalizeVersion(installed) !== normalizeVersion(latest);
}
