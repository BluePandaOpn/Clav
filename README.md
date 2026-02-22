# Password Manager Pro

Gestor de passwords profesional con:
- Frontend en React + Vite
- Backend en Node.js + Express
- Multiples paginas (Dashboard, Vault, Generator, Settings)
- Persistencia en archivo JSON (`server/data/vault.json`)

## Requisitos

- Node.js 18+
- npm 9+

## Instalacion

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

Servicios:
- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`

## Build

```bash
npm run build
npm run preview
```

## Endpoints API

- `GET /api/health`
- `GET /api/credentials`
- `POST /api/credentials`
- `PUT /api/credentials/:id`
- `DELETE /api/credentials/:id`
- `DELETE /api/credentials`
- `POST /api/generate`
- `GET /api/export`
