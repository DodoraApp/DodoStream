/**
 * Player error classification utilities.
 * Used to determine appropriate error handling and fallback behavior.
 */

export type PlayerErrorType = 'codec' | 'network' | 'source' | 'unknown';

export interface PlayerErrorClassification {
    type: PlayerErrorType;
    shouldFallback: boolean;
    userMessage: string;
}

/**
 * Classifies a player error message to determine the appropriate handling strategy.
 * 
 * Codec/Decoding errors should trigger fallback to alternate players.
 * Network errors should NOT trigger fallback (user can retry or select different stream).
 * 
 * @param errorMessage - The error message from the player (typically from composeErrorString)
 * @returns Classification containing error type, fallback recommendation, and user-friendly message
 */
export function classifyPlayerError(errorMessage: string): PlayerErrorClassification {
    const lowerMessage = errorMessage.toLowerCase();

    // Codec/Decoding errors - SHOULD fallback
    // These indicate the player cannot decode the video format
    const codecIndicators = [
        'error_code_decoding_failed',
        'mediacodecvideorenderer error',
        'decoder failed',
        'codec exception',
        'format_supported=no',
        'no_exceeds_capabilities',
        'mediacodecvideodecoderexception',
        'error 0xe', // Android MediaCodec error code for codec failure
        'video/dolby-vision', // Dolby Vision not supported
        'hevc', // HEVC/H.265 codec issues
        'av1', // AV1 codec issues
    ];

    if (codecIndicators.some((indicator) => lowerMessage.includes(indicator))) {
        return {
            type: 'codec',
            shouldFallback: true,
            userMessage: 'Video format not supported by this player',
        };
    }

    // Network errors - should NOT fallback
    // These indicate connectivity issues that won't be resolved by changing players
    const networkIndicators = [
        'error_code_io',
        'error_code_timeout',
        'error_code_connection',
        'network',
        'timeout',
        'connection refused',
        'connection failed',
        'unable to connect',
        'no internet',
        'http error',
        'failed to fetch',
        'unreachable',
    ];

    if (networkIndicators.some((indicator) => lowerMessage.includes(indicator))) {
        return {
            type: 'network',
            shouldFallback: false,
            userMessage: 'Network error - check your connection',
        };
    }

    // Source errors - should NOT fallback
    // These indicate the stream itself is broken/unavailable
    const sourceIndicators = [
        'bad_http_status',
        'error_code_behind_live_window',
        'error_code_content_not_found',
        '404',
        '403',
        '500',
        'not found',
        'forbidden',
        'unauthorized',
    ];

    if (sourceIndicators.some((indicator) => lowerMessage.includes(indicator))) {
        return {
            type: 'source',
            shouldFallback: false,
            userMessage: 'Stream unavailable or expired',
        };
    }

    // Unknown errors - cautiously allow fallback
    // If we can't classify the error, it's safer to try fallback
    return {
        type: 'unknown',
        shouldFallback: true,
        userMessage: 'Playback error occurred',
    };
}
