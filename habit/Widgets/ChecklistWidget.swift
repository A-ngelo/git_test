import WidgetKit
import SwiftUI

struct ChecklistProvider: TimelineProvider {
    func placeholder(in context: Context) -> ChecklistEntry {
        ChecklistEntry(date: Date(), habits: [], progress: (0, 0))
    }
    
    func getSnapshot(in context: Context, completion: @escaping (ChecklistEntry) -> Void) {
        let entry = ChecklistEntry(date: Date(), habits: [], progress: (0, 0))
        completion(entry)
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<ChecklistEntry>) -> Void) {
        let entry = ChecklistEntry(date: Date(), habits: [], progress: (0, 0))
        let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(3600)))
        completion(timeline)
    }
}

struct ChecklistEntry: TimelineEntry {
    let date: Date
    let habits: [Habit]
    let progress: (completed: Int, total: Int)
}

struct ChecklistWidgetEntryView: View {
    var entry: ChecklistProvider.Entry
    @Environment(\.widgetFamily) var family
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "checklist")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("Today")
                    .font(.caption)
                    .fontWeight(.semibold)
                Spacer()
                Text("\(entry.progress.completed)/\(entry.progress.total)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            
            ProgressView(value: entry.progress.total > 0 ? Double(entry.progress.completed) / Double(entry.progress.total) : 0)
                .tint(.brandPrimary)
            
            if entry.habits.isEmpty {
                Text("No habits yet")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.top, 4)
            } else {
                ForEach(entry.habits.prefix(5)) { habit in
                    HStack(spacing: 6) {
                        Text(habit.emoji)
                            .font(.caption)
                        Text(habit.name)
                            .font(.caption)
                            .lineLimit(1)
                        Spacer()
                    }
                }
            }
        }
        .containerBackground(.background, for: .widget)
    }
}

struct ChecklistWidget: Widget {
    let kind: String = "ChecklistWidget"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ChecklistProvider()) { entry in
            ChecklistWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Habit Checklist")
        .description("See your today's habits at a glance.")
        .supportedFamilies([.systemMedium])
    }
}