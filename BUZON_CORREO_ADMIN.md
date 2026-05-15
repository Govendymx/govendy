# Buzón de correo (Admin)

## Resumen

En el **panel de administración** puedes conectar hasta **3 cuentas de correo con dominio propio** (IMAP + SMTP), ver los correos entrantes y redactar/enviar desde la misma interfaz.

## Pasos para activarlo

1. **Migración SQL**  
   Ejecuta en Supabase → SQL Editor el archivo `supabase_admin_mailboxes.sql`.  
   Esto agrega la columna `admin_mailboxes` en `app_settings`.

2. **Instalar dependencias**  
   En la raíz del proyecto:
   ```bash
   npm install
   ```
   Se instalan `imapflow`, `mailparser` y `nodemailer`.

3. **Configurar cuentas**  
   Ve a **Admin → Configuración** y en la sección **Buzón de correo** define hasta 4 cuentas:
   - **Etiqueta**: nombre (ej. "Soporte", "Ventas").
   - **Email**: dirección (ej. `soporte@tudominio.com`).
   - **IMAP** (recibir): host, puerto (ej. 993), SSL.
   - **SMTP** (enviar): host, puerto (ej. 587), SSL.
   - **Usuario** y **Contraseña**: los mismos que uses en tu cliente de correo o en el panel del proveedor.

4. **Abrir el buzón**  
   En **Admin → Correo** (o desde Configuración, "Abrir buzón"):
   - Elige la cuenta en el desplegable.
   - Lista de recibidos, clic para ver el mensaje.
   - **Redactar** para escribir y enviar (desde la cuenta seleccionada).

## Requisitos de las cuentas

- Cuentas con **dominio propio** (ej. `@tudominio.com`).
- **IMAP** habilitado para recibir.
- **SMTP** habilitado para enviar.
- Usuario/contraseña (o contraseña de aplicación si aplica).

Ejemplos típicos: cPanel, Zoho, Google Workspace, Microsoft 365, etc. Usa los mismos datos que configurarías en Outlook o Thunderbird.

## Seguridad

- Solo **administradores** (tabla `admin_users`) pueden usar el buzón y ver/editar la configuración.
- Las contraseñas se guardan en `app_settings.admin_mailboxes` (JSON). Restringe el acceso a la base de datos y evita exponer este JSON al frontend.
