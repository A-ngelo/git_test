import Foundation
import SwiftData

@Model
final class HabitEntry {
    @Attribute(.unique) var id: UUID
    var habit: Habit?
    var date: Date
    var completed: Bool
    var notes: String?
    var createdAt: Date
    
    init(
        id: UUID = UUID(),
        habit: Habit? = nil,
        date: Date = Date(),
        completed: Bool = true,
        notes: String? = nil,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.habit = habit
        self.date = date
        self.completed = completed
        self.notes = notes
        self.createdAt = createdAt
    }
}