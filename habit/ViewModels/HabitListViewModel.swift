import Foundation
import SwiftUI
import SwiftData

@Observable
final class HabitListViewModel {
    var habits: [Habit] = []
    var todayEntries: [Habit: HabitEntry] = [:]
    var searchText = ""
    var showingAddSheet = false
    var showingLimitAlert = false
    
    private let modelContext: ModelContext
    
    init(modelContext: ModelContext) {
        self.modelContext = modelContext
        loadHabits()
    }
    
    func loadHabits() {
        let descriptor = FetchDescriptor<Habit>(
            predicate: #Predicate { $0.archivedAt == nil },
            sortBy: [SortDescriptor(\.sortOrder), SortDescriptor(\.createdAt)]
        )
        
        do {
            habits = try modelContext.fetch(descriptor)
            computeTodayEntries()
        } catch {
            print("Failed to load habits: \(error)")
        }
    }
    
    func addHabit(name: String, emoji: String, colorHex: String, frequency: Frequency,
                  dailyGoal: String?, reminderTime: Date?, notes: String?) {
        let habit = Habit(
            name: name,
            emoji: emoji,
            colorHex: colorHex,
            frequency: frequency,
            dailyGoal: dailyGoal,
            reminderTime: reminderTime,
            notes: notes,
            sortOrder: habits.count
        )
        modelContext.insert(habit)
        try? modelContext.save()
        loadHabits()
    }
    
    func deleteHabit(_ habit: Habit) {
        modelContext.delete(habit)
        try? modelContext.save()
        loadHabits()
    }
    
    func archiveHabit(_ habit: Habit) {
        habit.archivedAt = Date()
        try? modelContext.save()
        loadHabits()
    }
    
    func toggleCheckIn(for habit: Habit, on date: Date = Date()) {
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)
        
        // Check if there's already an entry for today
        let entries = habit.entries ?? []
        if let existingEntry = entries.first(where: {
            calendar.isDate($0.date, inSameDayAs: startOfDay)
        }) {
            existingEntry.completed.toggle()
        } else {
            let entry = HabitEntry(habit: habit, date: startOfDay, completed: true)
            modelContext.insert(entry)
        }
        
        try? modelContext.save()
        computeTodayEntries()
    }
    
    func toggleCheckInForToday(for habit: Habit) {
        toggleCheckIn(for: habit, on: Date())
    }
    
    var filteredHabits: [Habit] {
        if searchText.isEmpty {
            return habits
        }
        return habits.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }
    
    var todayProgress: (completed: Int, total: Int) {
        let completed = todayEntries.values.filter { $0.completed }.count
        return (completed, habits.count)
    }
    
    var todayCompletionPercentage: Double {
        habits.isEmpty ? 0 : Double(todayProgress.completed) / Double(habits.count)
    }
    
    var hasUncheckedHabits: Bool {
        todayEntries.values.contains { !$0.completed }
    }
    
    var completedTodayCount: Int {
        todayProgress.completed
    }
    
    var totalHabitsCount: Int {
        habits.count
    }
    
    // MARK: - Private
    
    private func computeTodayEntries() {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        todayEntries = [:]
        
        for habit in habits {
            let entries = habit.entries ?? []
            if let todayEntry = entries.first(where: {
                calendar.isDate($0.date, inSameDayAs: today)
            }) {
                todayEntries[habit] = todayEntry
            } else {
                // Create a transient entry (not saved yet)
                let entry = HabitEntry(habit: habit, date: today, completed: false)
                todayEntries[habit] = entry
            }
        }
    }
}