import { createDebugLogger } from '@/utils/debug';
import { GithubApiError } from './errors';
import { GithubLatestReleaseResponse, GithubRelease } from './types';

const debug = createDebugLogger('github.client');

export function toGithubLatestReleaseApiUrl(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    try {
        const parsed = new URL(trimmed);

        // Already the correct API endpoint.
        if (
            parsed.hostname === 'api.github.com' &&
            /^\/repos\/[^/]+\/[^/]+\/releases\/latest\/?$/.test(parsed.pathname)
        ) {
            return parsed.toString();
        }

        // Convert GitHub repo URL -> API latest release endpoint
        if (parsed.hostname === 'github.com') {
            const parts = parsed.pathname.split('/').filter(Boolean);
            const owner = parts[0];
            const repo = parts[1];
            if (!owner || !repo) return null;
            return `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
        }

        return null;
    } catch (error) {
        debug('invalidUrl', { input, error });
        return null;
    }
}

export async function fetchLatestGithubRelease(releasesApiUrl: string): Promise<GithubRelease> {
    const response = await fetch(releasesApiUrl, {
        headers: {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    });

    if (!response.ok) {
        throw GithubApiError.fromResponse(response, releasesApiUrl);
    }

    const json: GithubLatestReleaseResponse = await response.json();

    if (!json.tag_name || !json.html_url) {
        throw new GithubApiError('Invalid GitHub release payload', undefined, releasesApiUrl, json);
    }

    return {
        tagName: json.tag_name,
        name: json.name,
        body: json.body,
        htmlUrl: json.html_url,
        publishedAt: json.published_at,
    };
}
