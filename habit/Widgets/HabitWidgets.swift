import SwiftUI
import WidgetKit

@main
struct HabitWidgets: WidgetBundle {
    var body: some Widget {
        ChecklistWidget()
        StreakWidget()
        SingleHabitWidget()
    }
}