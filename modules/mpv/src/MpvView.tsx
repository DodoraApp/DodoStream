import { requireNativeView } from 'expo';
import * as React from 'react';

import { MpvViewProps, MpvViewRef } from './Mpv.types';

const NativeView: React.ComponentType<MpvViewProps & { ref: any }> = requireNativeView('Mpv');
export default React.forwardRef<MpvViewRef, MpvViewProps>((props, ref) => {
  const nativeRef = React.useRef<any>(null);

  React.useImperativeHandle(ref, () => ({
    seek: async (position: number) => {
      if (nativeRef.current) {
        // Expo modules expose functions directly on the native ref
        return nativeRef.current.seek?.(position);
      }
    },
    setAudioTrack: async (trackId: number) => {
      if (nativeRef.current) {
        return nativeRef.current.setAudioTrack?.(trackId);
      }
    },
    setSubtitleTrack: async (trackId: number) => {
      if (nativeRef.current) {
        return nativeRef.current.setSubtitleTrack?.(trackId);
      }
    },
  }));

  if (!NativeView) {
    return null;
  }

  return <NativeView ref={nativeRef} {...props} />;
});
