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

## 0.2.3 - Modo presentacion

- Nuevo interruptor global en `Settings` para compartir pantalla de forma segura.
- Oculta username, password y notas en tarjetas mientras esta activo.
- Bloquea acciones de copy/reveal de credenciales en `Vault`.
- Oculta username en `Dashboard` y password generado en `Generator`.

## 2.4 - Historial de versiones

- Cada credencial guarda:
  - Fecha de creacion.
  - Cambios (campos modificados y timestamp).
  - Versiones anteriores de password.
- Nuevo endpoint:
  - `GET /credentials/:id/history`
- En `Vault` se agrega boton "Ver historial" por credencial.

## 2.5 - Auditoria visual

- Se agrega panel visual en `Dashboard` con graficos para:
  - Contrasenas debiles.
  - Contrasenas duplicadas.
  - Contrasenas antiguas (+180 dias).
- Incluye detalle de grupos duplicados y top credenciales antiguas.

## 3.2 - Sharding del vault

- Persistencia dividida en tres shards fisicos:
  - `server/data/shards/metadata.json`
  - `server/data/shards/entries.json`
  - `server/data/shards/crypto.json`
- Migracion automatica desde `server/data/vault.json` al primer arranque.
- Si un shard se pierde/corrompe, los otros shards se mantienen aislados para reducir impacto.

## 3.3 - Sincronizacion entre dispositivos

- Transporte en tiempo real por:
  - EventSource (`GET /sync/events`)
  - WebSockets (`/sync/ws`)
- Publicacion de eventos de vault:
  - `credential.upsert`
  - `credential.batch_upsert`
  - `credential.delete`
  - `credential.clear`
- Resolucion de conflictos con CRDT tipo LWW (Last-Write-Wins) por credencial:
  - `counter`
  - `ts`
  - `clientId`

## 3.4 - Backups automaticos cifrados

- Backups locales cifrados con AES-256-GCM en `server/data/backups` (configurable).
- Soporte de upload en nube via `PUT` firmado para:
  - S3
  - GCP
  - Azure
- Exportacion programada con scheduler por intervalo configurable.
- Endpoints:
  - `GET /backup/config`
  - `GET /backup/local`
  - `POST /backup/run`

## 4.1 - Generador de contrasenas inteligente

- En `Generator` se agrega deteccion heuristica de:
  - Requisitos del sitio (URL/dominio y texto de politica).
  - Longitud minima.
  - Caracteres permitidos (minusculas, mayusculas, numeros, simbolos).
- Al generar, aplica automaticamente la politica detectada si el modo inteligente esta activo.

## 4.2 - Clasificacion automatica

- Deteccion automatica por heuristicas para cada entrada:
  - `LOGIN`
  - `CREDIT_CARD`
  - `SECURE_NOTE`
  - `API_KEY`
- Se persiste `entryType` en backend y se protege con firma digital de entrada.
- En `Vault` se muestra badge de tipo detectado en cada tarjeta.

## 4.3 - Auto-rotacion de contrasenas

- Soporte para servicios compatibles:
  - GitHub tokens
  - API keys
  - SSH keys
- Politica por credencial:
  - `enabled`
  - `intervalDays`
  - `nextRotationAt`
  - `lastRotatedAt`
- Rotacion manual por credencial desde `Vault` y `Settings`.
- Rotacion masiva de credenciales vencidas desde `Settings`.
- Scheduler backend que ejecuta rotaciones vencidas automaticamente.
- Nuevos endpoints:
  - `PUT /credentials/:id/rotation-policy`
  - `POST /credentials/:id/rotate`
  - `GET /rotation/due`
  - `POST /rotation/run-due`

## 4.4 - Deteccion de patrones debiles

- Analisis automatico de passwords para identificar:
  - Contrasenas parecidas (similitud alta entre pares).
  - Reutilizacion exacta (misma password en multiples entradas).
  - Secuencias debiles (ej. `1234`, `abcd`, `qwerty`, repeticion de caracteres).
- Integrado en `Dashboard` dentro de la auditoria visual:
  - Metrica agregada de "Patrones debiles".
  - Listado de credenciales afectadas con motivo detectado.
  - Top de pares de credenciales con alta similitud.

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
