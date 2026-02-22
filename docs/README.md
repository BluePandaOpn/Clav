# Documentacion Tecnica Completa

Este documento explica el funcionamiento del proyecto `Password Manager Pro` a nivel funcional, tecnico y operativo.

## 1. Objetivo del sistema

Aplicacion de gestion de credenciales con:
- Frontend React + Vite.
- Backend Node.js + Express.
- Cifrado en cliente y servidor.
- Funciones de seguridad avanzadas: QR unlock, deteccion de brechas, auto-rotacion, cofre compartido, emergency access y modo offline.

## 2. Estructura del proyecto

Rutas principales:
- `src/`: frontend (paginas, componentes, hooks, estilos, utilidades).
- `server/`: backend (API, almacenamiento, crypto, seguridad).
- `server/data/shards/`: persistencia fragmentada del vault.
- `browser-extension/`: extension estilo Bitwarden (autocompletado).
- `docs/`: documentacion tecnica.

## 3. Arquitectura general

Flujo base:
1. El usuario desbloquea el vault con password maestra local.
2. El cliente consulta API (`/credentials`) y mantiene cache cifrada local.
3. Las credenciales en servidor se guardan cifradas por capas.
4. Cada entrada se firma digitalmente para detectar manipulacion.
5. Cambios se sincronizan por SSE/WebSocket.

## 4. Backend: modulos clave

- `server/index.js`: router principal, middlewares, endpoints y schedulers.
- `server/store.js`: logica de persistencia, cifrado, versiones, historial, sharding y operaciones de vault.
- `server/multilayer-crypto.js`: cifrado multicapa.
- `server/entry-signature.js`: firma/verificacion de entradas.
- `server/qr-unlock.js`: challenges QR con token one-time + firma digital + expiracion dinamica.
- `server/breach-detection.js`: HIBP + base local filtrada.
- `server/auto-rotation.js`: politicas y material de rotacion (GitHub/API/SSH).

## 5. Frontend: modulos clave

- `src/App.jsx`: enrutamiento principal y estado compartido.
- `src/hooks/useCredentials.js`: sincronizacion, cache, modo offline y cola de operaciones.
- `src/hooks/useVaultSecurity.js`: password maestra, cifrado local y hardware auth.
- `src/pages/VaultPage.jsx`: vault 3 paneles (categorias, lista, detalle).
- `src/pages/SettingsPage.jsx`: seguridad avanzada, dispositivos, backup, emergency, etc.
- `src/components/AppShell.jsx`: sidebar fija + topbar global.

## 6. Persistencia y sharding

Archivos:
- `server/data/shards/metadata.json`: versionado y estadisticas.
- `server/data/shards/entries.json`: metadatos de entradas, dispositivos, audit logs, shared vaults, emergency.
- `server/data/shards/crypto.json`: material cifrado de credenciales.

Ventaja: reduce impacto de corrupcion y separa datos sensibles de metadatos.

## 7. Mecanismos de seguridad implementados

- Cifrado local cliente (AES-GCM + PBKDF2) para cache.
- Cifrado servidor multicapa AES-256-GCM.
- Firma digital por entrada (Ed25519).
- Rate limiting y Helmet.
- QR unlock con:
  - token de un solo uso,
  - firma digital del challenge,
  - expiracion dinamica,
  - eventos de aprobacion en tiempo real.
- Deteccion de brechas de password.
- Auto-lock inteligente.
- Emergency Access con espera configurable y auto-aprobacion por timeout.

## 8. Sincronizacion y offline

Online:
- Eventos `sync` por SSE/WebSocket.

Offline:
- Cola local de operaciones (`create`, `delete`, `clear`) en `localStorage`.
- Reintento/sincronizacion automatica al reconectar.
- Sincronizacion manual desde Settings.

## 9. Endpoints principales

Base: `/api/v1/<API_NAMESPACE>`

Categorias importantes:
- Credenciales: `/credentials`
- QR unlock: `/qr/challenge`, `/qr/approve`
- Brechas: `/breach/check/:id`, `/breach/scan`
- Rotacion: `/credentials/:id/rotation-policy`, `/credentials/:id/rotate`, `/rotation/run-due`
- Compartido: `/shared-vaults/*`
- Emergency: `/emergency/*`
- Backup: `/backup/*`

## 10. Ejecucion local

Requisitos:
- Node 18+
- npm 9+

Comandos:
```bash
npm install
npm run dev
npm run lint
npm run build
```

## 11. Flujo de debugging recomendado

1. Revisar consola backend (errores API).
2. Revisar consola frontend (errores React/Vite).
3. Validar estado de shards en `server/data/shards/`.
4. Ejecutar `npm run lint`.
5. Ejecutar `npm run build`.

## 12. Convenciones y calidad

- Evitar guardar secretos en git.
- Mantener cambios de estado auditables en backend.
- Priorizar validacion de payload y permisos en endpoints.
- Agregar pruebas para flujos criticos de seguridad.

## 13. Documentacion de auditoria IA

Para auditorias automáticas/semiautomaticas de seguridad y revision total del codigo, usar:
- `docs/AI_SECURITY_REVIEW.md`

