# Pickup and Loading Sheets

This document describes the new pickup and loading sheet components that have been added to the Timberline logistics system.

## Components

### 1. PickupSheet Component
- **Location**: `components/truckloads/pickup-sheet.tsx`
- **Purpose**: Displays pickup information for a truckload
- **Features**:
  - Shows driver information and trip details
  - Displays pickup locations and destinations
  - Shows freight space, total space, count, and dimensions
  - Styled to match the design requirements

### 2. LoadingSheet Component
- **Location**: `components/truckloads/loading-sheet.tsx`
- **Purpose**: Displays loading information for a truckload
- **Features**:
  - Shows delivery information for loading
  - Displays pickup locations and destinations
  - Shows freight space, total space, count, and dimensions
  - Styled to match the design requirements

### 3. PickupLoadingSheets Component
- **Location**: `components/truckloads/pickup-loading-sheets.tsx`
- **Purpose**: Combined component that displays both pickup and loading sheets
- **Features**:
  - Fetches truckload data from API
  - Displays both pickup and loading sheets
  - Includes print functionality
  - Handles loading and error states

## Integration

The components are integrated into the existing truckload management system:

1. **Truckload Builder**: The components are available in the "Papers" tab of the truckload builder
2. **API Integration**: Uses existing `/api/truckloads/[id]` and `/api/truckloads/[id]/orders` endpoints
3. **Data Structure**: Works with the existing truckload and order data structures

## Usage

### In Truckload Builder
1. Navigate to a truckload in the truckload manager
2. Click on the truckload to open the truckload builder
3. Go to the "Papers" tab
4. Expand either "Pickup List" or "Loading Sheet" sections
5. The components will display the relevant information

### Standalone Usage
```tsx
import { PickupLoadingSheets } from "@/components/truckloads/pickup-loading-sheets"

function MyComponent() {
  return <PickupLoadingSheets truckloadId={123} />
}
```

## Styling

The components are styled to match the design requirements:
- Clean, professional appearance
- Proper color coding (red for pickups, blue for deliveries)
- Responsive table layout
- Print-friendly styling
- Consistent with existing UI components

## Data Requirements

The components expect the following data structure:

### Truckload Data
- `id`: Truckload ID
- `driverName`: Driver's full name
- `startDate`: Trip start date
- `endDate`: Trip end date
- `trailerNumber`: Trailer number
- `description`: Trip description

### Order Data
- `assignment_type`: 'pickup' or 'delivery'
- `pickup_customer`: Customer information for pickup
- `delivery_customer`: Customer information for delivery
- `footage`: Total footage
- `skids`: Number of skids
- `vinyl`: Number of vinyl items
- Additional freight details

## Print Functionality

The components include print functionality:
- Print button triggers browser print dialog
- Print styles are optimized for paper output
- Maintains formatting and colors in print view

## Future Enhancements

Potential improvements for the components:
1. Export to PDF functionality
2. Customizable column layouts
3. Additional freight details
4. Integration with routing systems
5. Real-time updates

