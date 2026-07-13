import SwiftUI

struct CompletionRingView: View {
    let rate: Double
    let habitCount: Int
    
    var body: some View {
        VStack(spacing: 16) {
            Text("Overall Completion")
                .font(.system(.headline, design: .rounded, weight: .semibold))
                .foregroundStyle(.brandTextPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
            
            HStack {
                ZStack {
                    // Background ring
                    Circle()
                        .stroke(Color.brandSeparator, lineWidth: 12)
                    
                    // Progress ring
                    Circle()
                        .trim(from: 0, to: rate)
                        .stroke(
                            AngularGradient(
                                colors: [.brandPrimary, .brandSecondary, .brandAccent],
                                center: .center,
                                startAngle: .degrees(-90),
                                endAngle: .degrees(270)
                            ),
                            style: StrokeStyle(lineWidth: 12, lineCap: .round)
                        )
                        .rotationEffect(.degrees(-90))
                        .animation(.spring, value: rate)
                    
                    // Center text
                    VStack(spacing: 2) {
                        Text("\(Int(rate * 100))%")
                            .font(.system(.title, design: .rounded, weight: .bold))
                            .foregroundStyle(.brandTextPrimary)
                        Text("\(habitCount) habits")
                            .font(.caption)
                            .foregroundStyle(.brandTextSecondary)
                    }
                }
                .frame(width: 140, height: 140)
                
                Spacer()
                
                VStack(alignment: .leading, spacing: 12) {
                    legendItem(color: .brandPrimary, label: "On track")
                    legendItem(color: .brandSecondary, label: "Consistent")
                    legendItem(color: .brandAccent, label: "Building")
                }
            }
        }
        .padding()
        .background(Color.brandSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
    
    private func legendItem(color: Color, label: String) -> some View {
        HStack(spacing: 8) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)
            Text(label)
                .font(.caption)
                .foregroundStyle(.brandTextSecondary)
        }
    }
}

#Preview {
    CompletionRingView(rate: 0.68, habitCount: 5)
        .padding()
}