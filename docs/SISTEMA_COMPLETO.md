# Sistema Completo

Este documento explica como funciona el proyecto de forma integral: arquitectura, flujo funcional, modulos, seguridad, operacion y mantenimiento.

## 1. Objetivo

Aplicacion de gestion de credenciales con enfoque de seguridad:

- Frontend React + Vite.
- Backend Node.js + Express.
- Vault con cifrado local y protecciones de servidor.
- Funciones avanzadas: QR unlock, breach detection, auto-rotation, shared vault, emergency access y modo offline.

## 2. Estructura del repositorio

- `src/`: frontend (paginas, componentes, hooks, utilidades, estilos).
- `server/`: backend (API, storage, crypto, seguridad, sincronizacion).
- `server/data/`: persistencia local del vault y shards.
- `browser-extension/`: extension para autocompletado en navegador.
- `docs/`: documentacion tecnica y guias de auditoria.

## 3. Arquitectura general

Flujo principal:

1. Usuario desbloquea el vault con password maestra.
2. Frontend consume API privada (`/api/v1/<API_NAMESPACE>`).
3. Backend persiste credenciales y metadatos.
4. Cambios se reflejan por sync (SSE/WebSocket) y modo offline.
5. UI muestra dashboard, vault, generador, auditoria y settings.

## 4. Frontend (src)

Entradas principales:

- `src/main.jsx`: bootstrap de la app.
- `src/App.jsx`: rutas, estado compartido, seguridad global y spotlight.
- `src/index.css`: tema visual y estilos base.

Paginas:

- `src/pages/VaultPage.jsx`: gestion completa de entradas.
- `src/pages/GeneratorPage.jsx`: generador de passwords.
- `src/pages/AuditPage.jsx`: analitica de seguridad.
- `src/pages/SettingsPage.jsx`: seguridad, backup y configuracion.
- `src/pages/DashboardPage.jsx`, `DevicesPage.jsx`, `AccountPage.jsx`.

Hooks:

- `src/hooks/useCredentials.js`: sincronizacion, cache, offline queue.
- `src/hooks/useVaultSecurity.js`: password maestra y estado de bloqueo.
- `src/hooks/useAutoLock.js`: bloqueo automatico por eventos de seguridad.
- `src/hooks/useLocalStorage.js`: persistencia de estado de UI.

Componentes:

- `src/components/AppShell.jsx`: layout base (sidebar/topbar).
- `src/components/SpotlightSearch.jsx`: buscador global tipo command palette.
- `src/components/ui/`: componentes reutilizables (`Card`, `Modal`, `Tag`, etc.).

## 5. Backend (server)

Nucleo:

- `server/index.js`: app Express, middlewares, rutas y scheduler.
- `server/store.js`: operaciones del vault y persistencia.
- `server/config.js`: carga y validacion de configuracion.

Seguridad y crypto:

- `server/password.js`: utilidades de password.
- `server/multilayer-crypto.js`: cifrado multicapa.
- `server/entry-signature.js`: firma/verificacion de entradas.
- `server/qr-unlock.js`: flujo QR de un solo uso.
- `server/breach-detection.js`: chequeo de brechas.
- `server/auto-rotation.js`: rotacion automatica.

Sincronizacion y comparticion:

- `server/sync-hub.js`: eventos de sincronizacion.
- `server/hybrid-share.js`: paquetes compartidos seguros.
- `server/backup-service.js`: export y backups.

## 6. Modelo de datos

Persistencia local principal:

- `server/data/vault.json`

Sharding:

- `server/data/shards/metadata.json`: metadata y versionado.
- `server/data/shards/entries.json`: entradas y entidades de negocio.
- `server/data/shards/crypto.json`: material cifrado.

Objetivo del sharding:

- Separar metadata y material sensible.
- Reducir impacto de corrupcion de un solo archivo.

## 7. Seguridad implementada

- Cifrado en cliente para datos locales.
- Cifrado en servidor para credenciales.
- Firma digital por entrada para integridad.
- Rate limiting y hardening de cabeceras HTTP (`helmet`).
- QR unlock con expiracion y uso unico.
- Deteccion de passwords comprometidas.
- Auto-lock por inactividad/foco.
- Controles de modo presentacion y modo viaje.

## 8. API

Base:

- `/api/v1/<API_NAMESPACE>`

Grupos principales:

- `credentials`, `generate`, `audit`.
- `qr/*`, `devices/*`, `share/*`.
- `backup/*`, `rotation/*`.
- `shared-vaults/*`, `emergency/*`.

Endpoint publico:

- `/healthz`

## 9. Configuracion

Variables de entorno relevantes (ver `.env.example`):

- `API_NAMESPACE`
- `MASTER_ENCRYPTION_KEY`
- `ENCRYPTION_LAYERS`
- `VITE_API_BASE`
- `APP_BASE_URL`
- `HIBP_ENABLED`
- `BACKUP_*`

## 10. Comandos de trabajo

Instalacion:

```bash
npm install
```

Desarrollo:

```bash
npm run dev
```

Calidad:

```bash
npm run lint
npm run format:check
```

Build:

```bash
npm run build
npm run preview
```

## 11. Flujo recomendado para cambios

1. Crear rama de trabajo.
2. Implementar cambios pequenos y atomicos.
3. Ejecutar lint/build.
4. Revisar riesgos de seguridad de los cambios.
5. Abrir PR con evidencia de pruebas.

## 12. Troubleshooting rapido

- Si falla `build` por entorno restringido, ejecutar build fuera de sandbox.
- Si hay errores de API, revisar `server/index.js` y logs backend.
- Si UI no refleja cambios, revisar `VITE_API_BASE` y namespace.
- Si hay conflictos de datos, revisar shards y sync.

## 13. Auditoria del codigo con IA

Usar:

- `docs/AI_SECURITY_REVIEW.md`

Ese archivo define:

- alcance,
- checklists,
- prompts,
- formato de findings,
- y flujo de remediacion.
