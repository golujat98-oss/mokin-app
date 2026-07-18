# Performance Optimization Plan for Smart Booking Pro

This plan details our proposed optimizations to speed up page loads, reduce CPU usage, minimize re-renders, and optimize Supabase database queries for Smart Booking Pro.

## User Review Required

> [!IMPORTANT]
> - All queries will select only the necessary columns instead of `*`.
> - Independent Supabase queries will be parallelized using `Promise.all` to eliminate waterfall delays.
> - The scheduler conflict checks, which currently execute database queries on every date/time keystroke, will run entirely client-side using already-fetched state.
> - The heavy `xlsx` library will be dynamically imported on-demand when the user clicks the export actions, reducing initial bundle sizes significantly.
> - Complex loops, date filters, and aggregations (such as chart datasets and statistics counters) will be optimized and memoized using React `useMemo` to prevent massive lag during search/input keystrokes.

## Proposed Changes

---

### Dashboard Page

#### [MODIFY] [dashboard/page.tsx](file:///C:/Users/MUSiC%20MAN/Desktop/MOKIN-APP/app/(dashboard)/dashboard/page.tsx)
- Optimize `fetchDashboardData` to load:
  - Bookings (selecting only `id, customer_name, mobile_number, event_date, status, total_amount, advance_amount, remaining_amount, program_name_snapshot`).
  - Expenses (selecting only `id, amount, expense_date` starting 6 months ago).
- Use `Promise.all` to execute the user check, bookings fetch, and expenses fetch in parallel.
- Eliminate redundant queries (`chartBookings` and `chartExpenses`) by filtering the already-fetched bookings and expenses in memory.

---

### Bookings Manager

#### [MODIFY] [bookings/page.tsx](file:///C:/Users/MUSiC%20MAN/Desktop/MOKIN-APP/app/(dashboard)/bookings/page.tsx)
- Optimize the `fetchData` function to run Supabase calls in parallel using `Promise.all` and select only the required fields.
- Optimize the `checkConflicts` function: run conflict-checking logic completely client-side by filtering and checking the already-fetched `bookings` array in memory. This eliminates a network round-trip on every character typed or selected in the event scheduler forms.
- Dynamically import the heavy `xlsx` package inside `handleExportExcel` instead of statically importing it at the top of the file, reducing JavaScript bundle size.

---

### Calendar Scheduler

#### [MODIFY] [calendar/page.tsx](file:///C:/Users/MUSiC%20MAN/Desktop/MOKIN-APP/app/(dashboard)/calendar/page.tsx)
- Select only the necessary columns (`id, customer_name, mobile_number, event_date, start_time, end_time, venue_address, program_name_snapshot, status, remaining_amount`) from Supabase bookings.
- Precompute date mappings (`bookingsByDate` and `overlapsByDate`) using `useMemo` when bookings change, reducing the cell rendering complexity from $O(N \cdot M)$ on every render to a direct lookup.

---

### Customers Catalog

#### [MODIFY] [customers/page.tsx](file:///C:/Users/MUSiC%20MAN/Desktop/MOKIN-APP/app/(dashboard)/customers/page.tsx)
- Select only the necessary columns (`id, name, mobile_number, notes`) from Supabase customers.
- Parallelize the customer catalog fetch and the bookings fetch using `Promise.all`.
- Use a `useMemo` map `upcomingBookingsMap` to lookup and precompute the closest upcoming booking for each customer. This avoids running filters and sorts across all bookings for every single card on every keystroke of the search bar.

---

### Expenses Ledger

#### [MODIFY] [expenses/page.tsx](file:///C:/Users/MUSiC%20MAN/Desktop/MOKIN-APP/app/(dashboard)/expenses/page.tsx)
- Select only the necessary columns (`id, description, category, amount, expense_date, created_at`) from Supabase expenses.
- Wrap the calculations for `totalMonthlyOutflow`, `wagesOutflow`, `dieselOutflow`, and `maintenanceOutflow` in a single `useMemo` block to process them in a single array loop instead of 4 separate filter/reduce sweeps on every render.

---

### Services Catalog & Config Settings

#### [MODIFY] [programs/page.tsx](file:///C:/Users/MUSiC%20MAN/Desktop/MOKIN-APP/app/(dashboard)/programs/page.tsx)
- Select only the necessary columns (`id, name, icon, created_at`) from Supabase programs.

#### [MODIFY] [settings/page.tsx](file:///C:/Users/MUSiC%20MAN/Desktop/MOKIN-APP/app/(dashboard)/settings/page.tsx)
- Keep selective column retrieval and ensure standard clean React patterns.

---

### Financial & Booking Reports

#### [MODIFY] [reports/page.tsx](file:///C:/Users/MUSiC%20MAN/Desktop/MOKIN-APP/app/(dashboard)/reports/page.tsx)
- Select only the necessary columns from Supabase bookings.
- Consolidate monthly and yearly stats calculation logic in two `useMemo` hooks mapping over bookings, preventing redundant filters and reduces on every page render.
- Wrap Recharts data aggregation in `useMemo` so it recalculates only when relevant yearly booking data changes.
- Dynamically import the heavy `xlsx` package inside `handleExportExcel` to reduce bundle sizes.

---

## Verification Plan

### Automated Tests
- Run `npm run lint` to check for any static styling or typescript issues.
- Run `npm run build` to verify the codebase compiles and bundles cleanly with Turbopack.

### Manual Verification
- Verify database requests in the Network tab to ensure:
  1. Column selections are minimal.
  2. Queries are parallelized (no waterfall chains).
  3. No query triggers when changing input values in the scheduler forms.
