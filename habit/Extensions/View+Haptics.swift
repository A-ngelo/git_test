import SwiftUI

extension View {
    func hapticOnTap(style: UIImpactFeedbackGenerator.FeedbackStyle = .light) -> some View {
        self.modifier(HapticModifier(style: style))
    }
}

struct HapticModifier: ViewModifier {
    let style: UIImpactFeedbackGenerator.FeedbackStyle
    
    func body(content: Content) -> some View {
        content.simultaneousGesture(
            TapGesture().onEnded { _ in
                let generator = UIImpactFeedbackGenerator(style: style)
                generator.impactOccurred()
            }
        )
    }
}

// MARK: - Convenience Haptic Functions

enum HapticFeedback {
    static func success() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
    
    static func warning() {
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
    }
    
    static func error() {
        UINotificationFeedbackGenerator().notificationOccurred(.error)
    }
    
    static func selection() {
        UISelectionFeedbackGenerator().selectionChanged()
    }
    
    static func impact(style: UIImpactFeedbackGenerator.FeedbackStyle = .medium) {
        UIImpactFeedbackGenerator(style: style).impactOccurred()
    }
    
    static func light() {
        impact(style: .light)
    }
    
    static func soft() {
        impact(style: .soft)
    }
    
    static func rigid() {
        impact(style: .rigid)
    }
}