import SwiftUI
import StoreKit

struct PaywallView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = StoreService.shared
    @State private var selectedPlan: PlanType = .full
    @State private var isPurchasing = false
    
    enum PlanType: String, CaseIterable {
        case free
        case full
        case bundle
        
        var title: String {
            switch self {
            case .free: return "Free"
            case .full: return "Full Access"
            case .bundle: return "Pixeltide Bundle"
            }
        }
    }
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    headerSection
                    
                    // Feature comparison
                    featureComparisonSection
                    
                    // Pricing cards
                    pricingCardsSection
                    
                    // Restore & legal
                    footerSection
                }
                .padding(24)
            }
            .background(Color.brandBackground)
            .navigationTitle("Unlock Habit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        HapticFeedback.light()
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title2)
                            .foregroundStyle(.brandTextSecondary)
                    }
                }
            }
            .alert("Purchase Error", isPresented: $store.showError) {
                Button("OK") {
                    store.showError = false
                }
            } message: {
                Text(store.errorMessage ?? "Something went wrong.")
            }
            .overlay {
                if store.isLoading {
                    Color.black.opacity(0.3)
                        .ignoresSafeArea()
                        .overlay {
                            VStack(spacing: 16) {
                                ProgressView()
                                    .scaleEffect(1.5)
                                    .tint(.white)
                                Text("Processing...")
                                    .font(.headline)
                                    .foregroundStyle(.white)
                            }
                            .padding(24)
                            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
                        }
                }
            }
        }
    }
    
    // MARK: - Header
    
    private var headerSection: some View {
        VStack(spacing: 12) {
            Image(systemName: "crown.fill")
                .font(.system(size: 48))
                .foregroundStyle(.brandAccent)
            
            Text("Build Better Habits")
                .font(.system(.title, design: .rounded, weight: .bold))
                .foregroundStyle(.brandTextPrimary)
            
            Text("Start with 3 free habits. Upgrade to unlock unlimited potential.")
                .font(.subheadline)
                .foregroundStyle(.brandTextSecondary)
                .multilineTextAlignment(.center)
        }
    }
    
    // MARK: - Feature Comparison
    
    private var featureComparisonSection: some View {
        VStack(spacing: 0) {
            // Header row
            HStack {
                Text("Features")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.brandTextPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                
                ForEach(PlanType.allCases, id: \.rawValue) { plan in
                    Text(plan.title)
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(selectedPlan == plan ? .white : .brandTextSecondary)
                        .frame(width: 80)
                        .padding(.vertical, 6)
                        .background(
                            selectedPlan == plan
                                ? Color.brandPrimary
                                : Color.brandSurface,
                            in: .capsule
                        )
                        .onTapGesture {
                            withAnimation(.spring) {
                                selectedPlan = plan
                                HapticFeedback.light()
                            }
                        }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            
            Divider()
                .background(Color.brandSeparator)
            
            // Feature rows
            ForEach(features, id: \.title) { feature in
                featureRow(feature)
                if feature.title != features.last?.title {
                    Divider()
                        .background(Color.brandSeparator)
                }
            }
        }
        .background(Color.brandSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
    
    private struct Feature: Identifiable {
        let id = UUID()
        let title: String
        let icon: String
        let free: Bool
        let full: Bool
        let bundle: Bool
    }
    
    private var features: [Feature] {
        [
            Feature(title: "Track Habits", icon: "checkmark.circle.fill", free: true, full: true, bundle: true),
            Feature(title: "Daily Streaks", icon: "flame.fill", free: true, full: true, bundle: true),
            Feature(title: "Widgets", icon: "square.grid.2x2.fill", free: true, full: true, bundle: true),
            Feature(title: "Unlimited Habits", icon: "infinity", free: false, full: true, bundle: true),
            Feature(title: "Detailed Stats", icon: "chart.bar.fill", free: false, full: true, bundle: true),
            Feature(title: "iCloud Sync", icon: "icloud.fill", free: false, full: true, bundle: true),
            Feature(title: "Custom Themes", icon: "paintbrush.fill", free: false, false, bundle: true),
            Feature(title: "All Pixeltide Apps", icon: "square.stack.3d.up.fill", free: false, false, bundle: true),
            Feature(title: "Early Access", icon: "star.fill", free: false, false, bundle: true)
        ]
    }
    
    private func featureRow(_ feature: Feature) -> some View {
        HStack {
            Image(systemName: feature.icon)
                .font(.caption)
                .foregroundStyle(.brandPrimary)
                .frame(width: 20)
            
            Text(feature.title)
                .font(.subheadline)
                .foregroundStyle(.brandTextPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
            
            HStack(spacing: 0) {
                ForEach(PlanType.allCases, id: \.rawValue) { plan in
                    Image(systemName: checkmark(for: plan, feature: feature))
                        .font(.caption)
                        .foregroundStyle(color(for: plan, feature: feature))
                        .frame(width: 80)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }
    
    private func checkmark(for plan: PlanType, feature: Feature) -> String {
        switch plan {
        case .free: return feature.free ? "checkmark.circle.fill" : "xmark.circle"
        case .full: return feature.full ? "checkmark.circle.fill" : "xmark.circle"
        case .bundle: return feature.bundle ? "checkmark.circle.fill" : "xmark.circle"
        }
    }
    
    private func color(for plan: PlanType, feature: Feature) -> Color {
        let isAvailable: Bool = {
            switch plan {
            case .free: return feature.free
            case .full: return feature.full
            case .bundle: return feature.bundle
            }
        }()
        return isAvailable ? .brandSuccess : .brandTextSecondary.opacity(0.4)
    }
    
    // MARK: - Pricing Cards
    
    private var pricingCardsSection: some View {
        VStack(spacing: 16) {
            // Full App Card
            pricingCard(
                title: "Full Access",
                subtitle: "One-time purchase",
                price: store.fullAppProduct?.displayPrice ?? "$4.99",
                description: "Unlock unlimited habits, detailed stats, and iCloud sync.",
                isRecommended: true,
                action: {
                    Task { await store.purchaseFullApp() }
                }
            )
            
            // Bundle Card
            pricingCard(
                title: "Pixeltide Bundle",
                subtitle: "Subscription",
                price: store.bundleProduct?.displayPrice ?? "$19.99/mo",
                description: "Get every Pixeltide Studio app plus early access and exclusive features.",
                isRecommended: false,
                action: {
                    Task { await store.subscribeToBundle() }
                }
            )
        }
    }
    
    private func pricingCard(title: String, subtitle: String, price: String, description: String, isRecommended: Bool, action: @escaping () -> Void) -> some View {
        VStack(spacing: 12) {
            if isRecommended {
                HStack {
                    Image(systemName: "crown.fill")
                        .font(.caption)
                    Text("Most Popular")
                        .font(.caption)
                        .fontWeight(.semibold)
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 4)
                .background(.brandPrimary, in: .capsule)
            }
            
            Text(title)
                .font(.system(.title3, design: .rounded, weight: .bold))
                .foregroundStyle(.brandTextPrimary)
            
            Text(subtitle)
                .font(.caption)
                .foregroundStyle(.brandTextSecondary)
            
            Text(price)
                .font(.system(.title, design: .rounded, weight: .bold))
                .foregroundStyle(.brandPrimary)
            
            Text(description)
                .font(.caption)
                .foregroundStyle(.brandTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 8)
            
            Button {
                action()
            } label: {
                Text(title == "Full Access" ? "Unlock Full Access" : "Subscribe Now")
                    .font(.headline)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(isRecommended ? Color.brandPrimary : Color.brandSecondary, in: .capsule)
            }
            .disabled(store.isLoading)
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(Color.brandSurface)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(isRecommended ? Color.brandPrimary : Color.brandSeparator, lineWidth: isRecommended ? 2 : 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
    
    // MARK: - Footer
    
    private var footerSection: some View {
        VStack(spacing: 16) {
            Button {
                Task { await store.restorePurchases() }
            } label: {
                Text("Restore Purchases")
                    .font(.footnote)
                    .foregroundStyle(.brandPrimary)
            }
            .disabled(store.isLoading)
            
            Text("Payment will be charged to your Apple ID account at confirmation of purchase. Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period. Manage subscriptions in Account Settings.")
                .font(.caption2)
                .foregroundStyle(.brandTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 16)
        }
    }
}

#Preview {
    PaywallView()
}