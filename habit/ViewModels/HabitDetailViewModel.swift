import Foundation
import SwiftUI
import SwiftData

@Observable
final class HabitDetailViewModel {
    var habit: Habit
    var streakInfo: StreakInfo
    var selectedMonth: Date
    var monthEntries: [Date: Bool] = [:]
    
    private let modelContext: ModelContext
    
    init(habit: Habit, modelContext: ModelContext) {
        self.habit = habit
        self.streakInfo = StreakInfo.compute(for: habit)
        self.selectedMonth = Date()
        self.modelContext = modelContext
        loadMonthData()
    }
    
    func loadMonthData() {
        streakInfo = StreakInfo.compute(for: habit)
        computeMonthEntries()
    }
    
    func toggleCheckIn(for date: Date) {
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)
        
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
        loadMonthData()
    }
    
    func previousMonth() {
        selectedMonth = Calendar.current.date(byAdding: .month, value: -1, to: selectedMonth) ?? selectedMonth
        computeMonthEntries()
    }
    
    func nextMonth() {
        selectedMonth = Calendar.current.date(byAdding: .month, value: 1, to: selectedMonth) ?? selectedMonth
        computeMonthEntries()
    }
    
    var isCurrentMonth: Bool {
        Calendar.current.isDate(selectedMonth, equalTo: Date(), toGranularity: .month)
    }
    
    private func computeMonthEntries() {
        let calendar = Calendar.current
        let entries = habit.entries ?? []
        monthEntries = [:]
        
        // Get the range of days in the selected month
        guard let range = calendar.range(of: .day, in: .month, for: selectedMonth) else { return }
        guard let monthStart = calendar.date(from: calendar.dateComponents([.year, .month], from: selectedMonth)) else { return }
        
        for day in range {
            if let date = calendar.date(byAdding: .day, value: day - 1, to: monthStart) {
                let isCompleted = entries.contains { entry in
                    entry.completed && calendar.isDate(entry.date, inSameDayAs: date)
                }
                // Only show dates up to today
                if date <= Date() {
                    monthEntries[date] = isCompleted
                }
            }
        }
    }
    
    var sortedEntries: [HabitEntry] {
        (habit.entries ?? []).sorted { $0.date > $1.date }
    }
}