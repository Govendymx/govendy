# Pocket App

Proyecto web configurado con Next.js, Tailwind CSS (diseño rosa tipo Liverpool), Supabase y Cloudinary.

## 🚀 Tecnologías

- **Next.js 14** - Framework React con App Router
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Framework CSS con tema rosa Liverpool
- **Supabase** - Base de datos PostgreSQL y autenticación
- **Cloudinary** - Gestión de imágenes con marca de agua automática

## 📋 Prerrequisitos

- Node.js 18+ instalado
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [Cloudinary](https://cloudinary.com)

## ⚙️ Instalación

1. **Instalar dependencias:**
```bash
npm install
```

2. **Configurar variables de entorno:**

**IMPORTANTE:** Crea un archivo `.env.local` en la raíz del proyecto. Puedes copiar `.env.example` como base:

```bash
# En Windows PowerShell:
Copy-Item .env.example .env.local

# En Linux/Mac:
cp .env.example .env.local
```

Luego edita `.env.local` y agrega tus credenciales:

```env
# Supabase Configuration (OBLIGATORIO)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui

# MercadoPago (opcional, para pagos)
MERCADOPAGO_ACCESS_TOKEN=tu_access_token_aqui

# Cloudinary (opcional, para imágenes)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

### Obtener credenciales de Supabase:

1. Ve a [supabase.com](https://supabase.com) y crea un proyecto
2. En Project Settings > API, encontrarás:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Obtener credenciales de Cloudinary:

1. Ve a [cloudinary.com](https://cloudinary.com) y crea una cuenta
2. En Dashboard, encontrarás:
   - `Cloud name` → `CLOUDINARY_CLOUD_NAME`
   - `API Key` → `CLOUDINARY_API_KEY`
   - `API Secret` → `CLOUDINARY_API_SECRET`

### Configurar marca de agua en Cloudinary:

1. Sube tu logo/marca de agua a Cloudinary (puede ser PNG con transparencia)
2. Anota el `public_id` de la imagen subida
3. Usa ese `public_id` como valor de `CLOUDINARY_WATERMARK`

## 🗄️ Estructura de Base de Datos (Supabase)

Ejemplo de tabla `products` que puedes crear en Supabase:

```sql
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  images TEXT[] DEFAULT '{}', -- Array de máximo 6 URLs
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios vean todos los productos
CREATE POLICY "Public products are viewable by everyone"
  ON products FOR SELECT
  USING (true);

-- Política para que los usuarios solo puedan insertar sus propios productos
CREATE POLICY "Users can insert their own products"
  ON products FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

## 🖼️ Uso de Cloudinary

El proyecto incluye utilidades para gestionar imágenes con marca de agua automática:

### Subir una imagen con marca de agua:

```typescript
import { uploadImageWithWatermark } from '@/lib/cloudinary/utils';

const imageUrl = await uploadImageWithWatermark(file, {
  folder: 'products',
  watermark: process.env.CLOUDINARY_WATERMARK,
});
```

### Subir hasta 6 imágenes para un producto:

```typescript
import { uploadProductImages } from '@/lib/cloudinary/utils';

const imageUrls = await uploadProductImages(
  files, // Array de File (máximo 6)
  productId,
  process.env.CLOUDINARY_WATERMARK
);
```

### Generar URL optimizada:

```typescript
import { getOptimizedImageUrl } from '@/lib/cloudinary/utils';

const optimizedUrl = getOptimizedImageUrl(publicId, {
  width: 800,
  height: 600,
  quality: 80,
  format: 'webp',
  watermark: process.env.CLOUDINARY_WATERMARK,
});
```

## 🎨 Tema Rosa Liverpool

El proyecto incluye colores personalizados inspirados en Liverpool:

- `primary-600`: Rosa principal (#ec4899)
- `liverpool-600`: Rosa Liverpool (#e11d48)

Puedes usar estas clases en tus componentes:

```tsx
<div className="bg-primary-600 text-white p-4">
  Contenedor rosa
</div>
```

## 🛠️ Scripts Disponibles

- `npm run dev` - Inicia el servidor de desarrollo
- `npm run build` - Construye la aplicación para producción
- `npm start` - Inicia el servidor de producción
- `npm run lint` - Ejecuta ESLint

## 📁 Estructura del Proyecto

```
pocket-app/
├── app/                    # App Router de Next.js
│   ├── globals.css        # Estilos globales con Tailwind
│   ├── layout.tsx         # Layout principal
│   └── page.tsx           # Página de inicio
├── lib/
│   ├── cloudinary/        # Utilidades de Cloudinary
│   │   ├── config.ts      # Configuración de Cloudinary
│   │   └── utils.ts       # Funciones de subida y marca de agua
│   └── supabase/          # Utilidades de Supabase
│       ├── client.ts      # Cliente para Client Components
│       ├── server.ts      # Cliente para Server Components
│       └── types.ts       # Tipos TypeScript para la BD
├── tailwind.config.ts     # Configuración de Tailwind
├── tsconfig.json          # Configuración de TypeScript
└── next.config.mjs        # Configuración de Next.js
```

## 📝 Notas

- Las imágenes se suben automáticamente a Cloudinary con marca de agua
- Máximo 6 imágenes por producto (validado en `uploadProductImages`)
- La marca de agua se aplica automáticamente en la esquina inferior derecha
- El diseño usa colores rosa tipo Liverpool como especificado

## 🚀 Despliegue

Para desplegar en Vercel:

1. Conecta tu repositorio a Vercel
2. Agrega las variables de entorno en la configuración del proyecto
3. Vercel detectará automáticamente Next.js y desplegará

¡Listo para comenzar a desarrollar! 🎉