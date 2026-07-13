import Foundation
import SwiftData

final class StreakService {
    static let shared = StreakService()
    
    private init() {}
    
    /// Compute streak info for a single habit up to a given date.
    func computeStreak(for habit: Habit, upTo date: Date = Date()) -> StreakInfo {
        StreakInfo.compute(for: habit, upTo: date)
    }
    
    /// Get the current streak for a habit (number of consecutive days including today).
    func currentStreak(for habit: Habit) -> Int {
        StreakInfo.compute(for: habit).currentStreak
    }
    
    /// Get the longest ever streak for a habit.
    func longestStreak(for habit: Habit) -> Int {
        StreakInfo.compute(for: habit).longestStreak
    }
    
    /// Check if a milestone was just reached (returns the milestone value if reached, nil otherwise).
    func checkMilestone(for habit: Habit) -> Int? {
        let streak = currentStreak(for: habit)
        let milestones = [7, 30, 100, 365]
        return milestones.first { $0 == streak }
    }
}