# SIM Demo Store (React + Vite + Supabase + Vercel)

## Setup

1. Install dependencies:
   npm install
2. Copy env:
   cp .env.example .env
3. Fill `.env`:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
   - VITE_PUBLIC_APP_URL (your Vercel URL)
4. In Supabase SQL Editor run:
   supabase/schema.sql
5. Deploy Edge Function for reviews:
   - Deploy function: `supabase functions deploy submit-review --no-verify-jwt`
6. Run app:
   npm run dev

## Routes

- `/` mobile storefront (desktop shows QR prompt)
- `/admin` admin panel with product CRUD

## Deploy to Vercel

1. Push repo to GitHub.
2. Import project in Vercel.
3. Add environment variables from `.env`.
4. Deploy.
