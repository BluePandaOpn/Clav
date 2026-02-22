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

Endpoint publico de vida:
- `GET /healthz`
