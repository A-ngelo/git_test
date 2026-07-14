import Foundation
import UserNotifications

final class NotificationService {
    static let shared = NotificationService()
    
    private init() {}
    
    func requestAuthorization() async -> Bool {
        let center = UNUserNotificationCenter.current()
        do {
            return try await center.requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            print("Notification authorization failed: \(error)")
            return false
        }
    }
    
    func scheduleReminder(for habit: Habit) {
        guard let reminderTime = habit.reminderTime else { return }
        
        let content = UNMutableNotificationContent()
        content.title = "\(habit.emoji) \(habit.name)"
        content.body = "Don't forget to check in today!"
        content.sound = .default
        
        let calendar = Calendar.current
        let hour = calendar.component(.hour, from: reminderTime)
        let minute = calendar.component(.minute, from: reminderTime)
        
        var dateComponents = DateComponents()
        dateComponents.hour = hour
        dateComponents.minute = minute
        
        let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)
        let request = UNNotificationRequest(
            identifier: "habit-\(habit.id.uuidString)",
            content: content,
            trigger: trigger
        )
        
        UNUserNotificationCenter.current().add(request)
    }
    
    func removeReminder(for habit: Habit) {
        UNUserNotificationCenter.current()
            .removePendingNotificationRequests(withIdentifiers: ["habit-\(habit.id.uuidString)"])
    }
    
    func removeAllReminders() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    }
}