import Foundation
import SwiftUI
import SwiftData

@Observable
final class StatsViewModel {
    var habits: [Habit] = []
    var overallStreakInfo: StreakInfo?
    var bestHabit: (habit: Habit, streak: StreakInfo)?
    var weeklyData: [(date: Date, count: Int)] = []
    
    private let modelContext: ModelContext
    
    init(modelContext: ModelContext) {
        self.modelContext = modelContext
        loadStats()
    }
    
    func loadStats() {
        let descriptor = FetchDescriptor<Habit>(
            predicate: #Predicate { $0.archivedAt == nil },
            sortBy: [SortDescriptor(\.createdAt)]
        )
        
        do {
            habits = try modelContext.fetch(descriptor)
            computeStats()
        } catch {
            print("Failed to load stats: \(error)")
        }
    }
    
    var totalCheckIns: Int {
        habits.reduce(0) { sum, habit in
            sum + (habit.entries?.filter { $0.completed }.count ?? 0)
        }
    }
    
    var totalHabits: Int {
        habits.count
    }
    
    var overallCompletionRate: Double {
        let totalEntries = habits.reduce(0) { $0 + ($1.entries?.count ?? 0) }
        let completedEntries = habits.reduce(0) { $0 + ($1.entries?.filter { $0.completed }.count ?? 0) }
        return totalEntries > 0 ? Double(completedEntries) / Double(totalEntries) : 0
    }
    
    var bestStreak: Int {
        habits.compactMap { StreakInfo.compute(for: $0).longestStreak }.max() ?? 0
    }
    
    var currentStreakSum: Int {
        habits.reduce(0) { $0 + StreakInfo.compute(for: $1).currentStreak }
    }
    
    private func computeStats() {
        // Find best habit by longest streak
        var best: (habit: Habit, streak: StreakInfo)?
        for habit in habits {
            let info = StreakInfo.compute(for: habit)
            if best == nil || info.longestStreak > best!.streak.longestStreak {
                best = (habit, info)
            }
        }
        bestHabit = best
        
        // Compute weekly data
        computeWeeklyData()
    }
    
    private func computeWeeklyData() {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        weeklyData = []
        
        for dayOffset in (0..<7).reversed() {
            guard let date = calendar.date(byAdding: .day, value: -dayOffset, to: today) else { continue }
            let count = habits.reduce(0) { sum, habit in
                let entries = habit.entries ?? []
                let completed = entries.contains { entry in
                    entry.completed && calendar.isDate(entry.date, inSameDayAs: date)
                }
                return sum + (completed ? 1 : 0)
            }
            weeklyData.append((date: date, count: count))
        }
    }
}