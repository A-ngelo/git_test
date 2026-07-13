import SwiftUI
import SwiftData

struct AddHabitSheet: View {
    @Environment(\.dismiss) private var dismiss
    let viewModel: HabitListViewModel?
    
    @State private var name = ""
    @State private var selectedEmoji = "⭐"
    @State private var selectedColorIndex = 0
    @State private var selectedFrequency: Frequency = .daily
    @State private var dailyGoal = ""
    @State private var reminderTime = Date()
    @State private var hasReminder = false
    @State private var notes = ""
    
    let emojis = ["⭐", "🧘", "📖", "✍️", "💪", "💧", "🎯", "🎨", "🎵", "🌱", "🏃", "🧠", "📝", "☕", "🥗", "🛌"]
    
    private var selectedColor: Color {
        Color.habitSwatches[selectedColorIndex].color
    }
    
    private var selectedHex: String {
        Color.habitSwatches[selectedColorIndex].hex
    }
    
    var body: some View {
        NavigationStack {
            Form {
                // Name & Emoji
                Section("Habit") {
                    HStack {
                        TextField("Habit name", text: $name)
                            .font(.body)
                        
                        Menu {
                            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 6), spacing: 8) {
                                ForEach(emojis, id: \.self) { emoji in
                                    Button(emoji) {
                                        selectedEmoji = emoji
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        } label: {
                            Text(selectedEmoji)
                                .font(.title2)
                                .padding(6)
                                .background(Color.brandSurface)
                                .clipShape(Circle())
                        }
                    }
                    
                    // Color swatches
                    HStack(spacing: 10) {
                        ForEach(Array(Color.habitSwatches.enumerated()), id: \.offset) { index, swatch in
                            Circle()
                                .fill(swatch.color)
                                .frame(width: 28, height: 28)
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
                }
                
                // Frequency
                Section("Frequency") {
                    Picker("Frequency", selection: $selectedFrequency) {
                        ForEach(Frequency.allCases) { freq in
                            Text(freq.label).tag(freq)
                        }
                    }
                }
                
                // Goal
                Section("Daily Goal (Optional)") {
                    HStack {
                        Image(systemName: "target")
                            .foregroundStyle(.brandPrimary)
                        TextField("e.g. 30 min, 5 pages, 1 time", text: $dailyGoal)
                    }
                }
                
                // Reminder
                Section("Reminder (Optional)") {
                    Toggle(isOn: $hasReminder) {
                        Label("Set Reminder", systemImage: "bell.fill")
                            .foregroundStyle(.brandPrimary)
                    }
                    
                    if hasReminder {
                        DatePicker("Time", selection: $reminderTime, displayedComponents: .hourAndMinute)
                    }
                }
                
                // Notes
                Section("Notes (Optional)") {
                    TextField("Private notes", text: $notes, axis: .vertical)
                        .lineLimit(3...6)
                }
            }
            .navigationTitle("New Habit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        saveHabit()
                    }
                    .fontWeight(.semibold)
                    .disabled(name.isEmpty)
                }
            }
        }
        .presentationDetents([.large])
    }
    
    private func saveHabit() {
        guard !name.isEmpty else { return }
        
        viewModel?.addHabit(
            name: name,
            emoji: selectedEmoji,
            colorHex: selectedHex,
            frequency: selectedFrequency,
            dailyGoal: dailyGoal.isEmpty ? nil : dailyGoal,
            reminderTime: hasReminder ? reminderTime : nil,
            notes: notes.isEmpty ? nil : notes
        )
        
        HapticFeedback.success()
        dismiss()
    }
}

#Preview {
    AddHabitSheet(viewModel: nil)
}