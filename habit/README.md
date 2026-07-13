# Habit

A beautifully minimal habit tracker for iOS 17+.

**Price:** $4.99 one-time purchase | $19.99/mo bundle subscription

## Project Structure

```
Habit/
├── App/           # App entry point, content view, app delegate
├── Models/        # SwiftData models (Habit, HabitEntry, StreakInfo)
├── ViewModels/    # @Observable view models (MVVM pattern)
├── Views/         # SwiftUI views organized by screen
│   ├── Onboarding/
│   ├── Main/
│   ├── Detail/
│   ├── Stats/
│   ├── Settings/
│   └── Sheets/
├── Widgets/       # WidgetKit widgets (3 families)
├── Services/      # Business logic services
├── Extensions/    # Swift extensions
├── Preview Content/ # Sample data for SwiftUI previews
├── Resources/     # Asset catalogs
└── Configuration/ # StoreKit configuration
```

## Requirements

- iOS 17.0+
- Xcode 15.0+
- Swift 5.9+

## Architecture

- **MVVM + SwiftUI Observation** (iOS 17 `@Observable` macro)
- **SwiftData** for persistence
- **Swift Charts** for statistics
- **WidgetKit** for Home Screen widgets
- **No third-party dependencies**

## Setup

1. Open the project in Xcode 15+
2. Select your team in Signing & Capabilities
3. Build and run (⌘R)

## Widgets

- **Checklist Widget** (Medium) — Today's habits with progress
- **Streak Widget** (Small) — Top habit streaks
- **Single Habit Widget** (Small) — One habit at a glance

## Monetization

- `com.pixeltide.habit.full` — Non-consumable, $4.99
- `com.pixeltide.bundle.monthly` — Subscription, $19.99/month

## License

© 2026 Pixeltide Studio. All rights reserved.