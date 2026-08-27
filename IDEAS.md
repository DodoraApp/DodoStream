# Ideas

These are general ideas for DodoStream that are undescribed and unplanned.

## Features

- [ ] Android TV Home Screen catalogs
- [ ] Offline Viewing / Downloads (Mobile)
- [ ] Picture-in-Picture (PiP) Support
- [ ] Chromecast / AirPlay Casting
- [ ] Parental Controls for profiles
- [ ] Deep Linking support
- [ ] "Random" / Shuffle Play
- [ ] TMDB Metadata enrichment
- [ ] Incognito playback mode (no watch history) — session-only flag one item below the round profile button; playback writes neither watch history nor Continue Watching
- [ ] On-device insights — watch stats, top genres, and streaks computed from the local history database; cloud-style analytics shown only to the user
- [ ] Stream health check with broken-stream memory and auto-fallback — probe stream URLs before or after playback failure, remember failures locally, then try the next stream; extend player fallback without community reporting
- [ ] Episode calendar and local new-episode notifications for followed series — derive upcoming episodes from `releaseInfo`/status metadata and schedule Android notifications locally; extend `useWhatsNew`

## More Settings / Customization

- [ ] Poster Size
- [ ] Skip Duration
- [ ] Disable Animations
- [ ] Playback Speed Control (0.5x - 2.0x)
- [ ] Sleep Timer
- [ ] Advanced engine settings (audio passthrough, buffer, A/V sync) — expose VLC/ExoPlayer knobs

## UI / UX Improvements

- [ ] "Starts in..." countdown on Up Next Popup
- [ ] On-device recommendation rails ("Because you watched…") — genre affinity computed from local history for Home, plus similar titles on the current item's details page
- [ ] Recently added / Trending / Random rails on home
- [ ] Badge chips for quality (4K, HDR, Dolby Atmos)
- [ ] Accessibility
- [ ] TV screensaver with My List posters
- [ ] Voice search via Android TV system speech input — use the system speech recognizer intent in search; no third-party ASR

## Full Stremio Addon SDK Support

> Note: Torrenting-related features are out of scope.

- [ ] Behaviour hints: headers
- [ ] Auto-updating addons with changelog diff (per-addon opt-in) — re-fetch manifests on start and surface version/resource changes before applying; users see what changed

## Technical

- [ ] Auto-updater for Android APKs