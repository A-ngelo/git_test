import SwiftUI

struct EmptyStateView: View {
    @State private var isAnimating = false
    
    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            
            Image(systemName: "sparkles")
                .font(.system(size: 60))
                .foregroundStyle(.brandPrimary)
                .symbolEffect(.bounce, options: .repeating, value: isAnimating)
            
            VStack(spacing: 8) {
                Text("No habits yet")
                    .font(.system(.title2, design: .rounded, weight: .bold))
                    .foregroundStyle(.brandTextPrimary)
                
                Text("Tap the + button to add your first habit.\nStart small, stay consistent.")
                    .font(.body)
                    .foregroundStyle(.brandTextSecondary)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 32)
            
            Spacer()
        }
        .background(Color.brandBackground)
        .onAppear {
            isAnimating = true
        }
    }
}

#Preview {
    EmptyStateView()
}