 /*
 * Originally part of: NuvioStreaming - https://github.com/tapframe/NuvioStreaming
 * Licensed under the GPL-3.0 license.
 *
 * Modifications:
 *  - Adapted for DodoStream by Kombustor, 2026.
 */
package com.dodora.dodostream.mpv

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MpvModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Mpv")

    // View definition with all props and events
    View(ExpoMpvView::class) {
      // Events that the view can send to JavaScript
      Events(
        "onLoad",
        "onProgress", 
        "onEnd",
        "onError",
        "onBuffering",
        "onTracksChanged"
      )

      // Props
      Prop("source") { view: ExpoMpvView, source: String? ->
        source?.let { view.setDataSource(it) }
      }

      Prop("paused") { view: ExpoMpvView, paused: Boolean ->
        view.setPaused(paused)
      }

      Prop("volume") { view: ExpoMpvView, volume: Double ->
        view.setVolume(volume)
      }

      Prop("rate") { view: ExpoMpvView, rate: Double ->
        view.setSpeed(rate)
      }

      Prop("resizeMode") { view: ExpoMpvView, resizeMode: String? ->
        view.setResizeMode(resizeMode ?: "contain")
      }

      Prop("headers") { view: ExpoMpvView, headers: Map<String, String>? ->
        view.setHeaders(headers)
      }

      Prop("decoderMode") { view: ExpoMpvView, decoderMode: String? ->
        view.decoderMode = decoderMode ?: "auto"
      }

      Prop("gpuMode") { view: ExpoMpvView, gpuMode: String? ->
        view.gpuMode = gpuMode ?: "gpu"
      }

      // Subtitle styling props
      Prop("subtitleSize") { view: ExpoMpvView, size: Int ->
        view.setSubtitleSize(size)
      }

      Prop("subtitleColor") { view: ExpoMpvView, color: String? ->
        view.setSubtitleColor(color ?: "#FFFFFF")
      }

      Prop("subtitleBackgroundOpacity") { view: ExpoMpvView, opacity: Float ->
        view.setSubtitleBackgroundColor("#000000", opacity)
      }

      Prop("subtitleBorderSize") { view: ExpoMpvView, size: Int ->
        view.setSubtitleBorderSize(size)
      }

      Prop("subtitleBorderColor") { view: ExpoMpvView, color: String? ->
        view.setSubtitleBorderColor(color ?: "#000000")
      }

      Prop("subtitleShadowEnabled") { view: ExpoMpvView, enabled: Boolean ->
        view.setSubtitleShadow(enabled, if (enabled) 2 else 0)
      }

      Prop("subtitlePosition") { view: ExpoMpvView, pos: Int ->
        view.setSubtitlePosition(pos)
      }

      Prop("subtitleDelay") { view: ExpoMpvView, delay: Float ->
        view.setSubtitleDelay(delay.toDouble())
      }

      Prop("subtitleAlignment") { view: ExpoMpvView, align: String? ->
        view.setSubtitleAlignment(align ?: "center")
      }

      // Functions that can be called from JavaScript
      AsyncFunction("seek") { view: ExpoMpvView, position: Double ->
        view.seekTo(position)
      }

      AsyncFunction("setAudioTrack") { view: ExpoMpvView, trackId: Int ->
        view.setAudioTrack(trackId)
      }

      AsyncFunction("setSubtitleTrack") { view: ExpoMpvView, trackId: Int ->
        view.setSubtitleTrack(trackId)
      }
    }
  }
}
