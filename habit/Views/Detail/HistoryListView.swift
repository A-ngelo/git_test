import SwiftUI

struct HistoryListView: View {
    let entries: [HabitEntry]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("History")
                .font(.system(.headline, design: .rounded, weight: .semibold))
                .foregroundStyle(.brandTextPrimary)
            
            if entries.isEmpty {
                Text("No entries yet")
                    .font(.subheadline)
                    .foregroundStyle(.brandTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 16)
            } else {
                LazyVStack(spacing: 0) {
                    ForEach(entries.prefix(30)) { entry in
                        HStack {
                            Image(systemName: entry.completed ? "checkmark.circle.fill" : "xmark.circle")
                                .foregroundStyle(entry.completed ? .brandSuccess : .brandError)
                                .font(.title3)
                            
                            Text(entry.date.formattedDate)
                                .font(.subheadline)
                                .foregroundStyle(.brandTextPrimary)
                            
                            Spacer()
                            
                            if entry.completed {
                                Text(entry.date.formattedTime)
                                    .font(.caption)
                                    .foregroundStyle(.brandTextSecondary)
                            } else {
                                Text("Missed")
                                    .font(.caption)
                                    .foregroundStyle(.brandError)
                            }
                        }
                        .padding(.vertical, 8)
                        .padding(.horizontal, 4)
                        
                        if entry.id != entries.prefix(30).last?.id {
                            Divider()
                                .background(Color.brandSeparator)
                        }
                    }
                }
            }
        }
        .padding()
        .background(Color.brandSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

#Preview {
    let habit = Habit(name: "Test", emoji: "🧘", colorHex: "#FF6B5B")
    let entries = [
        HabitEntry(habit: habit, date: Date(), completed: true),
        HabitEntry(habit: habit, date: Calendar.current.date(byAdding: .day, value: -1, to: Date())!, completed: true),
        HabitEntry(habit: habit, date: Calendar.current.date(byAdding: .day, value: -2, to: Date())!, completed: false)
    ]
    
    HistoryListView(entries: entries)
        .padding()
}