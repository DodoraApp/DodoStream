export interface ResetProgressToStartParams {
    metaId: string;
    videoId: string | undefined;
    durationSeconds: number | undefined;
    updateProgress: (
        metaId: string,
        videoId: string | undefined,
        progressSeconds: number,
        durationSeconds: number
    ) => void;
}

/**
 * Reset watch history progress to the beginning.
 * Does nothing if duration is unknown.
 */
export const resetProgressToStart = ({
    metaId,
    videoId,
    durationSeconds,
    updateProgress,
}: ResetProgressToStartParams) => {
    if (!durationSeconds || durationSeconds <= 0) return;
    updateProgress(metaId, videoId, 0, durationSeconds);
};
