import SwiftUI
import SwiftData

struct QuickStartPage: View {
    @Binding var isPresented: Bool
    @Environment(\.modelContext) private var modelContext
    @State private var habitName = ""
    @State private var selectedEmoji = "⭐"
    @State private var selectedColorIndex = 0
    @State private var selectedFrequency: Frequency = .daily
    
    let emojis = ["⭐", "🧘", "📖", "✍️", "💪", "💧", "🎯", "🎨", "🎵", "🌱", "🏃", "🧠"]
    
    private var selectedColor: Color {
        Color.habitSwatches[selectedColorIndex].color
    }
    
    private var selectedHex: String {
        Color.habitSwatches[selectedColorIndex].hex
    }
    
    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            
            Text("Add Your First Habit")
                .font(.system(.title2, design: .rounded, weight: .bold))
                .foregroundStyle(.brandTextPrimary)
            
            Text("Start simple — you can always add more later.")
                .font(.subheadline)
                .foregroundStyle(.brandTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            
            VStack(spacing: 16) {
                // Emoji picker
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 6), spacing: 12) {
                    ForEach(emojis, id: \.self) { emoji in
                        Text(emoji)
                            .font(.title2)
                            .padding(8)
                            .background(
                                Circle()
                                    .fill(selectedEmoji == emoji ? selectedColor.opacity(0.2) : .clear)
                            )
                            .overlay(
                                Circle()
                                    .stroke(selectedEmoji == emoji ? selectedColor : .clear, lineWidth: 2)
                            )
                            .onTapGesture {
                                selectedEmoji = emoji
                                HapticFeedback.light()
                            }
                    }
                }
                .padding(.horizontal)
                
                // Habit name
                TextField("Habit name", text: $habitName)
                    .textFieldStyle(.roundedBorder)
                    .font(.body)
                
                // Color swatches
                HStack(spacing: 10) {
                    ForEach(Array(Color.habitSwatches.enumerated()), id: \.offset) { index, swatch in
                        Circle()
                            .fill(swatch.color)
                            .frame(width: 26, height: 26)
                            .overlay(
                                Circle()
                                    .stroke(selectedColorIndex == index ? Color.white : .clear, lineWidth: 3)
                            )
                            .shadow(color: selectedColorIndex == index ? swatch.color.opacity(0.5) : .clear, radius: 4)
                            .onTapGesture {
                                selectedColorIndex = index
                                HapticFeedback.light()
                            }
                    }
                }
                
                // Frequency
                Picker("Frequency", selection: $selectedFrequency) {
                    ForEach(Frequency.allCases) { freq in
                        Text(freq.label).tag(freq)
                    }
                }
                .pickerStyle(.segmented)
            }
            .padding(.horizontal, 32)
            
            Spacer()
            
            Button {
                createHabit()
            } label: {
                Text("Start Building")
                    .font(.headline)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(
                        habitName.isEmpty
                            ? Color.gray
                            : selectedColor,
                        in: .capsule
                    )
            }
            .disabled(habitName.isEmpty)
            .padding(.horizontal, 32)
            .padding(.bottom, 48)
        }
        .background(Color.brandBackground)
        .onAppear {
            HapticFeedback.soft()
        }
    }
    
    private func createHabit() {
        guard !habitName.isEmpty else { return }
        
        let habit = Habit(
            name: habitName,
            emoji: selectedEmoji,
            colorHex: selectedHex,
            frequency: selectedFrequency
        )
        modelContext.insert(habit)
        try? modelContext.save()
        
        UserDefaults.standard.set(true, forKey: "hasSeenOnboarding")
        HapticFeedback.success()
        
        withAnimation(.spring) {
            isPresented = false
        }
    }
}

#Preview {
    QuickStartPage(isPresented: .constant(true))
        .modelContainer(PreviewData.container)
}