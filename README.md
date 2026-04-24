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
 ---
 
📋 If you have 5 minutes of time and want to help us shape the future development please fill out the [DodoStream User Survey](https://forms.gle/8errZef3y24t9rgd6)

---

Supports **Stremio Addons** (see details below).

**Vision**

- Bring a modern, fast, customizable media hub experience to TV & mobile devices.
- Stay privacy-first: no accounts, no tracking, no ads.
- Keep the core portable: one codebase for TV + mobile.
- Full user profile support.

**This project is under heavy development and not stable to use.**

## Screenshots

These *are* outdated but kept for an initial impression.

![](docs/screenshots/tv/home-continue-watching.png)
![](docs/screenshots/tv/details.png)
![](docs/screenshots/tv/playback-tv.png)
![](docs/screenshots/tv/profile-selector.png)

See more screenshots in the [docs/screenshots](docs/screenshots) folder.

## Features

This project is under active development. Expect occasional breaking changes, unfinished features, and rough edges.

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

This list will not be updated anymore, see [closed feature tickets](https://github.com/DodoraApp/DodoStream/issues?q=is%3Aissue%20state%3Aclosed%20type%3AFeature) for up-to-date information.

## Roadmap

See [Feature issues](https://github.com/DodoraApp/DodoStream/issues?q=is%3Aissue%20type%3AFeature) for described features & [Milestones](https://github.com/DodoraApp/DodoStream/milestones) for planned features.

See [IDEAS.md](IDEAS.md) for currently unplanned feature ideas.

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

PRs and issues are welcome. See [good first issues](https://github.com/DodoraApp/DodoStream/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22good%20first%20issue%22) for a starting point.

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
