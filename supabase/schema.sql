-- Create products table
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  provider text not null,
  category text not null default 'eSIM',
  is_unlimited boolean not null default false,
  minutes integer not null default 0 check (minutes >= 0),
  sms integer not null default 0 check (sms >= 0),
  monthly_payment integer not null default 0 check (monthly_payment >= 0),
  badge text,
  data_gb integer not null check (data_gb >= 0),
  price integer not null check (price >= 0),
  old_price integer
);

alter table public.products add column if not exists is_unlimited boolean not null default false;
alter table public.products add column if not exists minutes integer not null default 0;
alter table public.products add column if not exists sms integer not null default 0;
alter table public.products add column if not exists monthly_payment integer not null default 0;
alter table public.products drop column if exists image_url;

alter table public.products enable row level security;

-- Public read access for storefront
drop policy if exists "Public can read products" on public.products;
create policy "Public can read products"
on public.products
for select
to anon
using (true);

-- Replace with authenticated admin logic in production
drop policy if exists "Authenticated can manage products" on public.products;
create policy "Authenticated can manage products"
on public.products
for all
to authenticated
using (true)
with check (true);

-- Store settings (single row) for shared storefront blocks like ad banner
create table if not exists public.store_settings (
  id integer primary key check (id = 1),
  ad_image_url text,
  ad_banners jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.store_settings (id, ad_image_url)
values (1, null)
on conflict (id) do nothing;

alter table public.store_settings add column if not exists ad_banners jsonb not null default '[]'::jsonb;

alter table public.store_settings enable row level security;

drop policy if exists "Public can read store settings" on public.store_settings;
create policy "Public can read store settings"
on public.store_settings
for select
to anon
using (true);

drop policy if exists "Authenticated can manage store settings" on public.store_settings;
create policy "Authenticated can manage store settings"
on public.store_settings
for all
to authenticated
using (true)
with check (true);

-- Ad image uploads bucket for admin panel
insert into storage.buckets (id, name, public)
values ('store-assets', 'store-assets', true)
on conflict (id) do nothing;

drop policy if exists "Public can view store assets" on storage.objects;
create policy "Public can view store assets"
on storage.objects
for select
to anon
using (bucket_id = 'store-assets');

drop policy if exists "Authenticated can upload store assets" on storage.objects;
create policy "Authenticated can upload store assets"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'store-assets');

drop policy if exists "Authenticated can update store assets" on storage.objects;
create policy "Authenticated can update store assets"
on storage.objects
for update
to authenticated
using (bucket_id = 'store-assets')
with check (bucket_id = 'store-assets');

drop table if exists public.reviews;

