/**
 * Utility functions for handling media IDs
 */

/**
 * Checks if an ID is a valid IMDb ID (starts with 'tt')
 * @param id - The ID to check
 * @returns true if the ID is an IMDb ID
 */
export function isImdbId(id: string): boolean {
  return id.startsWith('tt');
}

/**
 * Parse a video ID in the format 'imdbId:season:episode'
 * @param videoId - The video ID to parse (e.g., 'tt0944947:1:1')
 * @returns Parsed season and episode numbers, or undefined if parsing fails
 */
export function parseVideoId(videoId: string): { season: number; episode: number } | undefined {
  const parts = videoId.split(':');
  if (parts.length < 3) return undefined;

  const season = parseInt(parts[1], 10);
  const episode = parseInt(parts[2], 10);

  if (isNaN(season) || isNaN(episode)) return undefined;
  if (season < 1 || episode < 1) return undefined;

  return { season, episode };
}
