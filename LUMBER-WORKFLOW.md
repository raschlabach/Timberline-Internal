# Lumber Tracker - Complete Load Workflow

## Load Lifecycle Stages

### 1️⃣ **CREATE LOAD** (`/dashboard/lumber/create`)
**Purpose:** Create new lumber loads

**Requirements to Create:**
- Supplier selected
- At least one item with:
  - Load ID (auto-assigned)
  - Species
  - Grade
  - Thickness

**What Happens:**
- Load(s) created in `lumber_loads` table
- Items created in `lumber_load_items` table
- `po_generated = FALSE`
- `actual_arrival_date = NULL`
- `all_packs_tallied = FALSE`
- `all_packs_finished = FALSE`

---

### 2️⃣ **PO PAGE** (`/dashboard/lumber/po`)
**Purpose:** Generate purchase orders for new loads

**Requirements to Appear:**
- `po_generated = FALSE` OR `po_generated IS NULL`

**Actions Available:**
- Generate PO (downloads PDF, marks as `po_generated = TRUE`)
- Mark as Sent (just marks `po_generated = TRUE` without download)

**What Happens:**
- When marked: `po_generated = TRUE`, `po_generated_at = NOW()`
- Load disappears from PO page
- Stays on Incoming page

---

### 3️⃣ **INCOMING LOADS** (`/dashboard/lumber/incoming`)
**Purpose:** Track loads that haven't arrived yet

**Requirements to Appear:**
- `actual_arrival_date IS NULL`
- `all_packs_finished = FALSE` (SHOULD BE ADDED)

**Actions Available:**
- Data Entry button → Enter actual footage, invoice details, paperwork
- Info button → Edit all load details

**What Happens:**
- Entering actual footage makes load appear on Tally Entry page
- Entering arrival date removes from Incoming, adds to Invoice page

---

### 4️⃣ **TRUCKING PAGE** (`/dashboard/lumber/trucking`)
**Purpose:** Assign drivers and pickup dates for loads being picked up

**Requirements to Appear:**
- `pickup_or_delivery = 'pickup'`
- `actual_arrival_date IS NULL`

**Actions Available:**
- Assign truck driver
- Set pickup date
- Add/view notes

---

### 5️⃣ **TALLY ENTRY** (`/dashboard/lumber/tally-entry`)
**Purpose:** Enter pack tallies after load arrives

**Requirements to Appear:**
- `actual_footage IS NOT NULL` (for at least one item)
- `all_packs_tallied = FALSE`
- `all_packs_finished = FALSE`

**Actions Available:**
- Enter pack tallies (Pack ID, Length, Board Feet)
- Tallies must sum to actual footage

**What Happens:**
- Creates records in `lumber_packs` table
- When complete: `all_packs_tallied = TRUE`
- Load appears on Rip Entry page

---

### 6️⃣ **RIP ENTRY** (`/dashboard/lumber/rip-entry`)
**Purpose:** Record ripping progress for each pack

**Requirements to Appear:**
- `all_packs_tallied = TRUE`
- `all_packs_finished = FALSE`

**Actions Available:**
- Enter rip data for each pack (actual footage, yield, quality)
- Mark packs as finished
- Assign operator and stackers

**What Happens:**
- Updates `lumber_packs` with rip data
- Marks packs as `is_finished = TRUE`
- When ALL packs finished: `all_packs_finished = TRUE`
- Load appears on Invoice page (if not already there)

---

### 7️⃣ **INVOICE PAGE** (`/dashboard/lumber/invoices`)
**Purpose:** Track QuickBooks entry and payment status

**Requirements to Appear:**
- `actual_arrival_date IS NOT NULL` OR `all_packs_finished = TRUE`
- `is_paid = FALSE`

**Actions Available:**
- Toggle QuickBooks entry
- Mark as paid

**What Happens:**
- When paid: `is_paid = TRUE`
- Load disappears from Invoice page
- Still visible in All Loads and Inventory (until finished)

---

### 8️⃣ **INVENTORY** (`/dashboard/lumber/inventory`)
**Purpose:** Show current inventory of unfinished loads

**Requirements to Appear:**
- `actual_footage IS NOT NULL` (has arrived)
- `all_packs_finished = FALSE`

**Calculation:**
- Current Inventory = Actual Footage - Finished Pack Tallies

**What Happens:**
- When `all_packs_finished = TRUE`, load removed from inventory

---

### 9️⃣ **ALL LOADS** (`/dashboard/lumber/all-loads`)
**Purpose:** Complete history of all loads

**Requirements to Appear:**
- ALL loads show here regardless of status

**Status Indicators:**
- 🟡 Incoming: `actual_arrival_date IS NULL`
- 🔵 Tally: Has arrival, needs tallies
- 🟣 Ripping: Tallied, not finished
- 🟠 Payment: Finished, not paid
- 🟢 Complete: `is_paid = TRUE`

---

## Key Database Fields

### `lumber_loads` table:
- `po_generated` - PO has been generated/sent
- `actual_arrival_date` - When load physically arrived
- `all_packs_tallied` - All pack tallies have been entered
- `all_packs_finished` - All packs have been ripped and finished
- `is_paid` - Invoice has been paid
- `entered_in_quickbooks` - Entered into accounting system

### Flow Flags:
```
Created → po_generated → Arrived → Tallied → Finished → Paid
  ✓           ✓            ✓         ✓         ✓        ✓
```

## Common Issues

1. **Load stuck on Incoming** - Missing `all_packs_finished` filter
2. **Can't find load for tally** - Missing `actual_footage` 
3. **Inventory too high** - Loads not marked as finished
4. **Load on wrong page** - Check the flags above

