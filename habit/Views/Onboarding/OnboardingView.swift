import SwiftUI

struct OnboardingView: View {
    @Binding var isPresented: Bool
    @State private var currentPage = 0
    
    var body: some View {
        TabView(selection: $currentPage) {
            WelcomePage(isPresented: $isPresented, currentPage: $currentPage)
                .tag(0)
            
            QuickStartPage(isPresented: $isPresented)
                .tag(1)
        }
        .tabViewStyle(.page(indexDisplayMode: .always))
        .indexViewStyle(.page(backgroundDisplayMode: .always))
        .interactiveDismissDisabled()
        .background(Color.brandBackground)
    }
}

#Preview {
    OnboardingView(isPresented: .constant(true))
}