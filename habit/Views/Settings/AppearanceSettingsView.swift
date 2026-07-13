import SwiftUI

struct AppearanceSettingsView: View {
    @State private var selectedAppearance: AppearanceMode = .system
    
    enum AppearanceMode: String, CaseIterable {
        case system = "System"
        case light = "Light"
        case dark = "Dark"
    }
    
    var body: some View {
        List {
            Section("Theme") {
                ForEach(AppearanceMode.allCases, id: \.self) { mode in
                    Button {
                        selectedAppearance = mode
                    } label: {
                        HStack {
                            Text(mode.rawValue)
                                .foregroundStyle(.brandTextPrimary)
                            Spacer()
                            if selectedAppearance == mode {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(.brandPrimary)
                            }
                        }
                    }
                }
            }
            
            Section {
                HStack {
                    Image(systemName: "textformat.size")
                        .foregroundStyle(.brandTextSecondary)
                    Text("Dynamic Type")
                        .foregroundStyle(.brandTextPrimary)
                    Spacer()
                    Text("System")
                        .foregroundStyle(.brandTextSecondary)
                }
            } footer: {
                Text("Habit respects your system font size settings. Change it in Settings > Display & Brightness > Text Size.")
                    .foregroundStyle(.brandTextSecondary)
            }
        }
        .navigationTitle("Appearance")
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    NavigationStack {
        AppearanceSettingsView()
    }
}