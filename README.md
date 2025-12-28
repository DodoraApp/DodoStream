[![Discord][discord-shield]][discord-url]
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![License][license-shield]][license-url]

[discord-shield]: https://img.shields.io/discord/1454918816596496496?style=for-the-badge
[discord-url]: https://discord.gg/fMSNVmxKfN
[contributors-shield]: https://img.shields.io/github/contributors/DodoraApp/DodoStream.svg?style=for-the-badge
[contributors-url]: https://github.com/DodoraApp/DodoStream/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/DodoraApp/DodoStream.svg?style=for-the-badge
[forks-url]: https://github.com/DodoraApp/DodoStream/network/members
[stars-shield]: https://img.shields.io/github/stars/DodoraApp/DodoStream.svg?style=for-the-badge
[stars-url]: https://github.com/DodoraApp/DodoStream/stargazers
[issues-shield]: https://img.shields.io/github/issues/DodoraApp/DodoStream.svg?style=for-the-badge
[issues-url]: https://github.com/DodoraApp/DodoStream/issues
[license-shield]: https://img.shields.io/github/license/DodoraApp/DodoStream.svg?style=for-the-badge
[license-url]: http://www.gnu.org/licenses/gpl-3.0.en.html

<p align="center">
  <img src="assets/logo.svg" width="300" alt="DodoStream" />
</p>

# 📺 DodoStream Media Hub

> Streaming evolved.

An open-source, privacy-focused media hub built with Expo + React Native, currently optimized for Android TV & Android.

[Report a Bug](https://github.com/DodoraApp/DodoStream/issues/new?labels=bug&template=bug_report.md)

[Request a Feature](https://github.com/DodoraApp/DodoStream/issues/new?labels=enhancement&template=feature_request.md)

[Join the Discord Server (for general ideas, suggestions, decisions)][discord-url]

Supports **Stremio Addons** (see details below).

**Vision**

- Bring a modern, fast, customizable media hub experience to TV & mobile devices.
- Stay privacy-first: no accounts, no tracking, no ads.
- Keep the core portable: one codebase for TV + mobile.
- Full user profile support.

**This project is under heavy development and not stable to use.**

## Screenshots

![](docs/screenshots/tv/home-continue-watching.png)
![](docs/screenshots/tv/details.png)
![](docs/screenshots/tv/playback-tv.png)
![](docs/screenshots/tv/profile-selector.png)

See more screenshots in the [docs/screenshots](docs/screenshots) folder.

## Roadmap

This project is under active development. Expect occasional breaking changes, unfinished features, and rough edges.

**There is no public release yet, star & activate notifications to be notified.**

### Implemented

- [x] Almost full Stremio Addon support
- [x] Addon manager (install via manifest URL, remove addons)
- [x] Per-addon catalog toggles (use catalogs on Home / in Search)
- [x] Home screen
- [x] Media details page
- [x] Settings page
- [x] User Profiles (create/edit/delete/switch)
  - [x] Optional profile PIN protection
  - [x] Per-profile playback settings
- [x] Watch history + resume playback
- [x] Stream selection
- [x] Playback with 2 different players (ExoPlayer + VLC)
- [x] Automatic player fallback (when enabled)
- [x] Preferred audio/subtitle languages
- [x] Subtitle & audio track selection
- [x] Auto-play next episode
- [x] Search across enabled addon catalogs
- [x] My List (local, per-profile)
- [x] New release checking

## Features

- [ ] YouTube Player Support (for Streams & Trailers)
- [ ] Library (old "My List") Page with watched/finished media/lists from providers
- [ ] Settings Sync/Export/Import
- [ ] Discover Page with filters & sorting
- [ ] Search History
- [ ] Themes
- [ ] External Player
- [ ] Android TV Home Screen catalogs
- [ ] Skip Intro functionality using IntroDB
- [ ] Offline Viewing / Downloads (Mobile)
- [ ] Picture-in-Picture (PiP) Support
- [ ] Chromecast / AirPlay Casting
- [ ] Parental Controls for profiles
- [ ] Deep Linking support
- [ ] "Random" / Shuffle Play
- [ ] Onboarding wizard
- [ ] MPV Player Support
- [ ] TMDB Metadata enrichment

### More Settings / Customization

- [ ] Addons enabled per-profile
- [ ] Auto Select First Stream (skip stream selection screen)
- [ ] Subtitles Style/Size etc.
- [ ] Audio/Subtitle Delay adjustment
- [ ] Aspect Ratio controls (Zoom, Fit, Stretch)
- [ ] Reorder Addons
- [ ] Disable & Reorder individual Catalogs on Home & Search
- [ ] Poster Size
- [ ] Skip Duration
- [ ] Disable Animations
- [ ] Playback Speed Control (0.5x - 2.0x)
- [ ] Sleep Timer
- [ ] UI Localization (i18n)

### UI / UX Improvements

- [ ] Customizable Hero section on home screen
- [ ] More Animations
- [ ] "Starts in..." countdown on Up Next Popup
- [ ] "Stats for Nerds" overlay (Bitrate, Codec, Dropped frames)
- [ ] Cast & Crew clickable links (search by actor/director)
- [ ] "Similar" / "Recommended" section on details page
- [ ] Recently added / Trending / Random rails on home
- [ ] Badge chips for quality (4K, HDR, Dolby Atmos)
- [ ] Show "Ends at" time when playing & current system time
- [ ] Adaptive Frame Rate Support
- [ ] Button that links to addon configuration page if addon is configurable

### Full Stremio Addon SDK Support

> Note: Torrenting-related features are currently out of scope.

- [ ] Subtitles from Addons
- [ ] Trailers
- [ ] Behaviour hints: headers
- [ ] Addon Catalogs

### Integrations

- [ ] Simkl Integration for Watch History, Scrobbling & Playlists
- [ ] Trakt Integration for Watch History, Scrobbling & Playlists

### Technical

- [ ] Replace Burnt with custom Toasts or another library
- [ ] Auto-updater for Android APKs
- [ ] Crash Reporting
- [ ] Performance Profiling

## Supported Platforms

- Android TV (primary target)
- Android (mobile/tablet)
- tvOS / Apple TV (currently **untested**)

## Tech Stack

- Expo SDK + `expo-router` (file-based routing)
- TypeScript (strict)
- Zustand (state)
- React Query (data fetching)
- `@shopify/restyle` (theme + styling)
- Moti/Reanimated (animations)

## Contributing

PRs and issues are welcome.

- Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, coding style, and how to submit changes.
- Please follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- Found a security issue? See [SECURITY.md](SECURITY.md).
- Need help or have a question? See [SUPPORT.md](SUPPORT.md).

## Thanks

This project is inspired by other community streaming clients and media projects, including:

- [Stremio](https://www.stremio.com/)
- [NuvioStreaming](https://github.com/tapframe/NuvioStreaming)
- [Cinephage](https://github.com/MoldyTaint/Cinephage)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=DodoraApp/DodoStream&type=date&legend=top-left)](https://www.star-history.com/#DodoraApp/DodoStream&type=date&legend=top-left)

## Legal / Disclaimer

DodoStream is an independent, community-driven project and is **not affiliated with Stremio**.

DodoStream does **not** host, provide, sell, or distribute any media content. It is an application that can interact with third-party addons/services configured by the user.

You are responsible for complying with the laws in your jurisdiction and for only accessing content you have the rights to access.

## License

See `LICENSE` for a copy of the GPL-3.0 license.

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
