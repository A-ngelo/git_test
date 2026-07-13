import SwiftUI

@main
struct HabitApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @State private var modelContainer: ModelContainer
    @State private var store = StoreService.shared
    
    init() {
        do {
            modelContainer = try ModelContainer(for: Habit.self, HabitEntry.self)
        } catch {
            fatalError("Failed to create ModelContainer: \(error)")
        }
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .modelContainer(modelContainer)
                .environment(store)
        }
    }
}