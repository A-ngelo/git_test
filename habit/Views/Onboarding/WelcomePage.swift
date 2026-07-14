import SwiftUI

struct WelcomePage: View {
    @Binding var isPresented: Bool
    @Binding var currentPage: Int
    
    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 80))
                .foregroundStyle(.brandPrimary)
                .symbolEffect(.bounce, options: .repeating)
            
            Text("Habit")
                .font(.system(.largeTitle, design: .rounded, weight: .bold))
                .foregroundStyle(.brandTextPrimary)
            
            Text("Build better habits,\none day at a time.")
                .font(.system(.title3, design: .rounded, weight: .regular))
                .foregroundStyle(.brandTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            
            Spacer()
            
            Button {
                withAnimation(.spring) {
                    currentPage = 1
                }
            } label: {
                Text("Get Started")
                    .font(.headline)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Color.brandPrimary, in: .capsule)
            }
            .padding(.horizontal, 32)
            .padding(.bottom, 48)
        }
        .background(Color.brandBackground)
    }
}

#Preview {
    WelcomePage(isPresented: .constant(true), currentPage: .constant(0))
}