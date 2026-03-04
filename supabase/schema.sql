-- Create products table
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  provider text not null,
  category text not null default 'eSIM',
  image_url text,
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

alter table public.products enable row level security;

-- Public read access for storefront
create policy "Public can read products"
on public.products
for select
to anon
using (true);

-- Replace with authenticated admin logic in production
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.store_settings (id, ad_image_url)
values (1, null)
on conflict (id) do nothing;

alter table public.store_settings enable row level security;

create policy "Public can read store settings"
on public.store_settings
for select
to anon
using (true);

create policy "Authenticated can manage store settings"
on public.store_settings
for all
to authenticated
using (true)
with check (true);

-- Optional demo data
insert into public.products (title, provider, category, image_url, badge, is_unlimited, data_gb, minutes, sms, monthly_payment, price, old_price)
values
('Europe eSIM 20GB', 'Airalo', 'Travel', 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80', 'new', false, 20, 600, 100, 1599, 1599, 2199),
('Russia Local 30GB', 'MegaFon', 'Local', 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80', 'bestseller', false, 30, 900, 300, 1299, 1299, 1799),
('Unlimited 7 days', 'Tinkoff Mobile', 'Unlimited', 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=800&q=80', 'hot', true, 0, 500, 100, 999, 999, 1499)
on conflict do nothing;

-- Ad image uploads bucket for admin panel
insert into storage.buckets (id, name, public)
values ('store-assets', 'store-assets', true)
on conflict (id) do nothing;

create policy "Public can view store assets"
on storage.objects
for select
to anon
using (bucket_id = 'store-assets');

create policy "Authenticated can upload store assets"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'store-assets');

create policy "Authenticated can update store assets"
on storage.objects
for update
to authenticated
using (bucket_id = 'store-assets')
with check (bucket_id = 'store-assets');

