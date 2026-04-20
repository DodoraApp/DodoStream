export interface GithubReleaseAsset {
    name: string;
    browserDownloadUrl: string;
    size: number;
    contentType: string;
}

export interface GithubRelease {
    tagName: string;
    name?: string | null;
    body?: string | null;
    htmlUrl: string;
    publishedAt?: string | null;
    assets: GithubReleaseAsset[];
}

export interface GithubLatestReleaseResponse {
    tag_name?: string;
    name?: string | null;
    body?: string | null;
    html_url?: string;
    published_at?: string | null;
    assets?: {
        name?: string;
        browser_download_url?: string;
        size?: number;
        content_type?: string;
    }[];
}
