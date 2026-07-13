import SwiftUI

// MARK: - Design System Colors

extension Color {
    /// Initialize from hex string (e.g. "#FF6B5B")
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        
        let a, r, g, b: UInt64
        switch hex.count {
        case 6:
            (a, r, g, b) = (255, (int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = ((int >> 24) & 0xFF, (int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
    
    var toHex: String {
        let uiColor = UIColor(self)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        uiColor.getRed(&r, green: &g, blue: &b, alpha: &a)
        return String(format: "#%02X%02X%02X", Int(r * 255), Int(g * 255), Int(b * 255))
    }
}

// MARK: - Brand Colors

extension Color {
    /// #FF6B5B — Primary brand color (coral)
    static let brandPrimary = Color(hex: "#FF6B5B")
    /// #4ECDC4 — Secondary brand color (teal)
    static let brandSecondary = Color(hex: "#4ECDC4")
    /// #FFD93D — Accent color (warm gold) for streaks/achievements
    static let brandAccent = Color(hex: "#FFD93D")
}

// MARK: - Background & Surface

extension Color {
    /// Main background (#FFFFFF light / #000000 dark)
    static let brandBackground = Color("Background", bundle: nil)
    /// Card/surface background (#F7F7F9 light / #1C1C1E dark)
    static let brandSurface = Color("Surface", bundle: nil)
    /// Separator lines (#E5E5EA light / #38383A dark)
    static let brandSeparator = Color("Separator", bundle: nil)
}

// MARK: - Text Colors

extension Color {
    /// Primary text (#1C1C1E light / #FFFFFF dark)
    static let brandTextPrimary = Color("TextPrimary", bundle: nil)
    /// Secondary text (#8E8E93)
    static let brandTextSecondary = Color("TextSecondary", bundle: nil)
}

// MARK: - Status Colors

extension Color {
    /// Success green (#34C759 light / #30D158 dark)
    static let brandSuccess = Color("Success", bundle: nil)
    /// Error red (#FF3B30 light / #FF453A dark)
    static let brandError = Color("Error", bundle: nil)
}

// MARK: - Habit Color Swatches (12 colors for the picker)

extension Color {
    static let habitSwatches: [(name: String, hex: String, color: Color)] = [
        ("Coral", "#FF6B5B", Color(hex: "#FF6B5B")),
        ("Teal", "#4ECDC4", Color(hex: "#4ECDC4")),
        ("Gold", "#FFD93D", Color(hex: "#FFD93D")),
        ("Mint", "#00C781", Color(hex: "#00C781")),
        ("Lavender", "#AF8ED9", Color(hex: "#AF8ED9")),
        ("Sky Blue", "#5AC8FA", Color(hex: "#5AC8FA")),
        ("Rose", "#FF6482", Color(hex: "#FF6482")),
        ("Sage", "#8CD4A3", Color(hex: "#8CD4A3")),
        ("Peach", "#FFB07C", Color(hex: "#FFB07C")),
        ("Indigo", "#5856D6", Color(hex: "#5856D6")),
        ("Slate", "#6D7A8A", Color(hex: "#6D7A8A")),
        ("Cherry", "#FF375F", Color(hex: "#FF375F"))
    ]
    
    /// Default habit color hexes for the picker
    static let habitColorHexes: [String] = habitSwatches.map(\.hex)
    
    /// Default habit colors for the picker
    static let habitColors: [Color] = habitSwatches.map(\.color)
}