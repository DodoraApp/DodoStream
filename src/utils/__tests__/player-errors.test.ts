import { classifyPlayerError } from '../player-errors';

describe('classifyPlayerError', () => {
    describe('codec errors', () => {
        it('should identify ExoPlayer decoding errors', () => {
            const error =
                'ERROR_CODE_DECODING_FAILED ExoPlaybackException: MediaCodecVideoRenderer error';
            const result = classifyPlayerError(error);

            expect(result.type).toBe('codec');
            expect(result.shouldFallback).toBe(true);
            expect(result.userMessage).toBe('Video format not supported by this player');
        });

        it('should identify Dolby Vision codec issues', () => {
            const error =
                '24003 ExoPlaybackException: MediaCodecVideoRenderer error, index=0, format=Format(1, null, null, video/dolby-vision, hev1.08.06, -1, und, [3840, 1606, -1.0, null], [-1, -1]), format_supported=NO_EXCEEDS_CAPABILITIES';
            const result = classifyPlayerError(error);

            expect(result.type).toBe('codec');
            expect(result.shouldFallback).toBe(true);
        });

        it('should identify MediaCodec decoder failures', () => {
            const error = 'MediaCodecVideoDecoderException: Decoder failed: c2.android.hevc.decoder';
            const result = classifyPlayerError(error);

            expect(result.type).toBe('codec');
            expect(result.shouldFallback).toBe(true);
        });

        it('should identify codec exception errors', () => {
            const error = 'android.media.MediaCodec$CodecException: Error 0xe';
            const result = classifyPlayerError(error);

            expect(result.type).toBe('codec');
            expect(result.shouldFallback).toBe(true);
        });
    });

    describe('network errors', () => {
        it('should identify network timeout errors', () => {
            const error = 'ERROR_CODE_TIMEOUT Connection timeout';
            const result = classifyPlayerError(error);

            expect(result.type).toBe('network');
            expect(result.shouldFallback).toBe(false);
            expect(result.userMessage).toBe('Network error - check your connection');
        });

        it('should identify connection failed errors', () => {
            const error = 'ERROR_CODE_IO Connection failed';
            const result = classifyPlayerError(error);

            expect(result.type).toBe('network');
            expect(result.shouldFallback).toBe(false);
        });

        it('should identify HTTP errors as network errors', () => {
            const error = 'HTTP Error: Unable to connect';
            const result = classifyPlayerError(error);

            expect(result.type).toBe('network');
            expect(result.shouldFallback).toBe(false);
        });
    });

    describe('source errors', () => {
        it('should identify 404 errors', () => {
            const error = 'ERROR_CODE_CONTENT_NOT_FOUND 404 Not Found';
            const result = classifyPlayerError(error);

            expect(result.type).toBe('source');
            expect(result.shouldFallback).toBe(false);
            expect(result.userMessage).toBe('Stream unavailable or expired');
        });

        it('should identify forbidden errors', () => {
            const error = '403 Forbidden';
            const result = classifyPlayerError(error);

            expect(result.type).toBe('source');
            expect(result.shouldFallback).toBe(false);
        });
    });

    describe('unknown errors', () => {
        it('should default to unknown with fallback enabled', () => {
            const error = 'Something weird happened';
            const result = classifyPlayerError(error);

            expect(result.type).toBe('unknown');
            expect(result.shouldFallback).toBe(true);
            expect(result.userMessage).toBe('Playback error occurred');
        });
    });
});
