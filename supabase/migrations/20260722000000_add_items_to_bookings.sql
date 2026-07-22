-- Migration: Add items jsonb column to public.bookings table
alter table public.bookings add column if not exists items jsonb default '[]'::jsonb;
