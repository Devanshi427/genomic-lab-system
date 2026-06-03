# AgriGenomics Lab Management System (LIMS)

A full-stack Laboratory Information Management System built for agricultural genomics labs that perform rice genotyping. The system tracks genotyping requests end-to-end — from breeder submission through DNA isolation, genotyping, and analysis — while managing reagent inventory across multiple labs, enforcing an approval queue, and surfacing analytics for management.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Features](#features)
4. [User Roles & Permissions](#user-roles--permissions)
5. [User Workflows](#user-workflows)
6. [Project Structure](#project-structure)
7. [Installation & Setup](#installation--setup)
8. [Running the Application](#running-the-application)
9. [Database Schema Overview](#database-schema-overview)
10. [API Documentation](#api-documentation)
11. [Configuration](#configuration)
12. [Deployment (Railway)](#deployment-railway)
13. [Troubleshooting](#troubleshooting)
14. [Future Improvements](#future-improvements)
15. [Assumptions & Missing Information](#assumptions--missing-information)

---

## Project Overview

### Business Purpose

Two agricultural genomics labs were operating with no shared inventory visibility, causing reagent waste and duplicate purchase orders. This system was built to:

- Give plant breeders a single portal to submit and track SNP/SSR genotyping requests.
- Route those requests through an admin approval queue before lab processing begins.
- Track multi-phase lab progress (DNA Isolation → Genotyping → Analysis → Completed).
- Provide inventory managers with real-time stock levels, consumption tracking, low-stock alerts, and inter-lab transfers across both labs.
- Give management a live analytics dashboard and downloadable monthly PDF reports.

### Key Features at a Glance

- **Request lifecycle management** with six workflow phases and email notifications at each transition.
- **Approval queue** with priority ordering (High / Normal / Low), partial approvals, capacity tracking per service type, and bulk approve/reject.
- **Inventory management** with reagent consumption clusters, inter-lab transfers, usage logs, and stock forecasting.
- **Role-based access control** across five user roles.
- **Real-time toast notifications** via Socket.io.
- **Analytics dashboard** with pipeline flow, SLA performance, crop-wise charts, and SNP/SSR butterfly charts.
- **Monthly PDF reports** with executive summary, SLA metrics, analysis-type breakdowns, and reagent consumption tables.
- **Excel import/export** for bulk loading historical requests and inventory data.
- **Automatic archival** of completed requests after 90 days (nightly cron).
- **Database backup and restore** from the admin panel.

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (Pages Router) |
| **Runtime** | Node.js with custom `server.ts` entry point |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS v4 |
| **Database** | PostgreSQL (Neon for development, Railway for production) |
| **ORM** | Prisma 5 |
| **Authentication** | NextAuth.js v4 — JWT strategy, credentials provider |
| **Real-time** | Socket.io v4 (server + client) |
| **PDF generation** | PDFKit |
| **Excel processing** | SheetJS (xlsx) |
| **Charts** | Chart.js v4 + react-chartjs-2 |
| **Email** | Nodemailer (SMTP) |
| **Scheduling** | node-cron |
| **Rate limiting** | lru-cache (in-process sliding-window) |
| **Icons** | lucide-react |
| **File uploads** | formidable |
| **Password hashing** | bcryptjs |
| **Archiving** | archiver |
| **Deployment** | Railway (chosen for persistent Socket.io connections) |

---

## Features

### Requests Module

- Breeders submit genotyping requests with fields mapped directly to the lab Excel format (Year, Season, Crop, Program, Nursery Name, Project Code, Analysis type, Trait/Gene, Markers/Sample, Marker Type, Predicted Samples, Tentative Sampling Date, Priority, Remarks).
- Auto-calculates Test Type (15-day vs. 30-day) and DOD (Date of Dispatch) from the chosen analysis type.
- Auto-calculates Predicted Data Points (Markers/Sample × Predicted Samples).
- Supports SNP, SSR, and BOTH marker types; for BOTH, enforces that SNP count + SSR count = Predicted Samples.
- Biotechnologists fill in lab-side fields (Actual Samples, Actual Data Points, Date of Sampling, Date of Dispatch, SNP/SSR actual counts).
- Full 29-column spreadsheet-style table view with sticky columns (Project Code, Analysis, Trait/Gene), filters for every major field, pagination, and bulk cancel/archive.
- Individual request detail page with phase timeline, Additional Details edit form, phase history table, and reagent usage log.
- Print-to-PDF per request.
- Automatic archival of COMPLETED requests after 90 days.

### Approval Queue

- Every new request enters `PENDING_APPROVAL` status.
- Admins can approve, reject, partially approve, or partially reject (with sample-level granularity).
- Priority ordering: High → Normal → Low, then FIFO within the same priority tier.
- Queue positions are recalculated automatically after each action.
- Bulk approve/reject up to 50 requests at a time.
- Weekly capacity tracking per service type (DNA Isolation, Genotyping) in samples/week.
- Breeders see their own requests and remaining capacity; Biotechnologists see only approved requests; Management sees read-only queue.
- Real-time Socket.io notifications to the submitting breeder on approval/rejection.

### Lab Phase Workflow

Six sequential phases: `SUBMITTED → RECEIVED → DNA_ISOLATION → GENOTYPING → ANALYSIS → COMPLETED`

- Biotechnologists and Admins advance phases.
- Phase advancement is blocked if the request has not been approved.
- Each phase transition auto-stamps the corresponding date field (e.g., advancing to `RECEIVED` stamps `dateOfSampling`) if not already set.
- `dodCommittedByLab` is auto-calculated on entry to `DNA_ISOLATION` if not already set.
- Email notification sent to the breeder on each phase transition.
- Phase history persisted with timestamp and optional notes.

### Inventory Management

- Dual-lab inventory (Lab 1, Lab 2) with Chemical/Consumable type distinction.
- Low-stock alerts using `lowStockThreshold ?? minThreshold` (same rule across table view, alert banners, and forecast).
- Expiry tracking with 30-day advance warning.
- Inter-lab transfer requests with approval flow.
- Reagent usage logging against a request or as a standalone deduction.
- Usage log export to CSV.

### Consumption Clusters

- Admins/Inventory Managers define named clusters (e.g., "DNA Extraction") that specify how much of each chemical is consumed per sample/reaction/plate.
- Technicians trigger bulk deductions by entering a project code and number of units.
- Pre-flight stock check prevents deductions that would over-draw any item.
- Deductions are linked to requests where possible; projectCode provides traceability otherwise.
- Clusters are drag-sort ordered via up/down reorder buttons.

### Inventory Forecast

- Inventory Managers select active requests and allocate predicted samples per consumption cluster.
- System calculates total forecasted chemical requirement (samples × qty-per-unit).
- Warns when the request list has been truncated (> 500 records).

### Dashboard & Analytics

Accessible to all roles (data scope varies by role):

- **KPI strip**: Total Requests, Actual Samples, Data Points, Delayed Requests.
- **Request pipeline flowchart**: live count per phase with dashed-arrow connectors.
- **SLA performance ring**: on-time vs. delayed delivery rate vs. previous month.
- **Crop analytics**: dual doughnut charts — Actual Samples and Actual Data Points by crop.
- **Analysis type volume**: horizontal bar chart showing samples per analysis category.
- **SNP vs. SSR butterfly chart**: side-by-side samples and data points.
- **Filters**: Year, Month, Crop with live reload.

### Monthly Reports

- HTML summary page with KPI cards, top-10 reagent consumption table, lab-by-lab performance, and by-phase breakdown.
- Downloadable multi-page PDF with executive summary, SLA bar, pipeline diagram, crop/analysis/marker-type breakdowns, full request appendix, and reagent consumption appendix.
- Analysis key maps normalise both space- and underscore-separated category names (e.g., `Purity Analysis` = `Purity_Analysis`).

### Admin Panel

- **User management**: create, update role, delete users. User activity audit trail.
- **Audit log**: filterable table of all system actions with action-type badges.
- **System health**: database counts, alert banners for pending transfers and unassigned requests, recent activity feed.
- **Database backups**: create gzip-compressed pg_dump backups, list, and restore (with DROP/CREATE database cycle). Backup files stored in `/backups`.
- **Data import**: Excel import for both requests (historical) and inventory items, with column detection, 5-row preview, warnings, and import results.

### Account Settings

- Any logged-in user can change their password (current + new + confirm, 8-character minimum).

---

## User Roles & Permissions

| Role | Key Capabilities |
|---|---|
| **BREEDER** | Submit requests, view own requests, view own approval queue status |
| **BIOTECHNOLOGIST** | View approved requests, advance phases, log reagent usage, view/deduct clusters |
| **INVENTORY_MANAGER** | Full inventory CRUD, transfers, import, clusters, forecast, logs, reports |
| **MANAGEMENT** | Read-only dashboard, requests list, approval queue, reports |
| **ADMIN** | Full access to everything including user management, approval actions, backups, system health |

Seed credentials (development / staging):

| Role | Email | Password |
|---|---|---|
| ADMIN | `admin@lab.com` | `password123` |
| BREEDER | `breeder1@lab.com` | `password123` |
| BIOTECHNOLOGIST | `biotechnologist1@lab.com` | `password123` |
| INVENTORY_MANAGER | `inv@lab.com` | `password123` |
| MANAGEMENT | `mgmt@lab.com` | `password123` |

> **Change all default passwords before any production use.**

---

## User Workflows

### End-to-End Request Lifecycle

```
Breeder submits request
        │
        ▼
PENDING_APPROVAL (approval queue, sorted by priority)
        │
   Admin reviews
   ┌────┴────┐
Approve    Reject / Partial
   │              │
   ▼              ▼
APPROVED       REJECTED / CANCELLED
   │
   ▼
SUBMITTED ──► RECEIVED ──► DNA_ISOLATION ──► GENOTYPING ──► ANALYSIS ──► COMPLETED
                                                                               │
                                                                     (after 90 days)
                                                                               │
                                                                           ARCHIVED
```

Each phase transition:
1. Stamps the corresponding date field (if not already set).
2. Writes a `PhaseHistory` record.
3. Fires a Socket.io notification to Inventory Managers and Biotechnologists.
4. Sends an email to the breeder.

### Approval Workflow Detail

1. Breeder submits request — system calculates initial queue position based on priority tier + FIFO within tier.
2. Admin visits `/approvals` — sees capacity utilisation for the current week.
3. Admin can change priority (updates both `priority` and `approvalPriority` columns).
4. Admin approves/rejects (full or partial, with optional reason).
5. Queue positions recalculate. Approved request becomes visible to Biotechnologists.
6. Breeder receives Socket.io toast notification and the approval status badge on their requests list updates.

### Inventory Consumption Flow

1. Inventory Manager defines a Consumption Cluster (e.g., "96-well PCR Setup" → Taq 0.5 µL, Buffer 2 µL, … per sample).
2. Biotechnologist triggers a deduction against a project code and number of samples.
3. System pre-checks all items for sufficient stock, then atomically decrements each item's quantity, creates `ReagentLog` entries, and writes a `ConsumptionDeduction` record.
4. Inventory Manager reviews usage logs, exports CSV if needed, and can forecast forward requirements.

---

## Project Structure

```
genomic-lab-system/
├── components/
│   ├── Layout.tsx              # Global navbar with role-based nav links, profile dropdown
│   ├── Skeleton.tsx            # TableSkeleton, CardSkeleton, ChartSkeleton loading states
│   └── ToastNotification.tsx   # Socket.io-driven toast system
│
├── lib/
│   ├── archival.ts             # archiveOldRequests() — called by cron in server.js
│   ├── audit.ts                # writeAudit() helper — wraps prisma.auditLog.create
│   ├── backup.ts               # createBackup(), listBackups(), restoreBackup() via pg_dump
│   ├── email.ts                # sendEmail(), sendPhaseEmail() via Nodemailer
│   ├── inventoryImportUtils.ts # Client-safe Excel parsing helpers (parseExcelRows, etc.)
│   ├── prisma.ts               # Singleton PrismaClient with global cache for hot-reload
│   ├── rateLimit.ts            # Sliding-window rate limiter using lru-cache
│   ├── useSocket.ts            # React hook for Socket.io client connection
│   └── withRateLimit.ts        # Next.js API route wrapper for rate limiting
│
├── pages/
│   ├── _app.tsx                # SessionProvider + Layout wrapper + global bg
│   ├── _document.tsx           # Google Fonts (DM Serif Display, DM Sans)
│   ├── index.tsx               # Root redirect based on role
│   ├── login.tsx               # Glassmorphism login page
│   │
│   ├── approvals/
│   │   └── index.tsx           # Approval queue with capacity cards, bulk actions, modals
│   │
│   ├── dashboard/
│   │   └── index.tsx           # Analytics dashboard (all charts, pipeline, SLA ring)
│   │
│   ├── inventory/
│   │   ├── index.tsx           # Main inventory table with inline edit
│   │   ├── new.tsx             # Add inventory item form (sticky footer)
│   │   ├── clusters.tsx        # Consumption cluster CRUD + deduction modal
│   │   ├── forecast.tsx        # Chemical requirement forecast wizard
│   │   ├── import.tsx          # Excel-based bulk import
│   │   ├── logs.tsx            # Reagent usage log with CSV export
│   │   ├── transfer.tsx        # Transfer approval page (legacy path)
│   │   └── transfers/
│   │       └── index.tsx       # Transfer approval page (canonical path)
│   │
│   ├── requests/
│   │   ├── index.tsx           # 29-column spreadsheet table with filters + bulk actions
│   │   ├── new.tsx             # New request form with derived field calculations
│   │   ├── [id].tsx            # Request detail: timeline, edit form, phase history, reagent logs
│   │   └── [id]/
│   │       └── print.tsx       # Print/PDF view of a single request
│   │
│   ├── reports/
│   │   └── monthly.tsx         # Monthly report HTML summary page
│   │
│   ├── account/
│   │   └── settings.tsx        # Change password
│   │
│   └── admin/
│       ├── audit.tsx           # Audit log viewer
│       ├── backup.tsx          # Database backup/restore
│       ├── health.tsx          # System health dashboard
│       ├── import.tsx          # Excel import (admin version with request + inventory)
│       ├── users.tsx           # User management
│       └── user-activity/
│           └── [userId].tsx    # Per-user audit trail
│
├── pages/api/
│   ├── socket.ts               # Socket.io initialisation endpoint (fallback path)
│   ├── auth/[...nextauth].ts   # NextAuth credentials provider + JWT callbacks
│   ├── account/password.ts     # Change password endpoint
│   ├── admin/
│   │   ├── audit.ts            # GET audit logs with action/date filters
│   │   ├── backup.ts           # GET list / POST create+restore
│   │   ├── health.ts           # GET system health snapshot
│   │   ├── user-activity.ts    # GET paginated per-user audit trail
│   │   └── users/
│   │       ├── index.ts        # GET list / POST create user
│   │       └── [id].ts         # PATCH role / DELETE user
│   ├── approvals/
│   │   ├── capacity.ts         # GET capacity data / PATCH update capacity
│   │   ├── index.ts            # GET queue / POST bulk approve-reject
│   │   └── [id].ts             # PATCH single approval action (approve/reject/partial/priority)
│   ├── dashboard/
│   │   ├── crops.ts            # GET distinct crop values for filter dropdown
│   │   ├── export.ts           # GET Excel export (requests or reagent summary)
│   │   ├── lab-comparison.ts   # GET per-lab reagent usage comparison
│   │   ├── stats.ts            # GET all dashboard KPIs and chart data
│   │   ├── timeline.ts         # GET 12-month submitted/completed timeline
│   │   └── years.ts            # GET distinct year values for filter dropdown
│   ├── experiments/
│   │   ├── index.ts            # GET experiments list
│   │   └── [id]/items.ts       # GET items for an experiment
│   ├── import/excel.ts         # POST multipart Excel import (requests + inventory)
│   ├── inventory/
│   │   ├── alerts.ts           # GET low-stock + expiry alerts
│   │   ├── forecast.ts         # GET per-item usage forecast
│   │   ├── import.ts           # POST JSON-based inventory import
│   │   ├── index.ts            # GET all items / POST create / PATCH update
│   │   ├── log.ts              # POST log reagent usage
│   │   ├── transfer.ts         # POST create transfer / PUT approve transfer
│   │   ├── transfers/index.ts  # GET pending transfers
│   │   ├── logs/
│   │   │   ├── index.ts        # GET usage logs with cluster enrichment
│   │   │   └── export.ts       # GET CSV export of logs
│   │   └── clusters/
│   │       ├── index.ts        # GET all / POST create / PATCH reorder
│   │       ├── [id].ts         # GET one / PUT update / DELETE
│   │       └── deduct.ts       # POST perform cluster deduction
│   ├── labs/index.ts           # GET labs list
│   ├── reports/
│   │   ├── monthly.ts          # GET monthly summary data (JSON)
│   │   └── monthly-pdf.ts      # GET multi-page PDF report
│   └── requests/
│       ├── bulk.ts             # POST bulk cancel/archive
│       ├── index.ts            # GET paginated list / POST create request
│       ├── [id].ts             # GET detail / PATCH update additional fields
│       └── [id]/phase.ts       # PUT advance phase
│
├── prisma/
│   ├── schema.prisma           # Full data model (14 models)
│   ├── seed.ts                 # Seeds 2 labs + 5 role users
│   ├── clear.ts                # Truncates all tables and resets sequences
│   └── migrations/             # Incremental SQL migration files
│
├── scripts/
│   ├── fix-approval-status.js  # One-time backfill: approves all pre-system requests
│   └── fix-requests.ts         # One-time backfill: populates markerType + data points
│
├── styles/
│   └── globals.css             # Tailwind import, table styles, glass utilities, dark mode
│
├── types/
│   └── next-auth.d.ts          # Extends Session/JWT types with id and role
│
├── server.js                   # Custom HTTP server: Next.js + Socket.io + node-cron
├── package.json
├── tsconfig.json
└── .env                        # Local environment variables (not committed)
```

---

## Installation & Setup

### Prerequisites

- Node.js 20+
- npm 9+
- PostgreSQL 14+ (local) — or a Neon / Railway connection string
- `pg_dump` / `psql` available in PATH (only required for the backup/restore feature)

### 1. Clone the repository

```bash
git clone <repository-url>
cd genomic-lab-system
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create environment file

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"

# NextAuth
NEXTAUTH_SECRET="a-random-32-char-secret-string"
NEXTAUTH_URL="http://localhost:3000"

# Email (optional — phase notifications will silently fail if omitted)
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your@email.com"
SMTP_PASS="your-smtp-password"
SMTP_FROM="noreply@your-domain.com"

# Server port (optional, defaults to 3000)
PORT="3000"
```

### 4. Run database migrations

```bash
npx prisma migrate dev
```

This applies all migrations in `prisma/migrations/` and generates the Prisma client.

### 5. Seed the database

```bash
npx prisma db seed
```

Creates two labs (Lab 1, Lab 2) and five users (one per role) all with password `password123`.

### 6. Generate Prisma client (if needed independently)

```bash
npx prisma generate
```

### One-time backfill scripts (only needed when importing historical data)

If you have imported historical requests before the approval system existed, run:

```bash
node scripts/fix-approval-status.js
```

If you need to backfill marker type and data point figures from an Excel reference sheet, edit and run:

```bash
npx tsx scripts/fix-requests.ts
```

---

## Running the Application

### Development mode

```bash
npm run dev
```

Starts the custom `server.js` (which wraps Next.js + Socket.io). In development, it also auto-launches the app in Microsoft Edge. The app is available at `http://localhost:3000`.

> **Important**: always use `npm run dev` (not `next dev`), as the custom server is required for Socket.io to function.

### Production mode

```bash
npm run build
npm start
```

`npm start` runs `cross-env NODE_ENV=production node server.js`.

### Useful Prisma commands

| Command | Purpose |
|---|---|
| `npx prisma migrate dev --name <name>` | Create and apply a new migration |
| `npx prisma migrate deploy` | Apply pending migrations (production) |
| `npx prisma studio` | Open the Prisma database browser |
| `npx prisma db push` | Push schema without creating a migration file |
| `npx tsx --env-file=.env prisma/clear.ts` | Truncate all tables and reset ID sequences |

---

## Database Schema Overview

### Core Models

**Lab**
Represents a physical genomics laboratory. Two labs are seeded. Inventory items and users are scoped to a lab.

**User**
Authenticated user with one of five roles. Optionally linked to a lab. Holds bcrypt-hashed password.

**Request**
Central entity. Contains all fields from the lab Excel template including:
- Sample metadata (sampleName, crop, season, year, program, projectCode, analysisToBeDone, traitGene)
- Marker data (markerType, markersPerSample, snpCount, ssrCount, predictedSamples, predictedDataPoints, actualSamples, actualDataPoints)
- Phase fields (currentPhase, status, all date stamps)
- Approval queue fields (approvalStatus, approvalPriority, approvedById, approvedSamples, rejectedSamples, queuePosition, totalSamples)
- Archival (archived, archivedAt)

**PhaseHistory**
Append-only log of each phase transition for a request. Records phase name, notes, and timestamp.

**InventoryItem**
A chemical or consumable tracked per lab with quantity, unit, min threshold, expiry date, and optional low-stock threshold override.

**ReagentLog**
Usage event: links an InventoryItem to a User, optional Request, quantity used, and purpose string.

**InventoryTransfer**
Transfer request between labs. Tracks fromItem, toItem, quantity, status (PENDING/COMPLETED), and approver.

**ConsumptionCluster**
Named recipe template. Belongs to an optional Experiment. Has a unit basis (sample/reaction/plate).

**ConsumptionClusterItem**
Join table: links an InventoryItem to a ConsumptionCluster with a `qtyPerUnit` float.

**ConsumptionDeduction**
Audit record of a cluster deduction: units consumed, project code, optional requestId, timestamp.

**AuditLog**
System-wide action log. Stores action type, entity type/ID, detail string, and the performing user.

**CapacityTracking**
Weekly capacity per service type (DNA_ISOLATION, GENOTYPING) in samples/week. Unique index on (weekStart, serviceType).

**Experiment / ExperimentItem**
Optional grouping for inventory items; clusters can be linked to an experiment.

### Key Relationships

```
Lab ──< InventoryItem ──< ReagentLog >── Request ──< PhaseHistory
                                            │
                         ConsumptionCluster >── ConsumptionDeduction
                                 │
                   ConsumptionClusterItem >── InventoryItem

User ──< Request (submittedBy)
User ──< Request (approvedBy)
User ──< AuditLog
User ──< ReagentLog
```

### Business Rules Enforced in the Database / API

- `requestCode` is unique (format: `REQ-{timestamp}-{random}` for new; `IMP-{batchId}-R{n}` for imports).
- Requests require approval (`approvalStatus = 'APPROVED'`) before phase advancement is allowed.
- Phase advancement is blocked if `status = 'COMPLETED'`.
- Cluster deductions pre-check stock before executing the atomic transaction.
- Inter-lab transfers pre-check source stock at the time of approval, not creation.
- `CapacityTracking` rows are auto-seeded from the most recent week's capacity when a new week starts.

---

## API Documentation

All endpoints require a valid NextAuth session cookie except `/api/auth/*`. Role enforcement is performed inside each handler.

### Authentication

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/signin` | NextAuth credentials sign-in |
| GET | `/api/auth/session` | Get current session |
| POST | `/api/auth/signout` | Sign out |

### Requests

| Method | Path | Description |
|---|---|---|
| GET | `/api/requests` | Paginated request list with role-scoped filtering |
| POST | `/api/requests` | Create new request (BREEDER, ADMIN) |
| GET | `/api/requests/:id` | Full request detail with phase history and reagent logs |
| PATCH | `/api/requests/:id` | Update additional fields (actualSamples, dates, markerType, etc.) |
| PUT | `/api/requests/:id/phase` | Advance to next phase (BIOTECHNOLOGIST, ADMIN) |
| POST | `/api/requests/bulk` | Bulk cancel or archive (BIOTECHNOLOGIST, ADMIN) |

### Approvals

| Method | Path | Description |
|---|---|---|
| GET | `/api/approvals` | Paginated approval queue |
| POST | `/api/approvals` | Bulk approve or reject |
| PATCH | `/api/approvals/:id` | Single action: approve, reject, partial_approve, partial_reject, change_priority |
| GET | `/api/approvals/capacity` | Weekly capacity data |
| PATCH | `/api/approvals/capacity` | Update weekly capacity (ADMIN) |

### Inventory

| Method | Path | Description |
|---|---|---|
| GET | `/api/inventory` | All inventory items with isLow / isExpiringSoon flags |
| POST | `/api/inventory` | Create item (INVENTORY_MANAGER, ADMIN) |
| PATCH | `/api/inventory` | Update item (INVENTORY_MANAGER, ADMIN) |
| GET | `/api/inventory/alerts` | Low-stock and expiry alerts |
| POST | `/api/inventory/log` | Log reagent usage (BIOTECHNOLOGIST, ADMIN) |
| GET | `/api/inventory/logs` | Usage logs with cluster enrichment |
| GET | `/api/inventory/logs/export` | CSV export of logs |
| POST | `/api/inventory/transfer` | Create transfer request |
| PUT | `/api/inventory/transfer` | Approve transfer (INVENTORY_MANAGER, ADMIN) |
| GET | `/api/inventory/transfers` | Pending transfers (INVENTORY_MANAGER, ADMIN) |
| GET | `/api/inventory/forecast` | Per-item stock forecast based on 30-day usage |
| POST | `/api/inventory/import` | JSON-based bulk import |
| GET | `/api/inventory/clusters` | All clusters |
| POST | `/api/inventory/clusters` | Create cluster |
| PATCH | `/api/inventory/clusters` | Reorder clusters (sortOrder) |
| GET | `/api/inventory/clusters/:id` | Single cluster with deduction history |
| PUT | `/api/inventory/clusters/:id` | Update cluster |
| DELETE | `/api/inventory/clusters/:id` | Delete cluster |
| POST | `/api/inventory/clusters/deduct` | Perform cluster deduction |

### Dashboard

| Method | Path | Description |
|---|---|---|
| GET | `/api/dashboard/stats` | All KPIs and chart data (filterable by year/month/crop) |
| GET | `/api/dashboard/timeline` | 12-month submitted/completed timeline |
| GET | `/api/dashboard/crops` | Distinct crop values |
| GET | `/api/dashboard/years` | Distinct year values |
| GET | `/api/dashboard/lab-comparison` | Per-lab reagent usage comparison |
| GET | `/api/dashboard/export` | Excel export (requests or reagent-summary) |

### Reports

| Method | Path | Description |
|---|---|---|
| GET | `/api/reports/monthly` | Monthly summary JSON |
| GET | `/api/reports/monthly-pdf` | Streamed multi-page PDF |

### Admin

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/audit` | Audit log (filterable) |
| GET | `/api/admin/health` | System health snapshot |
| GET | `/api/admin/backup` | List backups |
| POST | `/api/admin/backup` | Create or restore backup |
| GET | `/api/admin/users` | List users |
| POST | `/api/admin/users` | Create user |
| PATCH | `/api/admin/users/:id` | Change role |
| DELETE | `/api/admin/users/:id` | Delete user |
| GET | `/api/admin/user-activity` | Paginated per-user audit trail |
| POST | `/api/import/excel` | Multipart form Excel import (requests or inventory) |

### Other

| Method | Path | Description |
|---|---|---|
| GET | `/api/labs` | Lab list (all authenticated users) |
| GET | `/api/experiments` | Experiment list |
| GET | `/api/experiments/:id/items` | Items for an experiment |
| POST | `/api/account/password` | Change own password |
| GET/POST | `/api/socket` | Socket.io initialisation (fallback when not using custom server) |

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | ✅ | Random secret for JWT signing (min 32 chars) |
| `NEXTAUTH_URL` | ✅ | Full public URL of the app (e.g., `https://your-app.up.railway.app`) |
| `SMTP_HOST` | Optional | SMTP server hostname |
| `SMTP_PORT` | Optional | SMTP port (default: 587) |
| `SMTP_SECURE` | Optional | `"true"` for port 465, `"false"` otherwise |
| `SMTP_USER` | Optional | SMTP authentication username |
| `SMTP_PASS` | Optional | SMTP authentication password |
| `SMTP_FROM` | Optional | From address (falls back to `SMTP_USER`) |
| `PORT` | Optional | HTTP server port (default: 3000) |

### Socket.io CORS

The Socket.io server in `server.js` allows connections from `process.env.NEXTAUTH_URL`. In production, ensure this matches your deployment URL exactly.

### Nightly Archival Cron

The cron schedule `'0 3 * * *'` runs at 03:00 AM server time and archives all COMPLETED requests older than 90 days. This runs inside `server.js` and is always active when the server is running.

### Rate Limiting

Login endpoint is rate-limited to 10 requests/minute per IP. All other API routes default to 60 requests/minute. Limits are in-process (not distributed) — they reset on server restart.

---

## Deployment (Railway)

Railway is the recommended deployment target because it provides persistent connections needed for Socket.io (unlike serverless platforms).

### Steps

1. Push the repository to GitHub.
2. Create a new Railway project and connect the GitHub repo.
3. Add a PostgreSQL service in Railway and note the connection string.
4. Set all environment variables in the Railway service settings.
5. Set the start command: `npm start` (Railway detects `package.json` automatically).
6. Run migrations from your local machine against the Railway database:

```bash
DATABASE_URL="<railway-postgres-url>" npx prisma migrate deploy
DATABASE_URL="<railway-postgres-url>" npx prisma db seed
```

7. Deploy. The live app will be available at the Railway-generated URL.

**Known deployment considerations:**

- `NEXTAUTH_URL` must be set to the exact Railway URL (including `https://`), otherwise sign-in redirects fail.
- `cross-env` must be in `dependencies` (not `devDependencies`) for `npm start` to work on Railway.
- The `sortOrder` column on `ConsumptionCluster` must exist before seeding — ensure all migrations have run.

---

## Troubleshooting

### `Cannot find module '@prisma/client'`

```bash
npx prisma generate
```

### Changes to `schema.prisma` not reflected

```bash
npx prisma migrate dev --name describe_your_change
```

### Socket.io notifications not arriving

- Ensure you are running the app with `node server.js` (via `npm run dev` or `npm start`), not `next dev`.
- Check that `NEXTAUTH_URL` in `.env` matches the origin the browser connects from.

### `NEXTAUTH_URL` mismatch / sign-in loops

Set `NEXTAUTH_URL` to the exact URL used in the browser (including port for local development, full HTTPS URL for production).

### Login fails with valid credentials

Verify that `bcryptjs` is installed and that the user was created via the seed script or the admin Users page (both hash the password). Plaintext passwords in the database will not work.

### `pg_dump: command not found`

The backup/restore feature requires `pg_dump` and `psql` to be installed and in the system `PATH`. Install PostgreSQL client tools. On Railway, this feature is only usable if the deployment image includes PostgreSQL client tools.

### `archivedAt` column missing

Run all pending migrations:

```bash
npx prisma migrate deploy
```

### Approval queue shows 0 items after Excel import

Run the fix script to backfill `approvalStatus = 'APPROVED'` on all pre-system requests:

```bash
node scripts/fix-approval-status.js
```

### `TypeError: Cannot read properties of undefined (reading 'id')` in phase.ts

The request's `approvalStatus` is not `APPROVED`. Approve the request via the Approvals queue before advancing phases.

---

## Future Improvements

Based on the current architecture, the following enhancements would integrate naturally:

- **Distributed rate limiting** — replace the in-process LRU cache with Redis for multi-instance deployments.
- **Background job queue** — move email sending and PDF generation off the request thread using a queue (e.g., BullMQ + Redis).
- **Lab assignment workflow** — the schema has `assignedLabId` on Request but no UI to assign a request to a specific lab; this could be surfaced in the approval or phase screens.
- **SNP/SSR count validation on import** — the Excel importer does not currently validate that snpCount + ssrCount = actualSamples for BOTH marker type rows.
- **Notification preferences** — currently all notifications go to role-level rooms; per-user opt-in/opt-out would reduce noise.
- **Dark mode toggle** — the Layout includes a theme toggle menu item but the `action: 'theme'` handler is not implemented.
- **Mobile-responsive tables** — the 29-column requests table uses fixed pixel widths and is not mobile-friendly.
- **Experiment management UI** — the `Experiment` and `ExperimentItem` models exist in the schema and are used in clusters, but there is no UI to create or manage experiments directly.
- **Audit log for inventory deductions** — ConsumptionDeductions currently do not generate AuditLog entries; adding them would give a complete ledger.
- **Pagination on usage logs** — the logs API returns a maximum of 200 entries; adding cursor-based pagination would support high-volume labs.
- **Automated backup scheduling** — the `lib/backup.ts` code mentions "daily backups run at 02:00 AM" in the UI, but no cron for backup creation is wired into `server.js`; only archival runs on schedule.

---

## Assumptions & Missing Information

The following could not be definitively determined from the codebase alone:

- **`bg-leaf2.png`** — the login page background image is referenced as `/public/bg-leaf2.png` but is not included in the provided code. The login page will show a broken background without it.
- **Backup scheduling** — the admin backup page describes daily automated backups, but no corresponding cron job exists in `server.js`. Backups are only created manually via the UI.
- **`Experiment` creation** — no UI page exists for creating Experiments. It is unclear how Experiment records are seeded in production; the seed script does not create any.
- **Lab assignment to requests** — the `assignedLabId` field on Request is present in the schema and referenced in several queries, but no UI flow exists to assign a request to a specific lab after approval.
- **SMTP provider** — the email configuration supports any SMTP-compatible provider. No specific provider is hardcoded.
- **Production backup storage** — backup files are written to a local `/backups` directory. On ephemeral deployments (like Railway), these will be lost on redeploy. An external storage target (S3, GCS) would be needed for durable backups.
- **`pg_dump` availability on Railway** — the backup feature requires PostgreSQL client tools in the server environment. Whether the Railway deployment image includes these tools could not be confirmed from the code.
- **Multi-instance deployments** — Socket.io is attached to the single custom HTTP server. The current architecture does not support horizontal scaling without an adapter (e.g., `@socket.io/redis-adapter`).