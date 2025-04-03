# 🚚 Timberline Logistics Dashboard

A comprehensive logistics management system for Timberline Trucking, enabling efficient management of orders, customers, truckloads, and route planning.

## Overview

This dashboard provides a complete solution for Dispatchers, Admins, and Truck Drivers to manage logistics operations including:

- Customer management
- Order entry and tracking
- Load board and assignment
- Truckload building and optimization
- Route planning
- Driver portal

## Tech Stack

- **Frontend**: TypeScript, React, Next.js App Router, Tailwind CSS, Shadcn UI, Radix UI
- **Backend**: Node.js, TypeScript, Next.js App Router
- **Database**: PostgreSQL (Neon.tech)
  - `main`: Production database
  - `preview`: Testing/staging database

## Setup Instructions

### Prerequisites

- Node.js (v18+ recommended)
- PostgreSQL client (`psql`)
- Neon.tech database account

### Database Setup

1. Navigate to the database directory: `cd database`
2. Copy the example config: `cp config.example.js config.js`
3. Edit `config.js` with your Neon.tech credentials
4. Apply the schema to the preview branch: `node apply-schema.js preview`

See the [database README](database/README.md) for more details.

### Development Environment

1. Install dependencies: `npm install`
2. Start the development server: `npm run dev`
3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Core Features

### 📍 Customer Center
- Customer management with address autocomplete using Google Places API
- Notes for special instructions
- Quote tracking

### 📍 Order Entry
- Customer lookups from database
- Various load type filters
- Freight type entry (skids, vinyl, footage)
- Quote and scheduling management

### 📍 Load Board
- Display of unassigned/partially assigned loads
- Status indicators for Rush, Attention, Comments
- Assignment functionality
- Kanban view by pickup date

### 📍 Truckload Management
- Driver assignment
- Truckload creation and tracking
- Progress visualization

### 📍 Truckload Builder
- Visual load arrangement on 8×53 trailer grid
- Route planning with auto-optimization
- Printable truckload papers

### 📍 Driver Portal
- Secure access for drivers
- View assigned truckloads
- Access to paperwork
- Customer information access

## Development Guidelines

- Use TypeScript interfaces for all component props and API responses
- Maintain consistent styling with Shadcn UI components
- Use red for pickups and black for deliveries throughout the UI
- Follow the directory structure outlined in project documentation
- Ensure all database operations use the correct branch (preview vs main) 

Prioritize simplicity and minimalism in changes.

- Only change what's necessary to address the task or fix.
- Avoid rewriting entire code blocks; aim to refine existing implementations.
- Do not duplicate functions; always check existing functionality before creating new code.
- Prompt clearly for clarification if unsure about instructions or implementation.
