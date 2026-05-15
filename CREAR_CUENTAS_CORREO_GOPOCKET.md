# 📧 Crear Cuentas de Correo para gopocket.com.mx

## 🎯 Objetivo

Crear las cuentas de correo que necesitas:
- `contacto@gopocket.com.mx`
- `info@gopocket.com.mx`
- `ventas@gopocket.com.mx`
- `soporte@gopocket.com.mx`

## 📋 Opciones Disponibles

### Opción 1: Zoho Mail Lite (De pago - Más económico)

**Costo:**
- **Mex$ 22.5/mes por usuario** (facturación anual)
- **Mex$ 27/mes por usuario** (facturación mensual)
- **Para 4 cuentas:** ~$90-108 MXN/mes (~$5-6 USD/mes)

**Ventajas:**
- ✅ Más barato que Google Workspace
- ✅ Incluye IMAP y SMTP
- ✅ Fácil de configurar
- ✅ 5-10 GB de almacenamiento (según el plan que elijas)
- ✅ Prueba gratuita de 15 días disponible en algunos planes

**Pasos:**

1. **Contratar Zoho Mail:**
   - Ve a: https://www.zoho.com/mail/
   - Elige el plan **"Mail Lite"** (el más económico)
   - Selecciona facturación anual para mejor precio (Mex$ 22.5/mes)
   - O mensual si prefieres (Mex$ 27/mes)
   - Completa el registro y pago
   - **Nota:** Algunos planes tienen prueba gratuita de 15 días

2. **Verificar tu dominio:**
   - En Zoho Mail, ve a "Control Panel" → "Domain Setup"
   - Agrega tu dominio: `gopocket.com.mx`
   - Zoho te dará registros DNS para agregar en Cloudflare
   - Ve a Cloudflare → DNS → Agrega los registros que Zoho te da
   - Espera la verificación (puede tardar hasta 24 horas, pero generalmente es más rápido)

3. **Crear las cuentas de correo:**
   - En Zoho Mail, ve a "Users" → "Add User"
   - Crea cada cuenta:
     - `contacto@gopocket.com.mx`
     - `info@gopocket.com.mx`
     - `ventas@gopocket.com.mx`
     - `soporte@gopocket.com.mx`
   - Establece una contraseña para cada una

4. **Configurar en tu app:**
   - **IMAP Host:** `imap.zoho.com`
   - **IMAP Puerto:** `993`
   - **IMAP SSL:** ✅ (activado)
   - **SMTP Host:** `smtp.zoho.com`
   - **SMTP Puerto:** `587`
   - **SMTP SSL:** ✅ (activado)
   - **Usuario:** El email completo (ej: `contacto@gopocket.com.mx`)
   - **Contraseña:** La que configuraste en Zoho

---

### Opción 2: Google Workspace (De pago - $6 USD/mes por usuario)

**Ventajas:**
- ✅ Muy confiable
- ✅ Integración perfecta
- ✅ 30 GB de almacenamiento
- ✅ Todas las apps de Google

**Pasos:**

1. **Contratar Google Workspace:**
   - Ve a: https://workspace.google.com/
   - Elige el plan "Business Starter" ($6 USD/mes)
   - Registra tu dominio `gopocket.com.mx`
   - Verifica tu dominio (Google te dará instrucciones)

2. **Crear las cuentas:**
   - Ve a: https://admin.google.com
   - Usuarios → Gestionar usuarios → Agregar usuario
   - Crea cada cuenta con su contraseña

3. **Crear contraseñas de aplicación:**
   - Para cada cuenta, inicia sesión en: https://myaccount.google.com
   - Seguridad → Verificación en 2 pasos (actívala)
   - Contraseñas de aplicaciones → Genera una para "GoPocket App"
   - Usa esa contraseña de 16 caracteres en tu app

4. **Configurar en tu app:**
   - **IMAP Host:** `imap.gmail.com`
   - **IMAP Puerto:** `993`
   - **IMAP SSL:** ✅
   - **SMTP Host:** `smtp.gmail.com`
   - **SMTP Puerto:** `587`
   - **SMTP SSL:** ❌ (usa TLS, no SSL)
   - **Usuario:** El email completo
   - **Contraseña:** La contraseña de aplicación (16 caracteres)

---

### Opción 3: cPanel / Hosting Tradicional

Si tu dominio está en un hosting con cPanel:

1. **Accede a cPanel:**
   - Inicia sesión en el panel de control de tu hosting
   - Busca "Email Accounts" o "Cuentas de correo"

2. **Crear las cuentas:**
   - Haz clic en "Create" o "Crear"
   - Ingresa cada dirección: `contacto@gopocket.com.mx`, etc.
   - Establece una contraseña
   - Haz clic en "Create"

3. **Obtener datos IMAP/SMTP:**
   - Generalmente son:
     - **IMAP Host:** `mail.gopocket.com.mx` o `imap.gopocket.com.mx`
     - **IMAP Puerto:** `993` (SSL) o `143` (sin SSL)
     - **SMTP Host:** `mail.gopocket.com.mx` o `smtp.gopocket.com.mx`
     - **SMTP Puerto:** `587` (TLS) o `465` (SSL)
   - Consulta con tu proveedor de hosting si no estás seguro

4. **Configurar en tu app:**
   - Usa los datos que te proporcionó tu hosting

---

## 🚀 Recomendación

**Comparación de opciones:**

| Opción | Costo/mes (4 cuentas) | Ventajas |
|--------|----------------------|----------|
| **Zoho Mail** | ~$90-108 MXN (~$5-6 USD) | Más barato, fácil configuración |
| **Google Workspace** | ~$24 USD (~$480 MXN) | Muy confiable, integración perfecta |
| **cPanel/Hosting** | Depende del hosting | Si ya tienes hosting, puede ser gratis |

**Recomendación:**
- Si buscas la opción más económica: **Zoho Mail**
- Si buscas la más confiable: **Google Workspace**
- Si ya tienes hosting con cPanel: **Usa tu hosting** (puede ser gratis si ya lo pagas)

## 📝 Después de crear las cuentas

Una vez que tengas las cuentas creadas:

1. **Ejecuta el SQL** en Supabase (si no lo has hecho):
   - Archivo: `supabase_admin_mailboxes.sql`
   - O copia el código SQL de `EJECUTAR_SQL_BUZON_CORREO.md`

2. **Configura en tu app:**
   - Ve a **Admin → Configuración**
   - Busca "Buzón de correo"
   - Configura cada cuenta con los datos IMAP/SMTP

3. **Prueba:**
   - Ve a **Admin → Correo**
   - Selecciona una cuenta
   - Deberías ver los correos recibidos

## ❓ ¿Necesitas ayuda?

Dime qué opción quieres usar y te guío paso a paso con capturas de pantalla o instrucciones más detalladas.
