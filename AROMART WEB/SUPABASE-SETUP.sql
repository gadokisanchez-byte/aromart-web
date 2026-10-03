-- AROMART SHOP · ejecutar UNA VEZ en Supabase > SQL Editor
-- Catálogo público; escrituras solo para usuarios autenticados del Admin.

create table if not exists public.products (
  id text primary key,
  name text not null,
  sku text,
  category text not null default 'Perfumes',
  description text not null default '',
  image_url text not null default '',
  price numeric(10,2) not null default 0 check (price >= 0),
  cost numeric(10,2) not null default 0 check (cost >= 0),
  stock integer not null default 0 check (stock >= 0),
  status text not null default 'disponible' check (status in ('disponible','agotado','proximamente')),
  is_custom boolean not null default false,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.coupons (
  id bigint generated always as identity primary key,
  code text not null unique,
  percent numeric(5,2) not null check (percent > 0 and percent <= 100),
  min_qty integer not null default 1 check (min_qty >= 1),
  starts_on date,
  ends_on date,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create table if not exists public.notices (
  id bigint generated always as identity primary key,
  title text not null default '',
  message text not null default '',
  starts_on date,
  ends_on date,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create table if not exists public.sales (
  id bigint generated always as identity primary key,
  product_id text references public.products(id) on delete set null,
  product_name text not null,
  qty integer not null check(qty > 0),
  unit_price numeric(10,2) not null default 0,
  unit_cost numeric(10,2) not null default 0,
  sold_on date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.coupons enable row level security;
alter table public.notices enable row level security;
alter table public.sales enable row level security;

drop policy if exists "public read products" on public.products;
create policy "public read products" on public.products for select to anon, authenticated using (true);
drop policy if exists "admin write products" on public.products;
create policy "admin write products" on public.products for all to authenticated using (true) with check (true);

drop policy if exists "public read coupons" on public.coupons;
create policy "public read coupons" on public.coupons for select to anon, authenticated using (true);
drop policy if exists "admin write coupons" on public.coupons;
create policy "admin write coupons" on public.coupons for all to authenticated using (true) with check (true);

drop policy if exists "public read notices" on public.notices;
create policy "public read notices" on public.notices for select to anon, authenticated using (true);
drop policy if exists "admin write notices" on public.notices;
create policy "admin write notices" on public.notices for all to authenticated using (true) with check (true);

drop policy if exists "admin read sales" on public.sales;
create policy "admin read sales" on public.sales for select to authenticated using (true);
drop policy if exists "admin write sales" on public.sales;
create policy "admin write sales" on public.sales for all to authenticated using (true) with check (true);

-- Storage para fotos agregadas desde Admin
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true;

drop policy if exists "public product images" on storage.objects;
create policy "public product images" on storage.objects for select to public using (bucket_id='product-images');
drop policy if exists "admin upload product images" on storage.objects;
create policy "admin upload product images" on storage.objects for insert to authenticated with check (bucket_id='product-images');
drop policy if exists "admin update product images" on storage.objects;
create policy "admin update product images" on storage.objects for update to authenticated using (bucket_id='product-images') with check (bucket_id='product-images');
drop policy if exists "admin delete product images" on storage.objects;
create policy "admin delete product images" on storage.objects for delete to authenticated using (bucket_id='product-images');
