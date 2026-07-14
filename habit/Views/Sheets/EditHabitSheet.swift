import SwiftUI
import SwiftData

struct EditHabitSheet: View {
    @Environment(\.dismiss) private var dismiss
    let habit: Habit
    let onSave: () -> Void
    
    @State private var name: String
    @State private var selectedEmoji: String
    @State private var selectedColorIndex: Int
    @State private var selectedFrequency: Frequency
    @State private var dailyGoal: String
    @State private var reminderTime: Date
    @State private var hasReminder: Bool
    @State private var notes: String
    
    let emojis = ["⭐", "🧘", "📖", "✍️", "💪", "💧", "🎯", "🎨", "🎵", "🌱", "🏃", "🧠", "📝", "☕", "🥗", "🛌"]
    
    init(habit: Habit, onSave: @escaping () -> Void) {
        self.habit = habit
        self.onSave = onSave
        _name = State(initialValue: habit.name)
        _selectedEmoji = State(initialValue: habit.emoji)
        let colorIndex = Color.habitSwatches.firstIndex(where: { $0.hex == habit.colorHex }) ?? 0
        _selectedColorIndex = State(initialValue: colorIndex)
        _selectedFrequency = State(initialValue: habit.frequency)
        _dailyGoal = State(initialValue: habit.dailyGoal ?? "")
        _reminderTime = State(initialValue: habit.reminderTime ?? Date())
        _hasReminder = State(initialValue: habit.reminderTime != nil)
        _notes = State(initialValue: habit.notes ?? "")
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
                        TextField("e.g. 30 min, 5 pages", text: $dailyGoal)
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
            .navigationTitle("Edit Habit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        saveChanges()
                    }
                    .fontWeight(.semibold)
                    .disabled(name.isEmpty)
                }
            }
        }
        .presentationDetents([.large])
    }
    
    private func saveChanges() {
        guard !name.isEmpty else { return }
        
        let selectedHex = Color.habitSwatches[selectedColorIndex].hex
        
        habit.name = name
        habit.emoji = selectedEmoji
        habit.colorHex = selectedHex
        habit.frequency = selectedFrequency
        habit.dailyGoal = dailyGoal.isEmpty ? nil : dailyGoal
        habit.reminderTime = hasReminder ? reminderTime : nil
        habit.notes = notes.isEmpty ? nil : notes
        
        if hasReminder, let reminderTime = habit.reminderTime {
            NotificationService.shared.scheduleReminder(for: habit)
        } else {
            NotificationService.shared.removeReminder(for: habit)
        }
        
        HapticFeedback.success()
        onSave()
        dismiss()
    }
}

#Preview {
    EditHabitSheet(
        habit: Habit(name: "Meditate", emoji: "🧘", colorHex: "#FF6B5B"),
        onSave: {}
    )
}