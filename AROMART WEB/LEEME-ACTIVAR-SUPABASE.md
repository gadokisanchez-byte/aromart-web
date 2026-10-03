# AromArt Shop — activación de la nube

La web ya está preparada para Supabase.

## Una sola vez antes de usar el Admin
1. Entra al proyecto Supabase que ya usa el login de AromArt.
2. Abre **SQL Editor** > **New query**.
3. Copia TODO el archivo `SUPABASE-SETUP.sql`, pégalo y pulsa **Run**.
4. Sube esta carpeta a GitHub. Vercel desplegará la web.
5. Entra a `/admin/login.html` con tu usuario habitual.

La primera vez que el Admin abra con las tablas vacías, copiará automáticamente el catálogo actual a Supabase.

Después:
- cambios de stock/precio/estado se publican para todos;
- productos nuevos y sus imágenes se guardan en Supabase Storage;
- cupones y mínimo de productos se publican para todos;
- avisos especiales se publican para todos;
- ventas y ganancias quedan guardadas en la nube.

Seguridad: la web usa una publishable key. RLS permite lectura pública del catálogo/promociones, pero las escrituras requieren una sesión autenticada de Admin.
