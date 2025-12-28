export interface GithubRelease {
    tagName: string;
    name?: string | null;
    body?: string | null;
    htmlUrl: string;
    publishedAt?: string | null;
}

export interface GithubLatestReleaseResponse {
    tag_name?: string;
    name?: string | null;
    body?: string | null;
    html_url?: string;
    published_at?: string | null;
}
