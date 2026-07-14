import SwiftUI
import SwiftData

struct ContentView: View {
    @State private var selectedTab: Tab = .main
    @State private var showingOnboarding = false
    @State private var showingPaywall = false
    @Environment(StoreService.self) private var store
    
    enum Tab: String, CaseIterable {
        case main = "checkmark.circle"
        case stats = "chart.bar.fill"
        case settings = "gearshape.fill"
        
        var label: String {
            switch self {
            case .main: return "Today"
            case .stats: return "Stats"
            case .settings: return "Settings"
            }
        }
    }
    
    var body: some View {
        TabView(selection: $selectedTab) {
            HabitListView(showPaywall: $showingPaywall)
                .tabItem {
                    Label(Tab.main.label, systemImage: Tab.main.rawValue)
                }
                .tag(Tab.main)
            
            StatsView()
                .tabItem {
                    Label(Tab.stats.label, systemImage: Tab.stats.rawValue)
                }
                .tag(Tab.stats)
            
            SettingsView()
                .tabItem {
                    Label(Tab.settings.label, systemImage: Tab.settings.rawValue)
                }
                .tag(Tab.settings)
        }
        .tint(.brandPrimary)
        .sheet(isPresented: $showingOnboarding) {
            OnboardingView(isPresented: $showingOnboarding)
        }
        .sheet(isPresented: $showingPaywall) {
            PaywallView()
        }
        .onAppear {
            checkOnboardingStatus()
        }
    }
    
    private func checkOnboardingStatus() {
        let hasSeenOnboarding = UserDefaults.standard.bool(forKey: "hasSeenOnboarding")
        if !hasSeenOnboarding {
            showingOnboarding = true
        }
    }
}

#Preview {
    ContentView()
        .modelContainer(PreviewData.shared.container)
        .environment(StoreService.shared)
}