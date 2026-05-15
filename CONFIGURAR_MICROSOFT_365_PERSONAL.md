# 📧 Configurar Microsoft 365 Personal para Correo - Paso a Paso

## 🎯 Objetivo

Crear las cuentas de correo que necesitas:
- `contacto@gopocket.com.mx`
- `info@gopocket.com.mx`
- `ventas@gopocket.com.mx`
- `soporte@gopocket.com.mx`

**Usando Microsoft 365 Personal** (generalmente NO pide RFC)

---

## 📋 Paso 1: Verificar tu plan de Microsoft 365

### 1.1 Revisar tu plan actual

Veo que ya tienes Microsoft 365 activo (HX HP Xalapa). Necesitamos verificar:

1. **¿Qué plan tienes?**
   - Ve a: https://admin.microsoft.com
   - O ve a: https://account.microsoft.com/services
   - Revisa si tienes un plan **Personal** o **Business**

2. **Si tienes plan Personal:**
   - ✅ Puedes agregar tu dominio personalizado
   - ✅ Generalmente NO pide RFC
   - ⚠️ Puede tener límites en el número de cuentas

3. **Si tienes plan Business:**
   - ✅ Puedes crear múltiples cuentas
   - ⚠️ Puede pedir RFC dependiendo del país

---

## 📋 Paso 2: Agregar tu dominio a Microsoft 365

### 2.1 Acceder al Centro de Administración

**⚠️ IMPORTANTE:** NO puedes usar una cuenta personal de Hotmail/Outlook para administrar Microsoft 365.

1. Ve a: **https://admin.microsoft.com**
2. **Necesitas una cuenta de Microsoft 365 Business** (no personal)
   - Si ya tienes Microsoft 365 Business, usa esa cuenta de administrador
   - Si NO tienes Microsoft 365 Business, necesitas crearlo primero (ver abajo)
3. Inicia sesión con tu cuenta de Microsoft 365 Business
4. En el menú lateral, busca **"Configuración"** → **"Dominios"** o **"Settings"** → **"Domains"**

**❌ Si ves error "No puede iniciar sesión con una cuenta personal":**

Esto significa que estás usando una cuenta personal (Hotmail, Outlook, Live). Necesitas:

**Opción A: Crear Microsoft 365 Business nuevo**
1. Ve a: **https://www.microsoft.com/microsoft-365/business**
2. Elige **"Microsoft 365 Business Basic"** ($6 USD/mes por usuario)
3. Crea una cuenta nueva (NO uses tu Hotmail personal)
4. Durante el registro, elige **"Persona física"** o **"Individual"** para evitar RFC
5. Una vez creado, podrás agregar tu dominio

**Opción B: Usar Google Workspace (Más fácil)**
Si prefieres evitar complicaciones, usa Google Workspace:
1. Ve a: **https://workspace.google.com/**
2. Sigue las instrucciones en `CONFIGURAR_GOOGLE_WORKSPACE_SIN_RFC.md`

### 2.2 Agregar dominio

1. Haz clic en **"Agregar dominio"** o **"Add domain"**
2. Ingresa: `gopocket.com.mx`
3. Haz clic en **"Siguiente"** o **"Next"**
4. Microsoft te dará registros DNS para agregar

### 2.3 Agregar registros DNS en Cloudflare

Microsoft te dará registros DNS. Ejemplo:

```
Tipo: TXT
Nombre: @
Contenido: MS=ms12345678...

Tipo: MX
Nombre: @
Prioridad: 0
Contenido: gopocket-com-mx.mail.protection.outlook.com

Tipo: CNAME
Nombre: autodiscover
Contenido: autodiscover.outlook.com

Tipo: CNAME
Nombre: sip
Contenido: sipdir.online.lync.com

... (más registros)
```

**Pasos en Cloudflare:**

1. Ve a: **https://dash.cloudflare.com**
2. Selecciona tu dominio: `gopocket.com.mx`
3. Ve a **"DNS"** → **"Records"**
4. Para cada registro que Microsoft te da:
   - Haz clic en **"Add record"**
   - Selecciona el **Tipo** (TXT, MX, CNAME, etc.)
   - **Nombre:** `@` (o el nombre específico que Microsoft indique)
   - **Contenido:** Copia el valor que Microsoft te dio
   - **Proxy:** Desactivado (nube gris ☁️)
   - Haz clic en **"Save"**

### 2.4 Esperar verificación

- Puede tardar de 5 minutos a 24 horas
- Generalmente es más rápido (15-30 minutos)
- Microsoft te notificará cuando esté verificado

---

## 📋 Paso 3: Crear las cuentas de correo

### 3.1 Acceder a Usuarios

1. En el Centro de Administración, ve a **"Usuarios"** → **"Usuarios activos"** o **"Users"** → **"Active users"**
2. Haz clic en **"Agregar un usuario"** o **"Add a user"**

### 3.2 Crear cada cuenta

Para cada cuenta, completa:

**Cuenta 1:**
- **Nombre:** Contacto
- **Nombre de usuario:** `contacto` (Microsoft agregará automáticamente `@gopocket.com.mx`)
- **Email:** `contacto@gopocket.com.mx`
- **Contraseña:** (crea una segura, guárdala)
- Haz clic en **"Agregar"** o **"Add"**

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

## 📋 Paso 4: Habilitar IMAP y obtener configuración

### 4.1 Verificar que IMAP está habilitado

Por defecto, Microsoft 365 tiene IMAP habilitado, pero verifica:

1. En el Centro de Administración, ve a **"Configuración"** → **"Correo"** o **"Settings"** → **"Mail"**
2. Busca **"POP e IMAP"** y verifica que esté habilitado

### 4.2 Configuración IMAP/SMTP para tu app

**Para cada cuenta:**

- **IMAP Host:** `outlook.office365.com`
- **IMAP Port:** `993`
- **IMAP SSL:** ✅ Activado
- **IMAP Username:** El email completo (ej: `contacto@gopocket.com.mx`)
- **IMAP Password:** La contraseña que creaste

- **SMTP Host:** `smtp.office365.com`
- **SMTP Port:** `587`
- **SMTP TLS:** ✅ Activado (NO SSL)
- **SMTP Username:** El email completo (ej: `contacto@gopocket.com.mx`)
- **SMTP Password:** La misma contraseña

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
- **IMAP Host:** `outlook.office365.com`
- **IMAP Port:** `993`
- **IMAP Username:** `contacto@gopocket.com.mx`
- **IMAP Password:** (la contraseña que creaste)
- **IMAP SSL:** Activado
- **SMTP Host:** `smtp.office365.com`
- **SMTP Port:** `587`
- **SMTP Username:** `contacto@gopocket.com.mx`
- **SMTP Password:** (la misma contraseña)
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

**Microsoft 365 Personal:**
- **~$6-7 USD/mes** por usuario
- **4 usuarios = ~$24-28 USD/mes** (~$480-560 MXN/mes)

**Microsoft 365 Business Basic:**
- **~$6 USD/mes** por usuario
- **4 usuarios = ~$24 USD/mes** (~$480 MXN/mes)

---

## ⚠️ Limitaciones del Plan Personal

Si tienes plan **Personal**, puede tener limitaciones:
- Puede que solo permita 1-2 cuentas personalizadas
- Puede requerir actualizar a plan Business para más cuentas

Si necesitas 4 cuentas, considera:
- **Microsoft 365 Business Basic** ($6 USD/mes por usuario)
- O **Microsoft 365 Business Standard** ($12.50 USD/mes por usuario)

---

## 📝 Notas Importantes

- **Microsoft 365 generalmente NO pide RFC** para planes personales
- **IMAP está habilitado por defecto** en Microsoft 365
- **No necesitas contraseñas de aplicación** como en Google Workspace
- **La verificación del dominio puede tardar** - ten paciencia

---

## 🔄 Alternativa: Volver a Google Workspace

Si prefieres usar Google Workspace en lugar de Microsoft 365:

1. Ve directamente a: **https://workspace.google.com/**
2. Asegúrate de NO estar logueado en Microsoft
3. O usa una ventana de incógnito
4. Sigue las instrucciones en `CONFIGURAR_GOOGLE_WORKSPACE_SIN_RFC.md`

---

¿Necesitas ayuda con algún paso específico?
