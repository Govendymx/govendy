# Configuración de Recuperación de Contraseña

Este documento explica cómo configurar el sistema de recuperación de contraseña en Supabase.

## ✅ Funcionalidades Implementadas

1. **Página de solicitud de recuperación** (`/forgot-password`)
   - El usuario ingresa su email
   - Se envía un email con un enlace de recuperación

2. **Página de restablecimiento** (`/reset-password`)
   - El usuario hace clic en el enlace del email
   - Ingresa su nueva contraseña
   - La contraseña se actualiza

3. **Integración en login**
   - Enlace "¿Olvidaste tu contraseña?" en la página de login
   - Mensaje de éxito después de restablecer la contraseña

## 🔧 Configuración en Supabase

### Paso 1: Configurar URL de Redirección

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Navega a **Authentication** → **URL Configuration**
3. En **Redirect URLs**, agrega:
   ```
   http://localhost:3000/reset-password
   https://tu-dominio.com/reset-password
   ```
   (Reemplaza `tu-dominio.com` con tu dominio de producción)

### Paso 2: Configurar Email Templates (Opcional)

1. Ve a **Authentication** → **Email Templates**
2. Selecciona **Reset Password**
3. Puedes personalizar el template del email, pero asegúrate de que el enlace apunte a:
   ```
   {{ .SiteURL }}/reset-password
   ```

### Paso 3: Verificar Configuración de Email

1. Ve a **Settings** → **Auth**
2. Verifica que **Enable email confirmations** esté habilitado si lo necesitas
3. Verifica que **Site URL** esté configurado correctamente:
   - Desarrollo: `http://localhost:3000`
   - Producción: `https://tu-dominio.com`

## 📧 Template de Email (Ejemplo)

Si quieres personalizar el email, puedes usar este template:

```
Hola,

Has solicitado restablecer tu contraseña en Pocket.

Haz clic en el siguiente enlace para crear una nueva contraseña:
{{ .ConfirmationURL }}

Si no solicitaste este cambio, puedes ignorar este email.

Saludos,
El equipo de Pocket
```

## 🧪 Probar el Sistema

1. Ve a `/login`
2. Haz clic en "¿Olvidaste tu contraseña?"
3. Ingresa tu email
4. Revisa tu email (y la carpeta de spam)
5. Haz clic en el enlace del email
6. Ingresa tu nueva contraseña
7. Deberías ser redirigido a `/login` con un mensaje de éxito

## ⚠️ Notas Importantes

- **URLs de redirección**: Asegúrate de agregar todas las URLs donde se ejecutará tu aplicación (localhost para desarrollo, dominio de producción)
- **Tokens de expiración**: Los enlaces de recuperación expiran después de 1 hora por defecto (configurable en Supabase)
- **Email de desarrollo**: En desarrollo, Supabase puede enviar emails a través de su servicio de email o puedes configurar un SMTP personalizado
- **Seguridad**: Los tokens son de un solo uso y expiran automáticamente

## 🔒 Seguridad

- Los enlaces de recuperación solo son válidos por un tiempo limitado
- Los tokens son únicos y de un solo uso
- La nueva contraseña debe tener al menos 6 caracteres (validación en el frontend)
- El sistema verifica que las contraseñas coincidan antes de actualizar

## 🐛 Solución de Problemas

### El email no llega
- Verifica la carpeta de spam
- Verifica que el email esté correctamente configurado en Supabase
- Revisa los logs de Supabase en **Logs** → **Auth Logs**

### El enlace no funciona
- Verifica que la URL de redirección esté configurada en Supabase
- Asegúrate de que el enlace no haya expirado (1 hora por defecto)
- Verifica que la URL en el email sea correcta

### Error al restablecer la contraseña
- Verifica que el token no haya expirado
- Asegúrate de que la contraseña tenga al menos 6 caracteres
- Verifica que las contraseñas coincidan
