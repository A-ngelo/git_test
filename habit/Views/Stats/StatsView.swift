import SwiftUI
import SwiftData

struct StatsView: View {
    @Environment(\.modelContext) private var modelContext
    @State private var viewModel: StatsViewModel?
    
    var body: some View {
        NavigationStack {
            Group {
                if let viewModel = viewModel {
                    ScrollView {
                        VStack(spacing: 16) {
                            // Overview cards
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                                StatCard(
                                    title: "Total Habits",
                                    value: "\(viewModel.totalHabits)",
                                    icon: "checkmark.circle.fill",
                                    color: .brandPrimary
                                )
                                
                                StatCard(
                                    title: "Check-ins",
                                    value: "\(viewModel.totalCheckIns)",
                                    icon: "number.circle.fill",
                                    color: .brandSecondary
                                )
                                
                                StatCard(
                                    title: "Best Streak",
                                    value: "\(viewModel.bestStreak) days",
                                    icon: "flame.fill",
                                    color: .brandAccent
                                )
                                
                                StatCard(
                                    title: "Current",
                                    value: "\(viewModel.currentStreakSum) days",
                                    icon: "bolt.fill",
                                    color: .purple
                                )
                            }
                            .padding(.horizontal, 24)
                            
                            // Completion ring
                            CompletionRingView(
                                rate: viewModel.overallCompletionRate,
                                habitCount: viewModel.totalHabits
                            )
                            .padding(.horizontal, 24)
                            
                            // Best habit
                            if let best = viewModel.bestHabit {
                                bestHabitCard(habit: best.habit, streak: best.streak)
                            }
                            
                            // Weekly trend
                            TrendChartView(data: viewModel.weeklyData)
                                .padding(.horizontal, 24)
                        }
                        .padding(.vertical, 24)
                    }
                    .background(Color.brandBackground)
                } else {
                    ProgressView()
                        .task {
                            viewModel = StatsViewModel(modelContext: modelContext)
                        }
                }
            }
            .navigationTitle("Stats")
            .navigationBarTitleDisplayMode(.large)
        }
    }
    
    private func bestHabitCard(habit: Habit, streak: StreakInfo) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Best Habit")
                .font(.system(.headline, design: .rounded, weight: .semibold))
                .foregroundStyle(.brandTextSecondary)
            
            HStack(spacing: 16) {
                Text(habit.emoji)
                    .font(.system(size: 36))
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(habit.name)
                        .font(.system(.title3, design: .rounded, weight: .semibold))
                        .foregroundStyle(.brandTextPrimary)
                    
                    Text("Best streak: \(streak.longestStreak) days")
                        .font(.caption)
                        .foregroundStyle(.brandTextSecondary)
                }
                
                Spacer()
                
                VStack(spacing: 2) {
                    Text("\(streak.longestStreak)")
                        .font(.system(.title, design: .rounded, weight: .bold))
                        .foregroundStyle(.brandAccent)
                    Image(systemName: "flame.fill")
                        .font(.caption2)
                        .foregroundStyle(.brandAccent)
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.brandSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal, 24)
    }
}

struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(color)
            
            Text(value)
                .font(.system(.title2, design: .rounded, weight: .bold))
                .foregroundStyle(.brandTextPrimary)
                .minimumScaleFactor(0.7)
            
            Text(title)
                .font(.caption)
                .foregroundStyle(.brandTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.brandSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

#Preview {
    StatsView()
        .modelContainer(PreviewData.container)
}