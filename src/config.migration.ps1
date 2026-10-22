# config.migration.ps1 - Konfigurasi Migrasi
# Save as: scripts/config.migration.ps1

# ============================================================
# KONFIGURASI MIGRASI
# ============================================================

$global:MIGRATION_CONFIG = @{
    # Firebase Config
    Firebase = @{
        ProjectId = 'noted-segment-9xjsq'
        ServiceAccountPath = "$PSScriptRoot\..\service-account-key.json"
    }

    # PocketBase Config
    PocketBase = @{
        Url = $env:POCKETBASE_URL ?? 'http://localhost:8090'
        AdminEmail = $env:PB_ADMIN_EMAIL ?? 'admin@bejodigitalprint.com'
        AdminPassword = $env:PB_ADMIN_PASSWORD ?? 'admin123'
    }

    # Collections to migrate (urutan penting untuk relasi)
    Collections = @(
        # Level 1: Independent
        @{ Name = 'product_categories'; PbCollection = 'product_categories'; Transform = 'Transform-Category' },
        @{ Name = 'customer_categories'; PbCollection = 'customer_categories'; Transform = 'Transform-Category' },
        @{ Name = 'suppliers'; PbCollection = 'suppliers'; Transform = 'Transform-Supplier' },
        @{ Name = 'agents'; PbCollection = 'agents'; Transform = 'Transform-Agent' },
        
        # Level 2: Depends on categories
        @{ Name = 'products'; PbCollection = 'products'; Transform = 'Transform-Product' },
        @{ Name = 'customers'; PbCollection = 'customers'; Transform = 'Transform-Customer' },
        
        # Level 3: Transactions
        @{ Name = 'transactions'; PbCollection = 'transactions'; Transform = 'Transform-Transaction' },
        @{ Name = 'stock_transactions'; PbCollection = 'stock_transactions'; Transform = 'Transform-StockTransaction' },
        
        # Settings & Config (Singletons)
        @{ Name = 'settings'; PbCollection = 'settings'; Transform = 'Transform-Settings'; IsSingleton = $true },
        @{ Name = 'store_profiles'; PbCollection = 'store_profiles'; Transform = 'Transform-StoreProfile' },
        
        # Transactions & Inventory
        @{ Name = 'transactions'; PbCollection = 'transactions'; Transform = 'Transform-Transaction' },
        @{ Name = 'stock_transactions'; PbCollection = 'stock_transactions'; Transform = 'Transform-StockTransaction' },
        @{ Name = 'shifts'; PbCollection = 'shifts'; Transform = 'Transform-Shift' },
        @{ Name = 'cashiers'; PbCollection = 'cashiers'; Transform = 'Transform-Cashier' },
        
        # Users & Roles
        @{ Name = 'users'; PbCollection = 'users'; Transform = 'Transform-User' },
        @{ Name = 'agents'; PbCollection = 'agents'; Transform = 'Transform-Agent' },
        @{ Name = 'suppliers'; PbCollection = 'suppliers'; Transform = 'Transform-Supplier' },
        
        # Inventory & Production
        @{ Name = 'stock_transactions'; PbCollection = 'stock_transactions'; Transform = 'Transform-StockTransaction' },
        @{ Name = 'machines'; PbCollection = 'machines'; Transform = 'Transform-Machine' },
        @{ Name = 'spk_orders'; PbCollection = 'spk_orders', Transform = 'Transform-SpkOrder' },
        
        # Invoices & Finance
        @{ Name = 'invoices'; PbCollection = 'invoices', Transform = 'Transform-Invoice' },
        @{ Name = 'invoice_settings', PbCollection = 'invoice_settings', IsSingleton = $true },
        
        # Tax
        @{ Name = 'taxpayer_profile'; PbCollection = 'taxpayer_profile', IsSingleton = $true },
        @{ Name = 'tax_annual_returns', PbCollection = 'tax_annual_returns', Transform = 'Transform-TaxReturn' },
        @{ Name = 'tax_monthly_billings', PbCollection = 'tax_monthly_billings', Transform = 'Transform-TaxBilling' },
        
        # Agents & Notifications
        @{ Name = 'agents'; PbCollection = 'agents', Transform = 'Transform-Agent' },
        @{ Name = 'agent_notifications', PbCollection = 'agent_notifications' },
        @{ Name = 'user_mentions', PbCollection = 'user_mentions' },
        @{ Name = 'private_chat_messages', PbCollection = 'private_chat_messages' },
        @{ Name = 'ai_chat_messages', PbCollection = 'ai_chat_messages' },
        
        # Printing & Tax
        @{ Name = 'printing_rejects'; PbCollection = 'printing_rejects'; Transform = 'Transform-PrintingReject' },
        @{ Name = 'taxpayer_profile'; PbCollection = 'taxpayer_profile'; IsSingleton = $true },
        @{ Name = 'tax_annual_returns'; PbCollection = 'tax_annual_returns', Transform = 'Transform-TaxReturn' },
        @{ Name = 'tax_monthly_billings', PbCollection = 'tax_monthly_billings', Transform = 'Transform-TaxBilling' },
        
        # Settings & Config (singletons)
        @{ Name = 'settings'; PbCollection = 'settings'; IsSingleton = $true },
        @{ Name = 'store_profiles'; PbCollection = 'store_profiles' },
        @{ Name = 'custom_roles'; PbCollection = 'custom_roles' },
        @{ Name = 'invoice_settings'; PbCollection = 'invoice_settings', IsSingleton = $true },
        
        # Print & Rejects
        @{ Name = 'printing_rejects'; PbCollection = 'printing_rejects', Transform = 'Transform-PrintingReject' },
    ]

    # Transform Functions
    Transforms = @{
        base = {
            param($doc)
            $data = @{}
            foreach ($key in $doc.Data.Keys) {
                $value = $doc[$_]
                # Convert Firestore Timestamp
                if ($value -is [Google.Cloud.Firestore.V1.Timestamp]) {
                    $value = $value.ToDateTime().ToString("o")
                } elseif ($value -is [Google.Cloud.Firestore.DocumentReference]) {
                    $value = $value.Id
                }
                $result[$key] = $value
            }
            return @{ id = $doc.Id; data = $result }
        }
    }
}

# Transform Functions
function Transform-Product {
    param($doc)
    $base = Transform-Base $doc
    $base.data.category = $doc.Data.category?.Id ?? $doc.Data.category
    $base.data.supplier = $doc.Data.supplier?.Id ?? $doc.Data.supplier
    $base.data.price = [double]($doc.Data.price ?? 0)
    $base.data.cost = [double]($doc.Data.cost ?? 0)
    $base.data.stock = [int]($doc.Data.stock ?? 0)
    $base.data.minStock = [int]($doc.Data.minStock ?? 0)
    return $base
}

function Transform-Customer {
    param($doc)
    $base = Transform-Base $doc
    $base.data.category = $doc.Data.category?.Id ?? $doc.Data.category
    $base.data.creditLimit = [double]($doc.Data.creditLimit ?? 0)
    $base.data.totalDebt = [double]($doc.Data.totalDebt ?? 0)
    return $base
}

function Transform-Transaction {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.cashier = $doc.Data.cashier?.Id ?? $doc.Data.cashier
    $base.data.total = [double]($doc.Data.total ?? 0)
    $base.data.paid = [double]($doc.Data.paid ?? 0)
    $base.data.change = [double]($doc.Data.change ?? 0)
    $base.data.paymentMethod = $doc.Data.paymentMethod ?? 'cash'
    if ($doc.Data.items) {
        $base.data.items = $doc.Data.items | ForEach-Object {
            @{
                product = $_.product?.Id ?? $_.product
                name = $_.name
                price = [double]($_.price ?? 0)
                qty = [int]($_.qty ?? 0)
                subtotal = [double]($_.subtotal ?? 0)
            }
        }
    }
    return $base
}

function Transform-StockTransaction {
    param($doc)
    $base = Transform-Base $doc
    $base.data.product = $doc.Data.product?.Id ?? $doc.Data.product
    $base.data.quantity = [int]($doc.Data.quantity ?? 0)
    $base.data.type = $doc.Data.type ?? 'in'
    $base.data.reason = $doc.Data.reason ?? ''
    return $base
}

function Transform-Category {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.description = $doc.Data.description ?? ''
    return $base
}

function Transform-Supplier {
    param($doc)
    $base = Transform-Base $doc
    $base.data.contactPerson = $doc.Data.contactPerson ?? ''
    $base.data.phone = $doc.Data.phone ?? ''
    $base.data.email = $doc.Data.email ?? ''
    $base.data.address = $doc.Data.address ?? ''
    return $base
}

function Transform-Agent {
    param($doc)
    $base = Transform-Base $doc
    $base.data.user = $doc.Data.user?.Id ?? $doc.Data.user
    $base.data.commissionRate = [double]($doc.Data.commissionRate ?? 0)
    $base.data.isActive = $doc.Data.isActive ?? $true
    return $base
}

function Transform-Transaction {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.cashier = $doc.Data.cashier?.Id ?? $doc.Data.cashier
    $base.data.total = [double]($doc.Data.total ?? 0)
    $base.data.paid = [double]($doc.Data.paid ?? 0)
    $base.data.change = [double]($doc.Data.change ?? 0)
    $base.data.paymentMethod = $doc.Data.paymentMethod ?? 'cash'
    if ($doc.Data.items) {
        $base.data.items = $doc.Data.items | ForEach-Object {
            @{
                product = $_.product?.Id ?? $_.product
                name = $_.name
                price = [double]($_.price ?? 0)
                qty = [int]($_.qty ?? 0)
                subtotal = [double]($_.subtotal ?? 0)
            }
        }
    }
    return $base
}

function Transform-StockTransaction {
    param($doc)
    $base = Transform-Base $doc
    $base.data.product = $doc.Data.product?.Id ?? $doc.Data.product
    $base.data.quantity = [int]($doc.Data.quantity ?? 0)
    $base.data.type = $doc.Data.type ?? 'in'
    $base.data.reason = $doc.Data.reason ?? ''
    return $base
}

function Transform-Shift {
    param($doc)
    $base = Transform-Base $doc
    $base.data.cashier = $doc.Data.cashier?.Id ?? $doc.Data.cashier
    $base.data.openingCash = [double]($doc.Data.openingCash ?? 0)
    $base.data.closingCash = [double]($doc.Data.closingCash ?? 0)
    $base.data.expectedCash = [double]($doc.Data.expectedCash ?? 0)
    $base.data.variance = [double]($doc.Data.variance ?? 0)
    return $base
}

function Transform-Cashier {
    param($doc)
    $base = Transform-Base $doc
    $base.data.user = $doc.Data.user?.Id ?? $doc.Data.user
    $base.data.shift = $doc.Data.shift?.Id ?? $doc.Data.shift
    $base.data.isActive = $doc.Data.isActive ?? $true
    return $base
}

function Transform-User {
    param($doc)
    $base = Transform-Base $doc
    $base.data.email = $doc.Data.email ?? ''
    $base.data.role = $doc.Data.role ?? 'kasir'
    $base.data.isActive = $doc.Data.isActive ?? $true
    return $base
}

function Transform-Agent {
    param($doc)
    $base = Transform-Base $doc
    $base.data.user = $doc.Data.user?.Id ?? $doc.Data.user
    $base.data.commissionRate = [double]($doc.Data.commissionRate ?? 0)
    $base.data.isActive = $doc.Data.isActive ?? $true
    return $base
}

function Transform-Supplier {
    param($doc)
    $base = Transform-Base $doc
    $base.data.contactPerson = $doc.Data.contactPerson ?? ''
    $base.data.phone = $doc.Data.phone ?? ''
    $base.data.email = $doc.Data.email ?? ''
    $base.data.address = $doc.Data.address ?? ''
    return $base
}

function Transform-Category {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.description = $doc.Data.description ?? ''
    return $base
}

function Transform-User {
    param($doc)
    $base = Transform-Base $doc
    $base.data.email = $doc.Data.email ?? ''
    $base.data.role = $doc.Data.role ?? 'kasir'
    $base.data.isActive = $doc.Data.isActive ?? $true
    return $base
}

function Transform-Agent {
    param($doc)
    $base = Transform-Base $doc
    $base.data.user = $doc.Data.user?.Id ?? $doc.Data.user
    $base.data.commissionRate = [double]($doc.Data.commissionRate ?? 0)
    $base.data.isActive = $doc.Data.isActive ?? $true
    return $base
}

function Transform-Supplier {
    param($doc)
    $base = Transform-Base $doc
    $base.data.contactPerson = $doc.Data.contactPerson ?? ''
    $base.data.phone = $doc.Data.phone ?? ''
    $base.data.email = $doc.Data.email ?? ''
    $base.data.address = $doc.Data.address ?? ''
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}

function Transform-Invoice {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.invoiceNumber = $doc.Data.invoiceNumber ?? ''
    $base.data.status = $doc.Data.status ?? 'draft'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.dueDate = $doc.Data.dueDate
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-SpkOrder {
    param($doc)
    $base = Transform-Base $doc
    $base.data.customer = $doc.Data.customer?.Id ?? $doc.Data.customer
    $base.data.status = $doc.Data.status ?? 'pending'
    $base.data.totalAmount = [double]($doc.Data.totalAmount ?? 0)
    $base.data.items = $doc.Data.items | ForEach-Object {
        @{
            product = $_.product?.Id ?? $_.product
            name = $_.name
            qty = [int]($_.qty ?? 0)
            price = [double]($_.price ?? 0)
        }
    }
    return $base
}

function Transform-Machine {
    param($doc)
    $base = Transform-Base $doc
    $base.data.name = $doc.Data.name ?? ''
    $base.data.status = $doc.Data.status ?? 'active'
    $base.data.lastMaintenance = $doc.Data.lastMaintenance ?? $null
    return $base
}