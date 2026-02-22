# Actualizacion 1.1 - Doble cifrado hibrido y firmas digitales

Fecha: 2026-02-22

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
