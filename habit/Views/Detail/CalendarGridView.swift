import SwiftUI

struct CalendarGridView: View {
    let viewModel: HabitDetailViewModel
    let color: Color
    
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)
    private let weekdaySymbols = ["S", "M", "T", "W", "T", "F", "S"]
    
    var body: some View {
        VStack(spacing: 12) {
            // Month header
            HStack {
                Button {
                    viewModel.previousMonth()
                    HapticFeedback.light()
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.caption)
                        .foregroundStyle(.brandTextSecondary)
                }
                
                Spacer()
                
                Text(viewModel.selectedMonth.monthAndYear)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.brandTextPrimary)
                
                Spacer()
                
                Button {
                    viewModel.nextMonth()
                    HapticFeedback.light()
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(viewModel.isCurrentMonth ? .brandTextSecondary.opacity(0.3) : .brandTextSecondary)
                }
                .disabled(viewModel.isCurrentMonth)
            }
            .padding(.horizontal, 4)
            
            // Weekday headers
            HStack {
                ForEach(weekdaySymbols, id: \.self) { symbol in
                    Text(symbol)
                        .font(.caption2)
                        .fontWeight(.medium)
                        .foregroundStyle(.brandTextSecondary)
                        .frame(maxWidth: .infinity)
                }
            }
            
            // Calendar grid
            LazyVGrid(columns: columns, spacing: 4) {
                let firstWeekday = Date.weekdayOfFirstOfMonth(for: viewModel.selectedMonth)
                let daysInMonth = Date.daysInMonth(for: viewModel.selectedMonth)
                
                ForEach(0..<firstWeekday, id: \.self) { _ in
                    Color.clear
                        .aspectRatio(1, contentMode: .fill)
                }
                
                ForEach(1...daysInMonth, id: \.self) { day in
                    if let date = dateForDay(day) {
                        DayCell(
                            date: date,
                            isCompleted: viewModel.monthEntries[date] ?? false,
                            isToday: date.isToday,
                            color: color
                        )
                    }
                }
            }
        }
        .padding()
        .background(Color.brandSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
    
    private func dateForDay(_ day: Int) -> Date? {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.year, .month], from: viewModel.selectedMonth)
        return calendar.date(from: components).flatMap {
            calendar.date(byAdding: .day, value: day - 1, to: $0)
        }
    }
}

struct DayCell: View {
    let date: Date
    let isCompleted: Bool
    let isToday: Bool
    let color: Color
    
    var body: some View {
        ZStack {
            if isToday {
                Circle()
                    .stroke(color, lineWidth: 2)
            }
            
            if isCompleted {
                Circle()
                    .fill(color)
            }
            
            Text("\(Calendar.current.component(.day, from: date))")
                .font(.system(size: 12, weight: isToday ? .bold : .regular))
                .foregroundStyle(isCompleted ? .white : (isToday ? color : .brandTextPrimary))
        }
        .aspectRatio(1, contentMode: .fill)
    }
}

#Preview {
    CalendarGridView(
        viewModel: HabitDetailViewModel(
            habit: Habit(name: "Test", emoji: "🧘", colorHex: "#FF6B5B"),
            modelContext: PreviewData.container.mainContext
        ),
        color: .brandPrimary
    )
    .padding()
}