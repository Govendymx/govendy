# 📧 Configurar Google Workspace SIN RFC - Paso a Paso

## 🎯 Objetivo

Crear las cuentas de correo que necesitas:
- `contacto@gopocket.com.mx`
- `info@gopocket.com.mx`
- `ventas@gopocket.com.mx`
- `soporte@gopocket.com.mx`

**Sin necesidad de RFC** (registrándote como persona física)

---

## 📋 Paso 1: Crear cuenta en Google Workspace

### 1.1 Acceder a Google Workspace

1. Ve a: **https://workspace.google.com/** (NO vayas a admin.google.com todavía)
2. Haz clic en **"Empezar"** o **"Get Started"**
3. **SÍ, puedes iniciar con tu cuenta personal de Google** (@gmail.com)
   - Google te pedirá iniciar sesión
   - Selecciona cualquiera de tus cuentas personales (ej: `arturoalejandro031187@gmail.com`)
   - Esto es solo para autenticación, NO afecta el tipo de cuenta
4. Selecciona el plan **"Business Starter"** ($6 USD/mes por usuario)

**⚠️ IMPORTANTE:** 
- Si ves una pantalla que dice "Sign in with an administrator account", significa que estás en `admin.google.com` antes de completar el registro
- **Vuelve a** `workspace.google.com` para completar el registro primero
- La cuenta de administrador se crea DESPUÉS de completar el registro

**❌ Si ves error "429 Too Many Requests":**

Este error significa que Google está limitando tus solicitudes. Prueba estas soluciones:

**Solución 1: Esperar (Recomendado)**
- Espera **15-30 minutos** sin intentar de nuevo
- Google levanta el bloqueo automáticamente
- Luego intenta de nuevo

**Solución 2: Modo Incógnito**
1. Abre una ventana de incógnito (Ctrl+Shift+N en Chrome)
2. Ve a: `https://workspace.google.com/`
3. Intenta de nuevo

**Solución 3: Limpiar cookies y caché**
1. En Chrome, presiona `Ctrl+Shift+Delete`
2. Selecciona "Cookies" y "Caché"
3. Elige "Última hora" o "Todo el tiempo"
4. Haz clic en "Borrar datos"
5. Intenta de nuevo

**Solución 4: Usar otra cuenta de Google**
- Intenta con otra de tus cuentas personales
- O crea una cuenta temporal de Gmail nueva

**Solución 5: Cambiar de red**
- Si estás en WiFi, prueba con datos móviles
- O usa un hotspot de tu teléfono
- Esto cambia tu IP y puede ayudar

**Solución 6: Esperar hasta mañana**
- Si nada funciona, espera 24 horas
- Google resetea los límites diariamente

### 1.2 Registro como Persona Física

**⚠️ IMPORTANTE:** Para evitar que pida RFC:

1. Cuando te pregunte el tipo de cuenta/organización, elige:
   - **"Individual"** o **"Persona física"**
   - **"Freelancer"** o **"Emprendedor individual"**
   - **NO elijas "Empresa"** o "Negocio" o "Corporación"
   
2. Usa tu nombre personal:
   - Nombre: Tu nombre completo personal (ej: "Alejandro")
   - NO uses "GoPocket" como nombre de empresa
   - Si te pregunta "Nombre de la empresa", puedes poner tu nombre personal
   
3. Si te pregunta por RFC:
   - Puedes intentar dejarlo en blanco
   - O usar tu CURP si lo acepta
   - O cancelar y probar Microsoft 365

### 1.3 Completar el registro

1. Ingresa tu email personal para recibir notificaciones (puede ser tu Gmail personal)
2. Completa los datos de facturación (usa tus datos personales)
3. Confirma tu cuenta
4. Google creará una cuenta de administrador nueva para tu dominio (ej: `admin@gopocket.com.mx` o similar)

---

## 📋 Paso 2: Verificar tu dominio en Google Workspace

### 2.1 Agregar dominio

1. En el panel de Google Workspace, ve a **"Dominios"** o **"Domains"**
2. Haz clic en **"Agregar dominio"** o **"Add domain"**
3. Ingresa: `gopocket.com.mx`
4. Selecciona **"Usar este dominio con Google Workspace"**

### 2.2 Agregar registros DNS en Cloudflare

Google te dará registros DNS para agregar. Ejemplo:

```
Tipo: TXT
Nombre: @
Contenido: google-site-verification=abc123xyz...

Tipo: MX
Nombre: @
Prioridad: 1
Contenido: ASPMX.L.GOOGLE.COM

Tipo: MX
Nombre: @
Prioridad: 5
Contenido: ALT1.ASPMX.L.GOOGLE.COM

... (más registros MX)
```

**Pasos en Cloudflare:**

1. Ve a: **https://dash.cloudflare.com**
2. Selecciona tu dominio: `gopocket.com.mx`
3. Ve a **"DNS"** → **"Records"**
4. Para cada registro que Google te da:
   - Haz clic en **"Add record"**
   - Selecciona el **Tipo** (TXT, MX, etc.)
   - **Nombre:** `@` (o deja vacío si Cloudflare no lo acepta)
   - **Contenido:** Copia el valor que Google te dio
   - **Proxy:** Desactivado (nube gris ☁️)
   - Haz clic en **"Save"**

### 2.3 Esperar verificación

- Puede tardar de 5 minutos a 24 horas
- Generalmente es más rápido (15-30 minutos)
- Google te notificará cuando esté verificado

---

## 📋 Paso 3: Crear las cuentas de correo

### 3.1 Crear usuarios

1. En Google Workspace, ve a **"Usuarios"** o **"Users"**
2. Haz clic en **"Agregar usuario"** o **"Add user"**

### 3.2 Crear cada cuenta

Para cada cuenta, completa:

**Cuenta 1:**
- **Nombre:** Contacto
- **Email:** `contacto@gopocket.com.mx`
- **Contraseña:** (crea una segura, guárdala)
- Haz clic en **"Agregar"**

**Cuenta 2:**
- **Nombre:** Info
- **Email:** `info@gopocket.com.mx`
- **Contraseña:** (crea una segura, guárdala)

**Cuenta 3:**
- **Nombre:** Ventas
- **Email:** `ventas@gopocket.com.mx`
- **Contraseña:** (crea una segura, guárdala)

**Cuenta 4:**
- **Nombre:** Soporte
- **Email:** `soporte@gopocket.com.mx`
- **Contraseña:** (crea una segura, guárdala)

---

## 📋 Paso 4: Habilitar acceso IMAP y crear contraseñas de aplicación

### 4.1 Habilitar IMAP para cada cuenta

1. Inicia sesión en cada cuenta de correo (ej: `contacto@gopocket.com.mx`)
2. Ve a: **https://mail.google.com**
3. Configuración (⚙️) → **"Ver todas las configuraciones"**
4. Ve a la pestaña **"Reenvío y correo POP/IMAP"**
5. Marca **"Habilitar IMAP"**
6. Haz clic en **"Guardar cambios"**
7. Repite para cada cuenta

### 4.2 Crear contraseñas de aplicación

**Para cada cuenta:**

1. Ve a: **https://myaccount.google.com/security**
2. (Inicia sesión con la cuenta correspondiente, ej: `contacto@gopocket.com.mx`)
3. Busca **"Contraseñas de aplicaciones"** o **"App passwords"**
4. Si no lo ves, primero habilita **"Verificación en 2 pasos"**
5. Crea una contraseña de aplicación:
   - Nombre: "GoPocket App"
   - Copia la contraseña generada (16 caracteres, guárdala bien)

**Repite esto para las 4 cuentas.**

---

## 📋 Paso 5: Configurar en tu app

### 5.1 Ir a Admin → Configuración

1. En tu app, ve a: **Admin → Configuración**
2. Busca la sección de **"Buzones de correo"** o **"Mailboxes"**

### 5.2 Agregar cada buzón

Para cada cuenta, agrega:

**Buzón 1: contacto@gopocket.com.mx**
- **Nombre:** Contacto
- **Email:** `contacto@gopocket.com.mx`
- **IMAP Host:** `imap.gmail.com`
- **IMAP Port:** `993`
- **IMAP Username:** `contacto@gopocket.com.mx`
- **IMAP Password:** (la contraseña de aplicación que creaste)
- **IMAP SSL:** Activado
- **SMTP Host:** `smtp.gmail.com`
- **SMTP Port:** `587`
- **SMTP Username:** `contacto@gopocket.com.mx`
- **SMTP Password:** (la misma contraseña de aplicación)
- **SMTP TLS:** Activado

**Repite para:**
- `info@gopocket.com.mx`
- `ventas@gopocket.com.mx`
- `soporte@gopocket.com.mx`

---

## ✅ Verificar que funciona

1. En tu app, ve a **Admin → Correo**
2. Deberías ver los buzones configurados
3. Haz clic en uno para ver los correos recibidos
4. Prueba enviar un correo de prueba

---

## 💰 Costo

- **$6 USD/mes por usuario**
- **4 usuarios = $24 USD/mes** (~$480 MXN/mes)

---

## ⚠️ Si Google Workspace aún pide RFC

Prueba **Microsoft 365 Personal:**

1. Ve a: https://www.microsoft.com/microsoft-365/personal
2. Elige el plan personal (no empresarial)
3. Generalmente no pide RFC para planes personales

---

## 📝 Notas Importantes

- **Guarda bien las contraseñas de aplicación** - solo se muestran una vez
- **No uses la contraseña normal de Gmail** - debes usar contraseñas de aplicación
- **Habilita IMAP** en cada cuenta antes de configurar en la app
- **La verificación del dominio puede tardar** - ten paciencia

---

¿Necesitas ayuda con algún paso específico?
