# PRODUCT REQUIREMENTS DOCUMENT (PRD)

# Project Name
**Mookin — Smart Booking & Business Manager (Web App)**

Version: 2.0 (Web Edition)
Prepared for: AI coding agent implementation (e.g. Claude Code)

---

## 0. How to Use This Document (Read This First — Agent Instructions)

This PRD is written so a coding agent can build the product incrementally without needing clarification for basic decisions. Where a decision was not obvious, a default has been chosen and stated explicitly.

**Build order (recommended phases):**
1. Project scaffold + Supabase setup + Auth
2. Database schema (all tables below) + RLS policies
3. Dashboard shell + Bottom/Side navigation
4. Booking management (CRUD) + Custom Program system
5. Calendar view
6. Customer management
7. Inventory management
8. Expense manager
9. Invoice generation (PDF)
10. Reports + Export
11. Notifications (email/browser push)
12. Settings + Business profile
13. Polish: dark mode, animations, responsive check

Each phase should be a working, testable increment. Do not attempt all phases in one pass.

---

## 1. Project Overview

Mookin is a booking and business management **web application** for Indian small business owners in the event services space (DJ, tent house, caterers, decorators, garden/venue owners, sound & stage providers, event planners, etc.).

It replaces the earlier Flutter/Android version with a **responsive web app** (desktop + mobile browser) so owners can manage bookings, customers, expenses, inventory, invoices, and reports from any device with a browser.

Core qualities: fast, simple, cloud-synced, usable by non-technical users, clean premium UI.

---

## 2. Tech Stack (Decided)

| Layer | Choice |
|---|---|
| Frontend framework | **Next.js (React, App Router, TypeScript)** |
| Styling | Tailwind CSS |
| Backend / Auth / DB | **Supabase** (Auth, PostgreSQL, Storage, Realtime) |
| PDF generation | `@react-pdf/renderer` or `pdf-lib` (invoices, reports) |
| Charts (dashboard/reports) | Recharts |
| Notifications | Supabase scheduled functions / cron + email (Resend or Supabase SMTP) + browser push (optional) |
| Hosting | Vercel (frontend) + Supabase (backend) — agent should assume this unless told otherwise |
| State/data fetching | Supabase JS client + React Query (or SWR) |

**Dropped from original PRD (mobile-only, not applicable to web):**
- MPIN lock (mobile-only concept) → replaced with standard session-based web auth + optional "quick lock" using a PIN modal if the owner wants it on shared computers.
- Google AdMob → not applicable to a web app; omit entirely.
- FCM → replaced with web-compatible notification approach (email + in-app + optional web push).

---

## 3. Goals

- Fast booking creation and management
- Fast customer search
- Professional business management dashboard
- Cloud-synced data (multi-device, real-time)
- Visual calendar with conflict detection
- Business analytics & exportable reports
- Clean, premium, responsive UI (works well on mobile browser too, since many users will open it on their phone)

---

## 4. Authentication

**Methods**
- Email + Password
- Google OAuth (via Supabase Auth)

**Session & Security**
- Persistent session (auto-login until logout)
- Forgot Password flow (Supabase Auth reset email)
- Optional: 4-digit "Quick Lock" PIN — a soft lock screen shown after inactivity, stored per-user, NOT a replacement for real auth (real auth is the Supabase session). This is a UX convenience only.

**Data model**
```
profiles (
  id uuid references auth.users primary key,
  business_name text,
  business_logo_url text,
  business_address text,
  gst_number text,
  language text default 'en',
  theme text default 'system',
  quick_lock_pin text, -- hashed, optional
  created_at timestamptz default now()
)
```

---

## 5. Dashboard (route: `/dashboard`)

Widgets to display:
- Today's Bookings (list, count)
- Upcoming Bookings (next 7 days)
- Monthly Income
- Monthly Expenses
- Monthly Profit (Income − Expenses)
- Pending Amount (sum of unpaid remaining across bookings)
- Total Customers count
- Recent Bookings (last 5)
- Mini Calendar Preview (current month, clickable → full calendar)
- "Quick Add Booking" floating button (always visible)

All numbers computed from live Supabase queries (not cached long-term); use Supabase Realtime subscription so dashboard updates instantly when a booking/expense changes.

---

## 6. Booking Management

**Routes:** `/bookings`, `/bookings/[id]`, `/bookings/new`

**Functions:** Add, Edit, Delete (soft delete recommended — add `deleted_at` column), Duplicate, Search, Filter (by status, date range, program, customer).

**Booking Status enum:** `pending | confirmed | completed | cancelled`

**Data model**
```
bookings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users not null,
  customer_id uuid references customers,
  customer_name text not null,
  mobile_number text not null,
  program_id uuid references programs,
  program_name_snapshot text, -- in case program is later renamed/deleted
  event_date date not null,
  start_time time,
  end_time time,
  venue_address text,
  maps_link text,
  guest_count int,
  total_amount numeric(12,2) default 0,
  advance_amount numeric(12,2) default 0,
  remaining_amount numeric(12,2) generated always as (total_amount - advance_amount) stored,
  status text default 'pending' check (status in ('pending','confirmed','completed','cancelled')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
)
```

**Booking Form fields:** Customer Name, Mobile Number, Program Type (dropdown, sourced from `programs` table + inline "Add new program"), Event Date (date picker, DD/MM/YYYY display), Start Time, End Time (time picker, 12-hour with AM/PM), Venue/Address, Google Maps Link, Guest Count, Total Amount, Advance Amount, Remaining Amount (auto-calculated, read-only), Notes.

---

## 7. Custom Program System

Owner can create **unlimited custom programs/categories** (e.g. DJ, Tent, Catering, Decoration, Garden, Band, Crane, Photography, or any custom label). Every program automatically appears in the booking form dropdown.

**Data model**
```
programs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users not null,
  name text not null,
  icon text, -- optional emoji or icon key
  created_at timestamptz default now()
)
```
CRUD: Add Program, Edit Program, Delete Program (block delete or set `program_id` to null on related bookings if in use — agent should implement a soft warning: "This program is used in N bookings, delete anyway?").

---

## 8. Date & Time Format (India)

- Display format: `DD/MM/YYYY` (e.g. 16/07/2026)
- Time display: `HH:MM AM/PM` (e.g. 02:30 PM)
- Store dates/times in ISO format in Postgres (`date`, `time` types); format only at display layer.
- Use a date picker and time picker component consistent with this format across the whole app (booking form, filters, reports).

---

## 9. Smart Calendar (route: `/calendar`)

- Monthly grid view, Today highlighted
- Each day cell shows booking count + color-coded dots by status:
  - Pending = amber, Confirmed = blue, Completed = green, Cancelled = red
- **Booking Conflict Detection**: when adding/editing a booking, if another non-cancelled booking exists for the same date with overlapping start/end time (and optionally same program category if that matters for double-booking equipment), show a warning before save.
- Click a day → shows all bookings that day
- Click a booking → opens full booking detail modal/page

---

## 10. Customer Management (route: `/customers`, `/customers/[id]`)

**Data model**
```
customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users not null,
  name text not null,
  mobile_number text not null,
  notes text,
  created_at timestamptz default now()
)
```

**Customer profile page shows:**
- Basic info
- Full booking history (all bookings linked to this customer)
- Total business (sum of `total_amount` across all their bookings)
- Pending amount (sum of `remaining_amount` across unpaid bookings)
- Quick actions: **Call** (`tel:` link), **WhatsApp Chat** (`https://wa.me/<number>` link)

---

## 11. Inventory Management (route: `/inventory`)

Manage physical assets: DJ equipment, Tents, Generators, Lights, Decoration items, Vehicles.

**Data model**
```
inventory_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users not null,
  item_name text not null,
  category text,
  quantity int default 1,
  status text default 'available' check (status in ('available','in_use','maintenance','retired')),
  notes text,
  created_at timestamptz default now()
)
```

---

## 12. Expense Manager (route: `/expenses`)

**Categories:** Fuel, Maintenance, Purchase, Food, Travel, Other (owner can add custom categories — reuse same pattern as Custom Programs).

**Data model**
```
expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users not null,
  expense_name text not null,
  category text,
  amount numeric(12,2) not null,
  expense_date date not null,
  notes text,
  created_at timestamptz default now()
)
```

---

## 13. Invoice Generation

Generate a professional PDF invoice per booking.

**Invoice contents:** Business Logo, Business Name/Address/GST, Customer Name & Mobile, Program Name, Event Date, Total Amount, Advance Paid, Remaining Due, Signature area.

**Functions:**
- Generate PDF (client-side via `@react-pdf/renderer`, downloadable)
- Print (browser print dialog on the generated PDF/HTML view)
- WhatsApp Share (generate PDF, then use `https://wa.me/<number>?text=` with a link to the hosted PDF in Supabase Storage, since WhatsApp Web can't attach files via URL scheme directly — store invoice PDF in Supabase Storage and share the link)

---

## 14. Reports (route: `/reports`)

**Report types:** Daily, Weekly, Monthly, Yearly, Income, Expense, Profit, Customer.

**Export formats:** PDF, Excel (`xlsx` via `sheetjs`/`xlsx` package).

All reports are derived from `bookings` and `expenses` tables filtered by date range; agent should build one reusable date-range query layer rather than separate logic per report type.

---

## 15. Notifications

Since this is a web app (no native push by default), implement via:
- **In-app notification center** (bell icon, list of upcoming reminders) — always works
- **Email reminders** (via Supabase scheduled Edge Function + Resend/SMTP) for:
  - Booking Reminder
  - Upcoming Event Reminder
  - Pending Amount Reminder
- Reminder lead time options: 1 day before, 3 days before, 7 days before (configurable in Settings)
- Optional stretch: Web Push notifications (Service Worker) if the owner installs the app as a PWA

---

## 16. Search

Global search bar (accessible from any page) searching across: Customer Name, Mobile Number, Program, Date, Location, Booking Status. Implement via a single Postgres function or Supabase `ilike` queries across joined tables; debounce input (300ms).

---

## 17. Cloud / Backend (Supabase)

- **Auth**: Email/Password + Google OAuth
- **Database**: PostgreSQL, with **Row Level Security (RLS) enabled on every table**, policy: `owner_id = auth.uid()` for all reads/writes. This is critical since it's a multi-tenant web app — every business owner must only see their own data.
- **Storage**: buckets for `logos/`, `invoices/`, `customer-attachments/` (if needed later)
- **Realtime**: subscribe to `bookings`, `expenses` tables for live dashboard updates
- **Backup**: rely on Supabase's automatic backups (Pro plan) or add a manual "Export all data" button in Settings as a fallback

---

## 18. Settings (route: `/settings`)

- Business Name, Logo, Address, GST (optional)
- Language (start with English + Hindi toggle; structure strings for i18n from day one)
- Dark Mode / Theme
- Change Password (replaces "Change MPIN" from mobile PRD)
- Quick Lock PIN (optional, see Section 4)
- Logout
- Export Data (manual backup fallback)

---

## 19. UI Design

- Style: Premium, modern, glassmorphism accents, rounded cards, gradient buttons, smooth transitions (Framer Motion optional)
- Fully responsive: desktop (sidebar nav) and mobile browser (bottom nav, matching original app's mobile-first feel)
- Support Dark Mode as first-class, not an afterthought
- Design tokens: use Tailwind config for consistent spacing/colors/radius across the app

---

## 20. Navigation

**Desktop:** Left sidebar — Dashboard, Bookings, Calendar, Customers, Inventory, Expenses, Reports, Settings

**Mobile (< 768px):** Bottom navigation — Dashboard, Bookings, Calendar, Customers, More (Inventory/Expenses/Reports/Settings tucked into a "More" sheet)

---

## 21. Out of Scope for Version 1 (Future Features)

- Multi-user roles / staff accounts
- Online payment collection (Razorpay/UPI integration)
- Separate customer-facing app/portal
- Separate staff app
- WhatsApp Business API automation (beyond simple `wa.me` share links)
- AI booking assistant / voice booking
- QR-based inventory scanning
- Multi-business support under one login

---

## 22. Non-Functional Requirements / Success Criteria

- Create a booking in under 30 seconds (form should be short, smart defaults, minimal required fields)
- Customer search returns results in under 2 seconds
- Calendar reflects new/edited bookings instantly (Realtime)
- PDF invoice generates in under 10 seconds
- Data syncs correctly across multiple devices/tabs (test by opening two browser tabs)
- All tables have RLS — verify no owner can ever query another owner's data
- App is usable one-handed on a phone browser (primary usage context for many target users)

---

## 23. Suggested Folder Structure (Next.js App Router)

```
/app
  /(auth)/login
  /(auth)/signup
  /(dashboard)/dashboard
  /(dashboard)/bookings
  /(dashboard)/bookings/[id]
  /(dashboard)/bookings/new
  /(dashboard)/calendar
  /(dashboard)/customers
  /(dashboard)/customers/[id]
  /(dashboard)/inventory
  /(dashboard)/expenses
  /(dashboard)/reports
  /(dashboard)/settings
/components
  /ui (buttons, cards, inputs — shared design system)
  /bookings
  /calendar
  /customers
  /invoice
/lib
  /supabase (client, server, types)
  /utils (date formatting, currency formatting)
```

---

## 24. Notes for the Building Agent

- Build and verify one phase at a time (see Section 0); don't try to scaffold every table and every page in a single pass.
- Generate Supabase migrations as SQL files under `/supabase/migrations` so schema changes are tracked.
- Write RLS policies alongside every table creation — never leave a table open by default.
- Reuse one shared date/time formatting utility everywhere (DD/MM/YYYY, 12-hour AM/PM) instead of formatting inline per component.
- Ask the business owner (end user) for their actual currency symbol assumption — default to ₹ (INR) throughout since this is an India-focused product.
