# Enhanced Fork — Changelog

Enhancements on top of [nofx](https://github.com/NoFxAiOS/nofx) (AGPL-3.0).

## [Unreleased]

### Added
- Pre-trade risk validation (margin check, min order size, leverage constraints)
- ATR-adaptive take profit thresholds
- Per-side cooldown and minimum hold enforcement
- Per-strategy AI call budget and token limits
- Event-driven signal filtering
- Multi-AI arena mode with consensus voting
- Feature flag framework for gradual rollout
- Structured audit logging

### Fixed
- Entry time persistence across restarts
- Minimum hold gate enforcement edge cases
- Multiple execution stability fixes
