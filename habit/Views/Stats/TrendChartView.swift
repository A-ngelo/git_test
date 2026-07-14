import SwiftUI
import Charts

struct TrendChartView: View {
    let data: [(date: Date, count: Int)]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("This Week")
                .font(.system(.headline, design: .rounded, weight: .semibold))
                .foregroundStyle(.brandTextPrimary)
            
            Chart {
                ForEach(data, id: \.date) { item in
                    BarMark(
                        x: .value("Day", item.date, unit: .day),
                        y: .value("Check-ins", item.count)
                    )
                    .foregroundStyle(.brandPrimary.gradient)
                    .cornerRadius(4)
                }
            }
            .frame(height: 160)
            .chartXAxis {
                AxisMarks(values: .stride(by: .day)) { value in
                    AxisValueLabel(format: .dateTime.weekday(.abbreviated), centered: true)
                        .foregroundStyle(.brandTextSecondary)
                }
            }
            .chartYAxis {
                AxisMarks { value in
                    AxisValueLabel()
                        .foregroundStyle(.brandTextSecondary)
                }
            }
        }
        .padding()
        .background(Color.brandSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

#Preview {
    TrendChartView(data: [
        (Date(), 3),
        (Calendar.current.date(byAdding: .day, value: -1, to: Date())!, 5),
        (Calendar.current.date(byAdding: .day, value: -2, to: Date())!, 2),
        (Calendar.current.date(byAdding: .day, value: -3, to: Date())!, 4),
        (Calendar.current.date(byAdding: .day, value: -4, to: Date())!, 1),
        (Calendar.current.date(byAdding: .day, value: -5, to: Date())!, 3),
        (Calendar.current.date(byAdding: .day, value: -6, to: Date())!, 5)
    ])
    .padding()
}