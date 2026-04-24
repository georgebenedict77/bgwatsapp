# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-04-24
### Added
- Portfolio-grade README with problem statement, solution framing, architecture diagram, setup, and deployment instructions.
- Live demo links plus embedded media assets (screenshots + walkthrough GIF).
- CI workflow (`.github/workflows/ci.yml`) running syntax and smoke tests on every push/PR.
- Automated smoke test script for API/session/OTP mimic flow validation.
- MIT license, release notes, and product-positioning messaging.

### Changed
- `package.json` version bumped to `1.1.0`.
- NPM scripts expanded to include `check:syntax`, `check:smoke`, and `test`.

## [1.0.0] - 2026-04-22
### Added
- Initial full-stack BGWATSAPP release with OTP login, chats, groups, settings, and black/gold/red theme.
