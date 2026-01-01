import type { MetaVideo } from '@/types/stremio';

/**
 * Sorts videos by season and episode, with season 0 (Specials) always last.
 * This ensures consistent ordering across the app for continue watching,
 * up next, and episode list display.
 */
export const sortVideosBySeason = (videos: MetaVideo[] | undefined): MetaVideo[] => {
    if (!videos || videos.length === 0) return [];

    return [...videos].sort((a, b) => {
        const seasonA = a.season ?? 0;
        const seasonB = b.season ?? 0;

        // Season 0 (Specials) always last
        if (seasonA === 0 && seasonB !== 0) return 1;
        if (seasonB === 0 && seasonA !== 0) return -1;

        // Sort by season first
        if (seasonA !== seasonB) return seasonA - seasonB;

        // Then by episode within the same season
        return (a.episode ?? 0) - (b.episode ?? 0);
    });
};
