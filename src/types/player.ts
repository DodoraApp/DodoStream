export type PlayerType = 'vlc' | 'exoplayer';

export type TextTrackSource = 'video' | 'addon';

export interface PlayerRef {
    seekTo: (time: number, duration: number) => void;
}

export interface AudioTrack {
    index: number;
    title?: string;
    language?: string;
    type?: string;
}

/**
 * Parsed subtitle cue from SRT/VTT files.
 */
export interface SubtitleCue {
    /** Cue index in the subtitle file */
    index: number;
    /** Start time in seconds */
    startTime: number;
    /** End time in seconds */
    endTime: number;
    /** Plain text content (HTML tags stripped) */
    text: string;
}

export interface TextTrack {
    source: TextTrackSource;
    /**
     * Combined list index (unique sequential index assigned by the combiner)
     */
    index: number;
    title?: string;
    language?: string;
    /**
     * External subtitle URL (for addon-provided subtitles)
     */
    uri?: string;
    /**
     * Optional addon metadata to help matching and display
     */
    addonId?: string;
    addonName?: string;
    /**
     * Player-specific index/id (e.g. in-stream index or VLC track id).
     * Populated when reported by the underlying player.
     */
    playerIndex?: number;
}

export interface PlayerProps {
    source: string;
    paused: boolean;
    onProgress?: (data: { currentTime: number; duration?: number }) => void;
    onLoad?: (data: { duration: number }) => void;
    onBuffer?: (buffering: boolean) => void;
    onEnd?: () => void;
    onError?: (message: string) => void;
    onAudioTracks?: (tracks: AudioTrack[]) => void;
    onTextTracks?: (tracks: TextTrack[]) => void;
    selectedAudioTrack?: AudioTrack;
    selectedTextTrack?: TextTrack;
}
