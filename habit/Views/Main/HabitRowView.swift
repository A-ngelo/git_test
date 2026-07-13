import SwiftUI

struct HabitRowView: View {
    let habit: Habit
    let isCompleted: Bool
    let streakInfo: StreakInfo
    let onToggle: () -> Void
    let onTap: () -> Void
    
    @State private var isPressed = false
    
    private var habitColor: Color {
        Color(hex: habit.colorHex)
    }
    
    var body: some View {
        Button {
            onTap()
        } label: {
            HStack(spacing: 16) {
                // Checkbox
                checkmarkButton
                
                // Habit info
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(habit.emoji)
                            .font(.title3)
                        Text(habit.name)
                            .font(.system(.title3, design: .rounded, weight: .semibold))
                            .strikethrough(isCompleted)
                            .foregroundStyle(isCompleted ? .brandTextSecondary : .brandTextPrimary)
                    }
                    
                    if let goal = habit.dailyGoal {
                        Text(goal)
                            .font(.callout)
                            .foregroundStyle(.brandTextSecondary)
                    }
                }
                
                Spacer()
                
                // Streak badge
                if streakInfo.currentStreak > 0 {
                    HStack(spacing: 4) {
                        Image(systemName: "flame.fill")
                            .font(.caption2)
                            .foregroundStyle(.brandAccent)
                        Text("\(streakInfo.currentStreak)")
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundStyle(.brandAccent)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.brandAccent.opacity(0.12), in: .capsule)
                }
            }
            .padding(.vertical, 14)
            .padding(.horizontal, 16)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.brandSurface)
            )
            .scaleEffect(isPressed ? 0.98 : 1.0)
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button(role: .destructive) {
                // Delete
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
        .overlay(alignment: .leading) {
            // Color indicator
            RoundedRectangle(cornerRadius: 16)
                .fill(habitColor)
                .frame(width: 4)
                .frame(maxHeight: .infinity)
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
    
    private var checkmarkButton: some View {
        Button {
            onToggle()
        } label: {
            ZStack {
                Circle()
                    .stroke(isCompleted ? habitColor : Color.brandTextSecondary.opacity(0.4), lineWidth: 2)
                    .frame(width: 28, height: 28)
                
                if isCompleted {
                    Circle()
                        .fill(habitColor)
                        .frame(width: 28, height: 28)
                    
                    Image(systemName: "checkmark")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundStyle(.white)
                        .transition(.scale.combined(with: .opacity))
                }
            }
        }
        .buttonStyle(.plain)
        .contentShape(Circle())
        .sensoryFeedback(.success, trigger: isCompleted)
    }
}

#Preview {
    VStack {
        HabitRowView(
            habit: Habit(name: "Meditate", emoji: "🧘", colorHex: "#FF6B5B", dailyGoal: "10 min"),
            isCompleted: false,
            streakInfo: StreakInfo(currentStreak: 5, longestStreak: 12, lastCheckInDate: Date(), completionRate: 0.8, totalCheckIns: 20, totalDays: 25),
            onToggle: {},
            onTap: {}
        )
        
        HabitRowView(
            habit: Habit(name: "Read", emoji: "📖", colorHex: "#4ECDC4", dailyGoal: "30 min", sortOrder: 1),
            isCompleted: true,
            streakInfo: StreakInfo(currentStreak: 12, longestStreak: 12, lastCheckInDate: Date(), completionRate: 0.9, totalCheckIns: 30, totalDays: 33),
            onToggle: {},
            onTap: {}
        )
    }
    .padding()
    .background(Color.brandBackground)
}