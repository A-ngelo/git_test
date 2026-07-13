import Foundation
import SwiftData

/// The frequency at which a habit should be completed.
enum Frequency: String, Codable, CaseIterable, Identifiable {
    case daily
    case weekdays
    case weekends
    case custom
    
    var id: String { rawValue }
    
    var label: String {
        switch self {
        case .daily: return "Daily"
        case .weekdays: return "Weekdays"
        case .weekends: return "Weekends"
        case .custom: return "Custom"
        }
    }
}

@Model
final class Habit {
    @Attribute(.unique) var id: UUID
    var name: String
    var emoji: String
    var colorHex: String
    var frequencyRaw: String
    var dailyGoal: String?
    var reminderTime: Date?
    var notes: String?
    var sortOrder: Int
    var createdAt: Date
    var archivedAt: Date?
    
    @Relationship(deleteRule: .cascade, inverse: \HabitEntry.habit)
    var entries: [HabitEntry]?
    
    var frequency: Frequency {
        get { Frequency(rawValue: frequencyRaw) ?? .daily }
        set { frequencyRaw = newValue.rawValue }
    }
    
    init(
        id: UUID = UUID(),
        name: String,
        emoji: String = "⭐",
        colorHex: String = "#FF6B5B",
        frequency: Frequency = .daily,
        dailyGoal: String? = nil,
        reminderTime: Date? = nil,
        notes: String? = nil,
        sortOrder: Int = 0,
        createdAt: Date = Date(),
        archivedAt: Date? = nil
    ) {
        self.id = id
        self.name = name
        self.emoji = emoji
        self.colorHex = colorHex
        self.frequencyRaw = frequency.rawValue
        self.dailyGoal = dailyGoal
        self.reminderTime = reminderTime
        self.notes = notes
        self.sortOrder = sortOrder
        self.createdAt = createdAt
        self.archivedAt = archivedAt
    }
}

// MARK: - Streak Computation

struct StreakInfo {
    let currentStreak: Int
    let longestStreak: Int
    let lastCheckInDate: Date?
    let completionRate: Double
    let totalCheckIns: Int
    let totalDays: Int
    
    static func compute(for habit: Habit, upTo date: Date = Date()) -> StreakInfo {
        let entries = habit.entries ?? []
        let calendar = Calendar.current
        
        // Build a set of dates that were completed
        let completedDates = Set(entries.filter { $0.completed }.map { calendar.startOfDay(for: $0.date) })
        
        // Calculate total days since creation
        let startDate = calendar.startOfDay(for: habit.createdAt)
        let endDate = calendar.startOfDay(for: date)
        let totalDays = calendar.dateComponents([.day], from: startDate, to: endDate).day ?? 0
        
        // Count actual check-ins
        let totalCheckIns = completedDates.count
        
        // Calculate completion rate (only for days that have passed)
        let daysSinceStart = max(1, totalDays)
        let completionRate = min(1.0, Double(totalCheckIns) / Double(daysSinceStart))
        
        // Calculate current streak (going backwards from today)
        var currentStreak = 0
        var checkDate = endDate
        
        while true {
            if completedDates.contains(checkDate) {
                currentStreak += 1
                checkDate = calendar.date(byAdding: .day, value: -1, to: checkDate) ?? checkDate
            } else {
                break
            }
        }
        
        // Calculate longest streak
        let sortedDates = completedDates.sorted()
        var longestStreak = 0
        var tempStreak = 0
        var previousDate: Date?
        
        for date in sortedDates {
            if let prev = previousDate {
                let daysBetween = calendar.dateComponents([.day], from: prev, to: date).day ?? 0
                if daysBetween <= 1 {
                    tempStreak += 1
                } else {
                    tempStreak = 1
                }
            } else {
                tempStreak = 1
            }
            longestStreak = max(longestStreak, tempStreak)
            previousDate = date
        }
        
        let lastEntry = entries
            .filter { $0.completed }
            .max(by: { $0.date < $1.date })
        
        return StreakInfo(
            currentStreak: currentStreak,
            longestStreak: longestStreak,
            lastCheckInDate: lastEntry?.date,
            completionRate: completionRate,
            totalCheckIns: totalCheckIns,
            totalDays: max(1, totalDays)
        )
    }
}