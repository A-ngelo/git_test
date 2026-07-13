import Foundation
import StoreKit

// MARK: - Purchase State Persistence

enum PurchaseState: String {
    case free
    case fullApp
    case bundleSubscription
    
    var isUnlocked: Bool {
        self != .free
    }
    
    var canAddUnlimitedHabits: Bool {
        self == .fullApp || self == .bundleSubscription
    }
}

// MARK: - Store Error

enum StoreError: LocalizedError {
    case failedVerification
    case productNotFound
    case userCancelled
    case unknown
    
    var errorDescription: String? {
        switch self {
        case .failedVerification: return "Transaction verification failed."
        case .productNotFound: return "Product not found in the App Store."
        case .userCancelled: return "Purchase was cancelled."
        case .unknown: return "An unknown error occurred."
        }
    }
}

// MARK: - Store Service

@Observable
final class StoreService {
    static let shared = StoreService()
    
    // MARK: - Product Identifiers
    static let fullAppProductID = "com.pixeltide.habit.full"
    static let bundleSubscriptionProductID = "com.pixeltide.bundle.monthly"
    
    // MARK: - Free Trial Constants
    static let maxFreeHabits = 3
    
    // MARK: - Published State
    var purchaseState: PurchaseState = .free
    var fullAppProduct: Product?
    var bundleProduct: Product?
    var isLoading = false
    var errorMessage: String?
    var showError = false
    
    // MARK: - Private
    private var updates: Task<Void, Never>?
    
    private init() {
        // Load saved purchase state
        loadPurchaseState()
        
        // Start observing transactions
        updates = observeTransactionUpdates()
        
        // Fetch products
        Task {
            await fetchProducts()
        }
    }
    
    deinit {
        updates?.cancel()
    }
    
    // MARK: - Computed Properties
    
    var isUnlocked: Bool {
        purchaseState.isUnlocked
    }
    
    var canAddUnlimitedHabits: Bool {
        purchaseState.canAddUnlimitedHabits
    }
    
    var freeHabitLimit: Int {
        Self.maxFreeHabits
    }
    
    // MARK: - Product Fetching
    
    @MainActor
    func fetchProducts() async {
        let productIDs = [Self.fullAppProductID, Self.bundleSubscriptionProductID]
        
        do {
            let products = try await Product.products(for: Set(productIDs))
            for product in products {
                switch product.id {
                case Self.fullAppProductID:
                    fullAppProduct = product
                case Self.bundleSubscriptionProductID:
                    bundleProduct = product
                default:
                    break
                }
            }
        } catch {
            print("Failed to fetch products: \(error)")
        }
    }
    
    // MARK: - Purchase Flow
    
    @MainActor
    func purchaseFullApp() async {
        guard let product = fullAppProduct else {
            errorMessage = StoreError.productNotFound.errorDescription
            showError = true
            return
        }
        
        await purchase(product)
    }
    
    @MainActor
    func subscribeToBundle() async {
        guard let product = bundleProduct else {
            errorMessage = StoreError.productNotFound.errorDescription
            showError = true
            return
        }
        
        await purchase(product)
    }
    
    @MainActor
    private func purchase(_ product: Product) async {
        isLoading = true
        errorMessage = nil
        
        do {
            let result = try await product.purchase()
            
            switch result {
            case .success(let verification):
                let transaction = try checkVerified(verification)
                await handlePurchase(for: product.id)
                await transaction.finish()
                
            case .userCancelled:
                errorMessage = StoreError.userCancelled.errorDescription
                showError = true
                
            case .pending:
                // Purchase is pending (e.g., Ask to Buy)
                break
                
            @unknown default:
                errorMessage = StoreError.unknown.errorDescription
                showError = true
            }
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
        
        isLoading = false
    }
    
    // MARK: - Restore Purchases
    
    @MainActor
    func restorePurchases() async {
        isLoading = true
        errorMessage = nil
        
        do {
            try await AppStore.sync()
            
            // Check for existing transactions
            var foundPurchase = false
            
            // Check full app purchase
            if let fullAppTransaction = await fetchTransaction(for: Self.fullAppProductID) {
                if fullAppTransaction.revocationDate == nil {
                    await handlePurchase(for: Self.fullAppProductID)
                    foundPurchase = true
                }
            }
            
            // Check bundle subscription
            if let bundleTransaction = await fetchTransaction(for: Self.bundleSubscriptionProductID) {
                if bundleTransaction.revocationDate == nil {
                    await handlePurchase(for: Self.bundleSubscriptionProductID)
                    foundPurchase = true
                }
            }
            
            if !foundPurchase {
                // If nothing was restored, check current entitlements
                await checkCurrentEntitlements()
            }
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
        
        isLoading = false
    }
    
    // MARK: - Transaction Management
    
    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified:
            throw StoreError.failedVerification
        case .verified(let safe):
            return safe
        }
    }
    
    private func fetchTransaction(for productID: String) async -> Transaction? {
        // Check the latest transaction for this product
        let transactions = Transaction.currentEntitlements
        for await result in transactions {
            guard let transaction = try? checkVerified(result) else { continue }
            if transaction.productID == productID {
                return transaction
            }
        }
        return nil
    }
    
    @MainActor
    private func handlePurchase(for productID: String) async {
        switch productID {
        case Self.fullAppProductID:
            purchaseState = .fullApp
            savePurchaseState()
            
        case Self.bundleSubscriptionProductID:
            purchaseState = .bundleSubscription
            savePurchaseState()
            
        default:
            break
        }
    }
    
    @MainActor
    private func checkCurrentEntitlements() async {
        // Iterate through current entitlements to find any active purchases
        for await result in Transaction.currentEntitlements {
            guard let transaction = try? checkVerified(result) else { continue }
            
            switch transaction.productID {
            case Self.fullAppProductID:
                if transaction.revocationDate == nil {
                    purchaseState = .fullApp
                    savePurchaseState()
                }
                
            case Self.bundleSubscriptionProductID:
                if transaction.revocationDate == nil {
                    purchaseState = .bundleSubscription
                    savePurchaseState()
                }
                
            default:
                break
            }
        }
    }
    
    private func observeTransactionUpdates() -> Task<Void, Never> {
        Task { [weak self] in
            for await result in Transaction.updates {
                guard let transaction = try? self?.checkVerified(result) else { continue }
                
                await self?.handlePurchase(for: transaction.productID)
                await transaction.finish()
            }
        }
    }
    
    // MARK: - Persistence
    
    private func savePurchaseState() {
        UserDefaults.standard.set(purchaseState.rawValue, forKey: "purchaseState")
    }
    
    private func loadPurchaseState() {
        let rawValue = UserDefaults.standard.string(forKey: "purchaseState") ?? PurchaseState.free.rawValue
        purchaseState = PurchaseState(rawValue: rawValue) ?? .free
    }
    
    // MARK: - Free Trial Check
    
    /// Check if the user can add a new habit (respects free trial limit)
    func canAddHabit(currentHabitCount: Int) -> Bool {
        if purchaseState.isUnlocked {
            return true
        }
        return currentHabitCount < Self.maxFreeHabits
    }
    
    /// Returns the number of habits the user can still add for free
    func remainingFreeHabits(currentHabitCount: Int) -> Int {
        max(0, Self.maxFreeHabits - currentHabitCount)
    }
}