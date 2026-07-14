import WidgetKit
import SwiftUI

struct SingleHabitProvider: TimelineProvider {
    func placeholder(in context: Context) -> SingleHabitEntry {
        SingleHabitEntry(date: Date(), emoji: "⭐", name: "Habit", streak: 0, isCompleted: false)
    }
    
    func getSnapshot(in context: Context, completion: @escaping (SingleHabitEntry) -> Void) {
        let entry = SingleHabitEntry(date: Date(), emoji: "⭐", name: "Habit", streak: 0, isCompleted: false)
        completion(entry)
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<SingleHabitEntry>) -> Void) {
        let entry = SingleHabitEntry(date: Date(), emoji: "⭐", name: "Habit", streak: 0, isCompleted: false)
        let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(3600)))
        completion(timeline)
    }
}

struct SingleHabitEntry: TimelineEntry {
    let date: Date
    let emoji: String
    let name: String
    let streak: Int
    let isCompleted: Bool
}

struct SingleHabitWidgetEntryView: View {
    var entry: SingleHabitProvider.Entry
    
    var body: some View {
        VStack(spacing: 8) {
            Text(entry.emoji)
                .font(.system(size: 36))
            
            Text(entry.name)
                .font(.caption)
                .fontWeight(.semibold)
                .lineLimit(1)
            
            if entry.streak > 0 {
                HStack(spacing: 4) {
                    Image(systemName: "flame.fill")
                        .font(.caption2)
                        .foregroundStyle(.brandAccent)
                    Text("\(entry.streak)")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundStyle(.brandAccent)
                }
            }
            
            Image(systemName: entry.isCompleted ? "checkmark.circle.fill" : "circle")
                .font(.title2)
                .foregroundStyle(entry.isCompleted ? .brandSuccess : .secondary)
        }
        .containerBackground(.background, for: .widget)
    }
}

struct SingleHabitWidget: Widget {
    let kind: String = "SingleHabitWidget"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SingleHabitProvider()) { entry in
            SingleHabitWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Single Habit")
        .description("Track one habit at a glance.")
        .supportedFamilies([.systemSmall])
    }
}