# Lumber Tracker System

A comprehensive lumber inventory and ripping tracking system integrated into the Timberline Internal dashboard.

## Overview

The Lumber Tracker is a complete, separate system within the Timberline platform that manages:
- Lumber load creation and tracking
- Purchase order generation
- Trucking dispatch and scheduling
- Invoice management and QuickBooks tracking
- Pack tallying and rip entry
- Inventory management
- Bonus calculations for operators and stackers

## System Architecture

### Database Structure

**11 Main Tables:**
1. `lumber_suppliers` - Supplier information
2. `lumber_supplier_locations` - Multiple locations per supplier
3. `lumber_drivers` - Driver roster for trucking
4. `lumber_loads` - Main load tracking (estimated + actual fields)
5. `lumber_load_items` - Line items for each species/grade/thickness combination
6. `lumber_load_documents` - PDF and paperwork storage
7. `lumber_packs` - Individual packs with tally and rip data
8. `lumber_work_sessions` - Daily time tracking for operators
9. `lumber_bonus_parameters` - Configurable bonus tiers
10. `lumber_trucking_notes` - Dispatcher notes

**5 Views:**
- `lumber_inventory_view` - Real-time inventory calculation
- `lumber_loads_needing_pos` - Loads requiring PO generation
- `lumber_incoming_loads` - Created but not arrived
- `lumber_loads_for_invoice` - Arrived but not paid
- `lumber_loads_needing_tallies` - Need pack tally entry
- `lumber_loads_for_rip_entry` - Ready for ripping

## Workflow

### 1. Create Load
**Page:** `/dashboard/lumber/create`

- Enter Load ID (e.g., R-4276)
- Select supplier and location
- Add multiple species/grade/thickness combinations
- Enter estimated footage and prices
- Set lumber type (dried/green) and pickup/delivery
- Add comments and estimated delivery date

**API:** `POST /api/lumber/loads`

### 2. Purchase Order
**Page:** `/dashboard/lumber/po`

- Lists all loads needing POs
- Click "Generate PO" to create and download
- Automatically marks PO as generated

**API:** `POST /api/lumber/po/generate`

### 3. Incoming Loads
**Page:** `/dashboard/lumber/incoming`

- Lists all created loads that haven't arrived
- Shows supplier, species/grades, estimated footage
- **Data Entry button:** Enter actual arrival data
- **Info button:** Edit all load fields

### 4. Trucking Dispatch
**Page:** `/dashboard/lumber/trucking`

- Lists pickup loads without drivers assigned
- Assign driver and pickup date
- Add/manage dispatcher notes
- View supplier location and contact info

**APIs:**
- `GET /api/lumber/loads/for-trucking`
- `PATCH /api/lumber/loads/[id]/assign-driver`
- `POST /api/lumber/trucking/notes`

### 5. Invoice Management
**Page:** `/dashboard/lumber/invoices`

- Lists arrived loads pending payment
- View attached paperwork (PDFs)
- Toggle QuickBooks entry status
- Mark as paid (removes from list)

**API:** `PATCH /api/lumber/loads/[id]/invoice-status`

### 6. Tally Entry
**Page:** `/dashboard/lumber/tally-entry`

**Fast Excel-like input:**
- Navigate with Tab and Enter keys
- Enter Pack ID, Length, and Board Feet
- Auto-adds new rows at end
- Must total to actual footage before saving
- Creates packs in database

**Features:**
- Real-time total calculation
- Visual feedback when totals match
- Keyboard-optimized for speed

**API:** `POST /api/lumber/packs/create-tallies`

### 7. Rip Entry (Tablet-Friendly)
**Page:** `/dashboard/lumber/rip-entry`

**Compact design for tablet use:**
- Left: Searchable load list
- Right: Pack editing interface
- Select operator and stackers (1-4)
- Enter load quality (0-100)
- Edit each pack: actual BF, rip yield, comments
- Click "Finish Pack" when complete
- Shows remaining BF by length

**Features:**
- Auto-saves on blur
- Shows finished packs in green
- Real-time inventory calculation
- Board feet remaining by length display

**APIs:**
- `GET /api/lumber/packs/by-load/[loadId]`
- `PATCH /api/lumber/packs/[packId]/rip-data`
- `PATCH /api/lumber/packs/[packId]/finish`

### 8. Inventory
**Page:** `/dashboard/lumber/inventory`

**Current Inventory:**
- Grouped by thickness, species, grade
- Shows total actual footage, finished footage, and remaining inventory
- Inventory = Actual - Finished packs

**Monthly Ripped:**
- Select month/year
- Shows total ripped footage
- Breakdown by species and thickness

**50 Most Recent Packs:**
- Shows all finished pack details
- Operator, stackers, yield, dates

**APIs:**
- `GET /api/lumber/inventory` (uses view)
- `GET /api/lumber/inventory/monthly`
- `GET /api/lumber/packs/recent`

### 9. Ripped Packs
**Page:** `/dashboard/lumber/ripped-packs`

- Search and filter all finished packs
- Date range filters
- Summary statistics
- Full pack details with operators/stackers

**API:** `GET /api/lumber/packs/finished`

### 10. Rip Bonus
**Page:** `/dashboard/lumber/rip-bonus`

**Complex bonus calculation system:**
- Select month/year
- Daily summaries showing:
  - Hours worked
  - Board feet ripped
  - BF per hour
  - Bonus rate (from parameters)
  - Bonus total
  - Operator/stacker breakdowns with percentages

**Bonus Calculation:**
1. Get BF per hour for the day
2. Match to bonus parameter tier
3. Calculate total day bonus
4. Distribute by percentage of BF contributed
5. Contributors share pack credit equally

**Bonus Parameters:**
- Configurable tiers in database
- Default ranges from 750-10,000 BF
- Bonuses from $0.40 to $2.20

**API:** `GET /api/lumber/rip-bonus/report`

### 11. All Loads
**Page:** `/dashboard/lumber/all-loads`

- Complete load history
- Search by any field
- Status badges (Incoming, Needs Tally, In Progress, Pending Payment, Complete)

## Key Features

### Multiple Species/Grades per Load
Each load can have multiple line items with different:
- Species (Ash, Maple, Oak, etc.)
- Grades (Fas/Uppers, 1 com, 2 com, etc.)
- Thicknesses (4/4, 5/4, 6/4, 7/4, 8/4)
- Estimated and actual footages
- Prices

### Excel-like Tally Entry
- Fast keyboard navigation (Tab, Enter)
- Auto-expands rows
- Real-time validation
- Prevents mismatches

### Tablet-Optimized Rip Entry
- Compact, two-column layout
- Touch-friendly buttons
- Small fonts and tight spacing
- Side-by-side pack info and rip data

### Automatic Inventory Tracking
- Real-time calculation via database view
- Formula: `Actual Footage - Finished Pack Tallies`
- No manual inventory adjustments needed

### Comprehensive Bonus System
- Tiered bonus structure
- Automatic percentage calculations
- Equal credit sharing among operators/stackers
- Monthly and daily reports

## Database Migration

**To apply the database schema:**

```bash
# Using the existing migration system
node database/apply-migration.js database/migrations/add-lumber-tracker-system.sql
```

**Or manually:**

```bash
psql [your-connection-string] -f database/migrations/add-lumber-tracker-system.sql
```

## API Endpoints

### Loads
- `GET /api/lumber/loads` - All loads
- `POST /api/lumber/loads` - Create load
- `GET /api/lumber/loads/incoming` - Incoming loads
- `GET /api/lumber/loads/po-needed` - Needs POs
- `GET /api/lumber/loads/for-trucking` - Pickup loads
- `GET /api/lumber/loads/for-invoice` - Invoice management
- `GET /api/lumber/loads/needs-tally` - Needs tally entry
- `GET /api/lumber/loads/for-rip` - Ready for ripping
- `PATCH /api/lumber/loads/[id]/assign-driver` - Assign driver
- `PATCH /api/lumber/loads/[id]/invoice-status` - Update invoice
- `PATCH /api/lumber/loads/[id]/quality` - Update quality

### Packs
- `POST /api/lumber/packs/create-tallies` - Create pack tallies
- `GET /api/lumber/packs/by-load/[loadId]` - Get load packs
- `PATCH /api/lumber/packs/[packId]/rip-data` - Update rip data
- `PATCH /api/lumber/packs/[packId]/finish` - Mark finished
- `GET /api/lumber/packs/recent` - Recent ripped
- `GET /api/lumber/packs/finished` - All finished (with filters)

### Supporting
- `GET /api/lumber/suppliers` - All suppliers with locations
- `POST /api/lumber/suppliers` - Create supplier
- `GET /api/lumber/drivers` - All drivers
- `POST /api/lumber/drivers` - Create driver
- `GET /api/lumber/trucking/notes` - Trucking notes
- `POST /api/lumber/trucking/notes` - Create note
- `DELETE /api/lumber/trucking/notes/[id]` - Delete note
- `GET /api/lumber/inventory` - Current inventory
- `GET /api/lumber/inventory/monthly` - Monthly ripped
- `GET /api/lumber/bonus-parameters` - Bonus tiers
- `GET /api/lumber/rip-bonus/report` - Monthly bonus report
- `GET /api/users` - All users (for operator/stacker selection)

## Navigation

The Lumber Tracker appears in the sidebar under a "Lumber Tracker" section:
- Incoming Loads (main landing page)
  - Create Load
  - PO Page
  - Trucking
  - Invoice Page
  - All Loads
  - Inventory
  - Tally Entry
  - Rip Entry
  - Ripped Packs
  - Rip Bonus

## Still TODO

### 1. PDF Generation for POs
Currently generates text files. Need to implement actual PDF generation using:
- `pdfkit` or `puppeteer`
- Company logo and branding
- Professional PO layout

### 2. Data Entry Page
Create a dedicated page for entering actual arrival data:
- Actual footage per item
- Invoice number, total, date
- Arrival date
- Attach paperwork (PDF upload)

Currently this is accessed via button on Incoming Loads page.

### 3. Supplier Management Page
Admin page for:
- Add/edit/deactivate suppliers
- Manage multiple locations per supplier
- Phone numbers and addresses

### 4. Work Session Entry
Page for operators to enter daily start/end times:
- Simple date picker
- Time inputs
- Used for bonus calculations

### 5. Document Upload
Implement file upload for load paperwork:
- Store in `public/uploads/lumber/` or cloud storage
- Link in `lumber_load_documents` table
- Display in Invoice page

## Testing

1. **Run the migration** to create all tables
2. **Create a test supplier** (via database or API)
3. **Create a test load** via the Create Load form
4. **Generate a PO** (text file for now)
5. **Enter arrival data** with actual footages
6. **Create pack tallies** using fast keyboard entry
7. **Select load in Rip Entry** and enter rip data
8. **View inventory** to see calculations
9. **Check Rip Bonus** page for reports

## Notes

- **Completely separate from trucking system** - no shared data
- **Uses existing authentication** - same users table
- **Follows existing patterns** - Shadcn UI, Next.js 13 app router
- **Production-ready architecture** - Views, triggers, proper indexes
- **Optimized for tablet** - Rip Entry page designed for shop floor use
- **Fast data entry** - Tally Entry uses Excel-like keyboard navigation

## Support

For questions or issues, refer to:
- Database schema: `database/migrations/add-lumber-tracker-system.sql`
- TypeScript types: `types/lumber.ts`
- Page components: `app/dashboard/lumber/*`
- API routes: `app/api/lumber/*`
