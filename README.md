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
- `APP_BASE_URL`: URL publica frontend para enlaces QR.
- `HIBP_ENABLED`: habilita chequeo con HaveIBeenPwned Passwords API.
- `HIBP_TIMEOUT_MS`: timeout de consulta HIBP en ms.
- `LEAKED_PASSWORDS_FILE`: archivo local de passwords filtradas.
- `BREACH_AUTO_SCAN_ON_LIST`: refresca brechas automaticamente al consultar credenciales.
- `BREACH_STATUS_TTL_HOURS`: antiguedad maxima del estado de brecha antes de revalidar.

## Desarrollo

```bash
npm run dev
```

Servicios:
- Frontend: `http://localhost:5173`
- API base: `http://localhost:4000/api/v1/<API_NAMESPACE>`

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

Endpoint publico de vida:
- `GET /healthz`
