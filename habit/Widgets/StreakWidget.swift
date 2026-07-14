import WidgetKit
import SwiftUI

struct StreakProvider: TimelineProvider {
    func placeholder(in context: Context) -> StreakEntry {
        StreakEntry(date: Date(), topHabits: [])
    }
    
    func getSnapshot(in context: Context, completion: @escaping (StreakEntry) -> Void) {
        completion(StreakEntry(date: Date(), topHabits: []))
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<StreakEntry>) -> Void) {
        let entry = StreakEntry(date: Date(), topHabits: [])
        let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(3600)))
        completion(timeline)
    }
}

struct StreakEntry: TimelineEntry {
    let date: Date
    let topHabits: [(emoji: String, name: String, streak: Int)]
}

struct StreakWidgetEntryView: View {
    var entry: StreakProvider.Entry
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Streaks")
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)
            
            if entry.topHabits.isEmpty {
                VStack(spacing: 4) {
                    Image(systemName: "flame")
                        .font(.title2)
                        .foregroundStyle(.brandAccent)
                    Text("Start a streak!")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ForEach(entry.topHabits.prefix(3), id: \.name) { habit in
                    HStack(spacing: 8) {
                        Text(habit.emoji)
                            .font(.title2)
                        
                        VStack(alignment: .leading, spacing: 0) {
                            Text(habit.name)
                                .font(.caption)
                                .lineLimit(1)
                            Text("\(habit.streak) day streak")
                                .font(.caption2)
                                .foregroundStyle(.brandAccent)
                        }
                        
                        Spacer()
                        
                        Image(systemName: "flame.fill")
                            .font(.caption)
                            .foregroundStyle(.brandAccent)
                    }
                }
            }
        }
        .containerBackground(.background, for: .widget)
    }
}

struct StreakWidget: Widget {
    let kind: String = "StreakWidget"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: StreakProvider()) { entry in
            StreakWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Streak Badge")
        .description("Your top habit streaks.")
        .supportedFamilies([.systemSmall])
    }
}