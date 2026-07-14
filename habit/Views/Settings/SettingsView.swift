import SwiftUI

struct SettingsView: View {
    @Environment(StoreService.self) private var store
    @State private var showingResetConfirmation = false
    @State private var showingPaywall = false
    @AppStorage("hasSeenOnboarding") private var hasSeenOnboarding = true
    
    var body: some View {
        NavigationStack {
            List {
                // Purchase Status
                Section {
                    HStack {
                        Label("Habit", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.brandTextPrimary)
                        Spacer()
                        purchaseStatusBadge
                    }
                } header: {
                    Text("Status")
                }
                
                // Appearance
                Section("Appearance") {
                    NavigationLink {
                        AppearanceSettingsView()
                    } label: {
                        Label("Appearance", systemImage: "paintbrush.fill")
                            .foregroundStyle(.brandTextPrimary)
                    }
                }
                
                // Notifications
                Section("Notifications") {
                    Button {
                        requestNotificationPermission()
                    } label: {
                        Label("Reminder Settings", systemImage: "bell.fill")
                            .foregroundStyle(.brandTextPrimary)
                    }
                }
                
                // Data
                Section("Data") {
                    Button {
                        showingResetConfirmation = true
                    } label: {
                        Label("Reset All Data", systemImage: "trash.fill")
                            .foregroundStyle(.brandError)
                    }
                }
                
                // About
                Section("About") {
                    HStack {
                        Label("Version", systemImage: "info.circle.fill")
                            .foregroundStyle(.brandTextPrimary)
                        Spacer()
                        Text("1.0.0")
                            .foregroundStyle(.brandTextSecondary)
                    }
                    
                    Link(destination: URL(string: "https://pixeltide.studio")!) {
                        Label("Website", systemImage: "globe")
                            .foregroundStyle(.brandTextPrimary)
                    }
                    
                    Button {
                        shareApp()
                    } label: {
                        Label("Share Habit", systemImage: "square.and.arrow.up")
                            .foregroundStyle(.brandTextPrimary)
                    }
                }
                
                // Pixeltide Bundle
                Section("Pixeltide Studio") {
                    Button {
                        showingPaywall = true
                    } label: {
                        HStack {
                            Label("Unlock All Apps", systemImage: "crown.fill")
                                .foregroundStyle(.brandAccent)
                            Spacer()
                            Text(store.bundleProduct?.displayPrice ?? "$19.99/mo")
                                .font(.caption)
                                .foregroundStyle(.brandTextSecondary)
                        }
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.large)
            .alert("Reset All Data?", isPresented: $showingResetConfirmation) {
                Button("Cancel", role: .cancel) {}
                Button("Reset", role: .destructive) {
                    resetAllData()
                }
            } message: {
                Text("This will delete all your habits and entries. This action cannot be undone.")
            }
            .sheet(isPresented: $showingPaywall) {
                PaywallView()
            }
        }
    }
    
    private var purchaseStatusBadge: some View {
        Group {
            switch store.purchaseState {
            case .free:
                Button {
                    showingPaywall = true
                } label: {
                    Text("Free (\(store.freeHabitLimit) habits)")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.brandPrimary, in: .capsule)
                }
            case .fullApp:
                Text("Full Access")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(.brandSuccess)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.brandSuccess.opacity(0.12), in: .capsule)
            case .bundleSubscription:
                Text("Bundle")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(.brandAccent)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.brandAccent.opacity(0.12), in: .capsule)
            }
        }
    }
    
    private func requestNotificationPermission() {
        UIApplication.shared.open(URL(string: UIApplication.openSettingsURLString)!)
    }
    
    private func resetAllData() {
        // TODO: Clear all SwiftData models
        hasSeenOnboarding = false
    }
    
    private func shareApp() {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = windowScene.windows.first,
              let rootVC = window.rootViewController else { return }
        
        let activityVC = UIActivityViewController(
            activityItems: ["Check out Habit — a beautifully minimal habit tracker!"],
            applicationActivities: nil
        )
        rootVC.present(activityVC, animated: true)
    }
}

#Preview {
    SettingsView()
        .environment(StoreService.shared)
}