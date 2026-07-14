import SwiftUI

struct StreakCardView: View {
    let streakInfo: StreakInfo
    let color: Color
    
    var body: some View {
        VStack(spacing: 16) {
            HStack(spacing: 32) {
                // Current streak
                VStack(spacing: 4) {
                    Text("\(streakInfo.currentStreak)")
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .foregroundStyle(.brandAccent)
                    Text("Current")
                        .font(.caption)
                        .foregroundStyle(.brandTextSecondary)
                }
                
                // Divider
                Rectangle()
                    .fill(Color.brandSeparator)
                    .frame(width: 1, height: 40)
                
                // Longest streak
                VStack(spacing: 4) {
                    Text("\(streakInfo.longestStreak)")
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .foregroundStyle(color)
                    Text("Best")
                        .font(.caption)
                        .foregroundStyle(.brandTextSecondary)
                }
            }
            
            // Completion rate bar
            VStack(spacing: 6) {
                HStack {
                    Text("Completion Rate")
                        .font(.caption)
                        .foregroundStyle(.brandTextSecondary)
                    Spacer()
                    Text("\(Int(streakInfo.completionRate * 100))%")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(color)
                }
                
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.brandSeparator)
                            .frame(height: 8)
                        
                        RoundedRectangle(cornerRadius: 4)
                            .fill(color)
                            .frame(width: geometry.size.width * streakInfo.completionRate, height: 8)
                            .animation(.spring, value: streakInfo.completionRate)
                    }
                }
                .frame(height: 8)
            }
        }
        .padding()
        .background(Color.brandSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

#Preview {
    StreakCardView(
        streakInfo: StreakInfo(currentStreak: 5, longestStreak: 12, lastCheckInDate: Date(), completionRate: 0.75, totalCheckIns: 15, totalDays: 20),
        color: .brandPrimary
    )
    .padding()
}