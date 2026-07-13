import SwiftUI
import SwiftData

struct HabitDetailView: View {
    @Environment(\.modelContext) private var modelContext
    @State private var viewModel: HabitDetailViewModel?
    let habit: Habit
    
    private var habitColor: Color {
        Color(hex: habit.colorHex)
    }
    
    var body: some View {
        ScrollView {
            if let viewModel = viewModel {
                VStack(spacing: 20) {
                    // Header
                    habitHeader
                    
                    // Streak card
                    StreakCardView(streakInfo: viewModel.streakInfo, color: habitColor)
                    
                    // Calendar grid
                    CalendarGridView(
                        viewModel: viewModel,
                        color: habitColor
                    )
                    
                    // History
                    HistoryListView(entries: viewModel.sortedEntries)
                }
                .padding(24)
            } else {
                ProgressView()
                    .task {
                        viewModel = HabitDetailViewModel(habit: habit, modelContext: modelContext)
                    }
            }
        }
        .background(Color.brandBackground)
        .navigationTitle(habit.name)
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        // Edit
                    } label: {
                        Label("Edit", systemImage: "pencil")
                    }
                    
                    Button(role: .destructive) {
                        // Delete
                    } label: {
                        Label("Delete Habit", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .font(.headline)
                        .foregroundStyle(.brandPrimary)
                }
            }
        }
    }
    
    private var habitHeader: some View {
        VStack(spacing: 12) {
            Text(habit.emoji)
                .font(.system(size: 48))
            
            Text(habit.name)
                .font(.system(.title, design: .rounded, weight: .bold))
                .foregroundStyle(.brandTextPrimary)
            
            if let goal = habit.dailyGoal {
                Text(goal)
                    .font(.subheadline)
                    .foregroundStyle(.brandTextSecondary)
            }
            
            HStack(spacing: 4) {
                Circle()
                    .fill(habitColor)
                    .frame(width: 8, height: 8)
                Text(habit.frequency.label)
                    .font(.caption)
                    .foregroundStyle(.brandTextSecondary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.brandSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

#Preview {
    NavigationStack {
        HabitDetailView(habit: Habit(name: "Meditate", emoji: "🧘", colorHex: "#FF6B5B", dailyGoal: "10 min"))
            .modelContainer(PreviewData.container)
    }
}