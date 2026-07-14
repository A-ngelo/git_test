import Foundation
import SwiftData

@MainActor
enum PreviewData {
    static let container: ModelContainer = {
        let schema = Schema([Habit.self, HabitEntry.self])
        let config = ModelConfiguration(isStoredInMemoryOnly: true)
        
        do {
            let container = try ModelContainer(for: schema, configurations: config)
            insertSampleData(into: container)
            return container
        } catch {
            fatalError("Failed to create preview container: \(error)")
        }
    }()
    
    static let shared = PreviewData.self
    
    private static func insertSampleData(into container: ModelContainer) {
        let context = container.mainContext
        
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        
        // Sample habits
        let meditation = Habit(
            name: "Meditate",
            emoji: "🧘",
            colorHex: "#007AFF",
            frequency: .daily,
            dailyGoal: "10 min",
            sortOrder: 0
        )
        
        let reading = Habit(
            name: "Read",
            emoji: "📖",
            colorHex: "#34C759",
            frequency: .daily,
            dailyGoal: "30 min",
            sortOrder: 1
        )
        
        let writing = Habit(
            name: "Write",
            emoji: "✍️",
            colorHex: "#FF9500",
            frequency: .weekdays,
            dailyGoal: "500 words",
            sortOrder: 2
        )
        
        let exercise = Habit(
            name: "Exercise",
            emoji: "💪",
            colorHex: "#FF2D55",
            frequency: .daily,
            dailyGoal: "30 min",
            sortOrder: 3
        )
        
        let water = Habit(
            name: "Drink Water",
            emoji: "💧",
            colorHex: "#5AC8FA",
            frequency: .daily,
            dailyGoal: "8 glasses",
            sortOrder: 4
        )
        
        context.insert(meditation)
        context.insert(reading)
        context.insert(writing)
        context.insert(exercise)
        context.insert(water)
        
        // Create sample entries for the past 14 days
        let habits = [meditation, reading, writing, exercise, water]
        for habit in habits {
            for dayOffset in 0..<14 {
                // Skip weekends for weekday-only habits
                if habit.frequency == .weekdays {
                    let date = calendar.date(byAdding: .day, value: -dayOffset, to: today)!
                    let weekday = calendar.component(.weekday, from: date)
                    if weekday == 1 || weekday == 7 { continue }
                }
                
                let date = calendar.date(byAdding: .day, value: -dayOffset, to: today)!
                let entry = HabitEntry(
                    habit: habit,
                    date: date,
                    completed: dayOffset < 5 || habit.name == "Meditate" // Some streaks
                )
                context.insert(entry)
            }
        }
        
        try? context.save()
    }
}