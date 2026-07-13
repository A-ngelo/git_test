import SwiftUI
import SwiftData

struct HabitListView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(StoreService.self) private var store
    @Binding var showPaywall: Bool
    @State private var viewModel: HabitListViewModel?
    @State private var showingAddSheet = false
    @State private var selectedHabit: Habit?
    
    var body: some View {
        NavigationStack {
            Group {
                if let viewModel = viewModel {
                    if viewModel.habits.isEmpty {
                        EmptyStateView()
                    } else {
                        habitListContent(viewModel: viewModel)
                    }
                } else {
                    ProgressView()
                        .task {
                            viewModel = HabitListViewModel(modelContext: modelContext)
                        }
                }
            }
            .navigationTitle("Today")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        tryAddHabit()
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.title2)
                            .foregroundStyle(.brandPrimary)
                    }
                }
            }
            .sheet(isPresented: $showingAddSheet) {
                AddHabitSheet(viewModel: viewModel!)
            }
            .navigationDestination(item: $selectedHabit) { habit in
                HabitDetailView(habit: habit)
            }
            .alert("Habit Limit Reached", isPresented: $viewModel.map { Binding(get: { $0.showingLimitAlert }, set: { $0.showingLimitAlert = $0 }) } ?? .constant(false)) {
                Button("Try Free") {
                    showPaywall = true
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                if let viewModel = viewModel {
                    Text("You've reached the free limit of \(store.freeHabitLimit) habits. Upgrade to Full Access to add unlimited habits.")
                }
            }
        }
    }
    
    private func tryAddHabit() {
        guard let viewModel = viewModel else { return }
        
        if store.canAddHabit(currentHabitCount: viewModel.habits.count) {
            showingAddSheet = true
        } else {
            viewModel.showingLimitAlert = true
        }
        HapticFeedback.light()
    }
    
    private func habitListContent(viewModel: HabitListViewModel) -> some View {
        ScrollView {
            VStack(spacing: 20) {
                // Progress header
                todayProgressHeader(viewModel: viewModel)
                
                // Free trial banner
                if !store.isUnlocked {
                    freeTrialBanner(viewModel: viewModel)
                }
                
                // Habit list
                LazyVStack(spacing: 8) {
                    ForEach(viewModel.habits) { habit in
                        HabitRowView(
                            habit: habit,
                            isCompleted: viewModel.todayEntries[habit]?.completed ?? false,
                            streakInfo: StreakInfo.compute(for: habit),
                            onToggle: {
                                viewModel.toggleCheckInForToday(for: habit)
                                HapticFeedback.success()
                            },
                            onTap: {
                                selectedHabit = habit
                            }
                        )
                    }
                }
                .padding(.horizontal, 24)
            }
            .padding(.vertical, 24)
        }
        .background(Color.brandBackground)
        .refreshable {
            viewModel.loadHabits()
        }
    }
    
    private func todayProgressHeader(viewModel: HabitListViewModel) -> some View {
        VStack(spacing: 8) {
            HStack {
                Text("\(viewModel.completedTodayCount)/\(viewModel.totalHabitsCount) habits done")
                    .font(.subheadline)
                    .foregroundStyle(.brandTextSecondary)
                Spacer()
                Text("\(Int(viewModel.todayCompletionPercentage * 100))%")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(.brandPrimary)
            }
            .padding(.horizontal, 24)
            
            ProgressView(value: viewModel.todayCompletionPercentage)
                .tint(.brandPrimary)
                .padding(.horizontal, 24)
        }
    }
    
    private func freeTrialBanner(viewModel: HabitListViewModel) -> some View {
        let remaining = store.remainingFreeHabits(currentHabitCount: viewModel.habits.count)
        
        return Button {
            showPaywall = true
        } label: {
            HStack {
                Image(systemName: "crown.fill")
                    .font(.caption)
                    .foregroundStyle(.brandAccent)
                
                Text("\(remaining) free habit\(remaining != 1 ? "s" : "") remaining")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(.brandTextPrimary)
                
                Spacer()
                
                Text("Unlock Unlimited")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(.brandPrimary)
                
                Image(systemName: "chevron.right")
                    .font(.caption2)
                    .foregroundStyle(.brandTextSecondary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color.brandSurface, in: RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.brandAccent.opacity(0.3), lineWidth: 1)
            )
            .padding(.horizontal, 24)
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    HabitListView(showPaywall: .constant(false))
        .modelContainer(PreviewData.container)
        .environment(StoreService.shared)
}