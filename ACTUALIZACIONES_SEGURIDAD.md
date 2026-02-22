# Actualizacion 1.1 - Doble cifrado hibrido y firmas digitales

Fecha: 2026-02-22

## 0.1.3 - Autenticacion basada en hardware

- WebAuthn / Passkeys para registrar y autenticar credenciales locales.
- Registro de llaves tipo YubiKey usando `authenticatorAttachment: "cross-platform"`.
- NFC unlock experimental en cliente (validacion por hash de token local con lectura Web NFC).
- Integracion en `Settings` para alta, prueba y estado de compatibilidad por navegador/dispositivo.

## 0.1.4 - Honey passwords

- Se agrega generacion de credenciales senuelo en `Vault` con boton dedicado.
- Las credenciales honey se marcan con badge `Honey`.
- Al revelar o copiar una credencial honey se dispara evento de seguridad y se registra auditoria.
- Nuevos endpoints:
  - `POST /honey/generate`
  - `POST /honey/trigger`

## 0.1.5 - Deteccion de brechas

- Integracion con HaveIBeenPwned Passwords API por k-anonymity (`/range/{prefix}`).
- Integracion con base local de passwords filtradas (`server/data/leaked-passwords.txt`).
- Alertas automaticas al crear/actualizar credenciales comprometidas.
- Auto-escaneo al listar credenciales (con TTL configurable) para mantener estado de brecha actualizado.
- Escaneo manual completo de boveda desde `Settings`.
- Nuevos endpoints:
  - `POST /breach/check/:id`
  - `POST /breach/scan`

## 0.1.6 - Auto-lock inteligente

- Bloqueo automatico por inactividad con timeout configurable.
- Bloqueo inmediato al ocultar/cambiar de pestana.
- Bloqueo inmediato por perdida de foco de ventana.
- Bloqueo inmediato cuando el mouse sale de la ventana.
- Integracion en `Settings` para activar/desactivar, definir minutos de inactividad y segundos de gracia.

## 0.2.1 - Autocompletado estilo Bitwarden

- Se agrega extension de navegador en `browser-extension/`.
- Compatibilidad WebExtension para:
  - Chrome
  - Firefox
  - Edge
- Popup con busqueda de credenciales por dominio/servicio/usuario.
- Autocompletado sobre formulario activo (usuario + password) en la pestana actual.
- Configuracion de `API base` desde el popup para apuntar al backend local.

## 0.2.2 - Modo viaje

- Se agrega bandera `isSensitive` para credenciales sensibles.
- El `Vault` permite marcar credenciales nuevas como sensibles.
- En `Settings` se puede activar temporalmente el modo viaje (1 a 1440 minutos).
- Mientras el modo viaje esta activo:
  - No permite revelar credenciales sensibles.
  - No permite copiar credenciales sensibles.
  - Se muestra estado de expiracion del modo viaje.

## Cambios implementados

- Se agrego firma digital por entrada de credencial en backend (`Ed25519`).
- Cada credencial nueva/actualizada se firma y se verifica al leer.
- Si la firma no valida, la entrada se marca como manipulada y su password no se entrega.
- Se agrego flujo de comparticion entre dispositivos con cifrado hibrido:
  - Clave simetrica por paquete (`AES-256-GCM`) para el contenido.
  - Envoltorio asimetrico de clave (`RSA-OAEP-SHA256`) con la llave publica del dispositivo destino.
- Se agrego registro de llave publica por dispositivo.
- Se agrego creacion de paquete cifrado para compartir credenciales.
- Frontend actualizado en `Settings` para:
  - Registrar llave del dispositivo actual.
  - Elegir credencial + dispositivo destino y generar paquete.
  - Importar un paquete y descifrarlo localmente para guardar la credencial.

## Archivos principales modificados

- `server/entry-signature.js`
- `server/hybrid-share.js`
- `server/store.js`
- `server/index.js`
- `src/hooks/useVaultSecurity.js`
- `src/utils/api.js`
- `src/pages/SettingsPage.jsx`
- `README.md`

## Endpoints nuevos

- `POST /devices/register-key`
- `GET /devices/share-targets`
- `POST /share/credential`

## Notas tecnicas

- La clave de firma `Ed25519` se genera una sola vez y se guarda en `server/data/signing-key.json`.
- Entradas antiguas sin firma se marcan como `legacy_unsigned`.
- Entradas firmadas invalidas se marcan como `tampered` y exponen password como `[SIGNATURE_INVALID]`.
