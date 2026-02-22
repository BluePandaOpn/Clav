# Password Manager Pro

Gestor de passwords profesional con:
- Frontend en React + Vite
- Backend en Node.js + Express
- Multiples paginas (Dashboard, Vault, Generator, Settings)
- Persistencia en archivo JSON (`server/data/vault.json`)
- Cache local cifrada con password maestra (AES-GCM + PBKDF2)
- Preferencias persistentes con `useLocalStorage`
- Cifrado en servidor por multiples capas AES-256-GCM (hasta 10 capas)
- Doble cifrado hibrido para comparticion entre dispositivos (RSA-OAEP + AES-GCM)
- Firma digital por entrada (Ed25519) para deteccion de manipulacion
- Namespace de rutas API privado por `.env`
- Hardening base: `helmet`, `express-rate-limit`, limites de payload
- QR unlock de un solo uso con expiracion corta y firma HMAC
- Registro automatico de dispositivos confiables + bitacora de seguridad
- Autenticacion basada en hardware (0.1.3): WebAuthn/Passkeys, YubiKey y NFC unlock experimental local
- Honey passwords (0.1.4): credenciales senuelo para deteccion de accesos no autorizados
- Deteccion de brechas (0.1.5): HIBP + base local de filtradas y alertas automaticas
- Auto-lock inteligente (0.1.6): bloqueo por inactividad, pestana, foco y salida de mouse
- Autocompletado estilo Bitwarden (2.1): extension para Chrome/Firefox/Edge con llenado de login
- Modo viaje (0.2.2): oculta temporalmente credenciales sensibles durante desplazamientos
- Modo presentacion (0.2.3): oculta datos sensibles al compartir pantalla
- Historial de versiones (2.4): fecha de creacion, cambios y versiones anteriores por credencial
- Auditoria visual (2.5): graficos de contrasenas debiles, duplicadas y antiguas
- Sharding del vault (3.2): separacion fisica en metadatos, cifrado y entradas
- Sincronizacion entre dispositivos (3.3): SSE + WebSockets + CRDT LWW
- Backups automaticos cifrados (3.4): locales, nube y exportacion programada
- Generador de contrasenas inteligente (4.1): deteccion de requisitos de sitio y politica
- Clasificacion automatica (4.2): login, tarjeta de credito, nota segura y API key
- Auto-rotacion de credenciales (4.3): GitHub tokens, API keys y SSH keys con politica por entrada
- Deteccion de patrones debiles (4.4): contrasenas parecidas, reutilizacion y secuencias comunes
- Cofre compartido (5.1): compartir con familia/equipos/empresas con permisos lectura, escritura y temporal
- Emergency Access (5.2): acceso de emergencia al vault si el owner no responde en X dias
- Modo offline completo (5.3): operaciones locales sin internet + sincronizacion automatica al reconectar
- Desbloqueo por QR mejorado (5.4): token de un solo uso, expiracion dinamica, firma digital y push notifications
- Deploy seguro con Python (6.0): build, releases versionadas, HTTPS local, proxy API y auto-actualizacion

## Requisitos

- Node.js 18+
- npm 9+

## Instalacion

```bash
npm install
```

Configura variables de entorno:

```bash
cp .env.example .env
```

Variables clave:
- `API_NAMESPACE`: segmento privado de URL (min 24 chars).
- `MASTER_ENCRYPTION_KEY`: clave maestra de backend (min 64 chars).
- `ENCRYPTION_LAYERS`: entre 3 y 10.
- `VITE_API_BASE`: debe coincidir con `API_NAMESPACE`.
- `VITE_API_PROXY_TARGET`: proxy de Vite hacia API (`http://...` o `https://...`).
- `APP_BASE_URL`: URL publica frontend para enlaces QR.
- `HIBP_ENABLED`: habilita chequeo con HaveIBeenPwned Passwords API.
- `HIBP_TIMEOUT_MS`: timeout de consulta HIBP en ms.
- `LEAKED_PASSWORDS_FILE`: archivo local de passwords filtradas.
- `BREACH_AUTO_SCAN_ON_LIST`: refresca brechas automaticamente al consultar credenciales.
- `BREACH_STATUS_TTL_HOURS`: antiguedad maxima del estado de brecha antes de revalidar.
- `HTTPS_ENABLED`: habilita servidor API sobre TLS.
- `HTTPS_KEY_PATH` y `HTTPS_CERT_PATH`: rutas del certificado TLS.
- `FORCE_HTTPS`: redirige HTTP a HTTPS (util detras de proxy/LB).
- `HTTP_REDIRECT_ENABLED` y `HTTP_REDIRECT_PORT`: servidor HTTP dedicado que redirige a HTTPS.

## Desarrollo

```bash
npm run dev
```

Servicios:
- Frontend: `http://localhost:5173`
- API base: `http://localhost:4000/api/v1/<API_NAMESPACE>`

### Migracion HTTP -> HTTPS

1. Genera/instala certificado y clave TLS.
2. Configura en `.env`:
   - `HTTPS_ENABLED=true`
   - `HTTPS_KEY_PATH=<ruta-key.pem>`
   - `HTTPS_CERT_PATH=<ruta-cert.pem>`
   - opcional `HTTPS_CA_PATH=<ruta-ca.pem>`
3. (Opcional recomendado) activa redireccion:
   - `HTTP_REDIRECT_ENABLED=true`
   - `HTTP_REDIRECT_PORT=4080`
4. Si usas Vite en local con API HTTPS:
   - `VITE_API_PROXY_TARGET=https://localhost:4000`
5. Si usas reverse proxy (Nginx/Cloudflare/ALB), activa:
   - `TRUST_PROXY=true`
   - `FORCE_HTTPS=true`

## Build

```bash
npm run build
npm run preview
```

Para previsualizar con API funcionando (frontend + backend en paralelo):

```bash
npm run preview:full
```

## Calidad de codigo

```bash
npm run lint
npm run format:check
```

## Deploy seguro con Python

Directorio: `python/`

- Script principal: `python/deploy_secure.py`
- Bootstrap venv: `python/bootstrap_venv.py`
- Dependencias venv: `python/requirements.txt`
- Documentacion: `python/README.md`
- Launcher Windows: `python/run-secure-deploy.bat`

Ejemplo recomendado:

```bash
python\run-secure-deploy.bat
```

## Extension de navegador (2.1)

Directorio: `browser-extension/`

Incluye:
- Popup para buscar credenciales por dominio/servicio/usuario.
- Autocompletado en la pestana activa (usuario + password).
- Compatible con Chrome, Firefox y Edge (WebExtension MV3).

Carga local:
- Chrome: `chrome://extensions` > `Modo desarrollador` > `Cargar descomprimida` > seleccionar `browser-extension`.
- Edge: `edge://extensions` > `Developer mode` > `Load unpacked`.
- Firefox: `about:debugging` > `This Firefox` > `Load Temporary Add-on` > seleccionar `browser-extension/manifest.json`.

Configura en el popup:
- `API base`: `http://localhost:4000/api/v1/<API_NAMESPACE>`
- Ejemplo con este proyecto: `http://localhost:4000/api/v1/vault-x9f3k7s2m1q8n4z6t0p5r2d7c9`

## Endpoints API

Prefix: `/api/v1/<API_NAMESPACE>`

- `GET /health`
- `GET /credentials`
- `POST /credentials`
- `GET /credentials/:id/history`
- `PUT /credentials/:id/rotation-policy`
- `POST /credentials/:id/rotate`
- `PUT /credentials/:id`
- `DELETE /credentials/:id`
- `DELETE /credentials`
- `POST /generate`
- `GET /export`
- `POST /qr/challenge`
- `GET /qr/challenge/:id`
- `POST /qr/approve`
- `GET /devices`
- `POST /devices/register-key`
- `GET /devices/share-targets`
- `POST /share/credential`
- `GET /audit`
- `POST /honey/generate`
- `POST /honey/trigger`
- `POST /breach/check/:id`
- `POST /breach/scan`
- `GET /backup/config`
- `GET /backup/local`
- `POST /backup/run`
- `GET /rotation/due`
- `POST /rotation/run-due`
- `GET /shared-vaults`
- `POST /shared-vaults`
- `POST /shared-vaults/:id/members`
- `DELETE /shared-vaults/:id/members/:memberId`
- `POST /shared-vaults/:id/credentials`
- `DELETE /shared-vaults/:id/credentials/:credentialId`
- `GET /emergency/contacts`
- `POST /emergency/contacts`
- `DELETE /emergency/contacts/:id`
- `GET /emergency/requests`
- `POST /emergency/requests`
- `POST /emergency/requests/:id/resolve`
- `GET /emergency/grant/:requestId`

Endpoint publico de vida:
- `GET /healthz`

## Backups automaticos cifrados (3.4)

Configuracion por `.env`:
- `BACKUP_ENABLED`: habilita backups cifrados.
- `BACKUP_DIR`: carpeta local de backups.
- `BACKUP_RETENTION`: cantidad maxima de backups locales.
- `BACKUP_AUTO_ENABLED`: habilita scheduler.
- `BACKUP_INTERVAL_MINUTES`: intervalo de exportacion programada.
- `BACKUP_RUN_ON_STARTUP`: ejecutar backup al iniciar servidor.
- `BACKUP_CLOUD_PROVIDER`: `none`, `s3`, `gcp`, `azure`.
- `BACKUP_CLOUD_URL`: URL firmada/presigned para upload `PUT`.
- `BACKUP_CLOUD_AUTH_HEADER`: header opcional `Authorization`.
