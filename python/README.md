# Python Secure Deploy

Sistema local de despliegue seguro con entorno virtual `.venv`.

## Que hace

- Compila el proyecto (`npm run build`).
- Crea releases versionadas en `python/releases/`.
- Genera manifiesto de integridad SHA-256 por release.
- Sirve `dist` por HTTPS local.
- Puede redirigir HTTP -> HTTPS.
- Puede iniciar la API Node (`server/index.js`) en local.
- Proxy `/api/*` del frontend a la API.
- Modo `watch`: recompila y despliega automaticamente cuando detecta cambios.
- Soporta rollback de release.

## Requisitos

- Python 3.10+
- Node.js 18+
- npm
- OpenSSL (solo para autogenerar certificado local si no existe)

## Uso rapido

Desde la raiz del proyecto (Windows recomendado):

```bash
python\run-secure-deploy.bat
```

El launcher principal (`python/run-secure-deploy.bat`) delega en `python/script/03-full.bat`.

## Carpeta `python/script`

Perfiles de arranque automatico (BAT, PowerShell y Shell):

- `01-setup.*`: crea/configura `.venv` e instala dependencias.
- `02-run.*`: prepara entorno y ejecuta deploy seguro sin `watch`.
- `03-full.*`: prepara entorno y arranca deploy completo con `watch`.

Todos llaman a `python/script/launcher.py`, que:

- Crea `python/.venv` si no existe.
- Actualiza `pip/setuptools/wheel`.
- Instala `python/requirements.txt`.
- Instala dependencias npm.
- Ejecuta `python/deploy_secure.py` con el Python del `.venv`.
- Muestra animaciones de progreso (spinner) durante setup.

Si quieres ejecutar manualmente:

```bash
python python/script/launcher.py full
```

URLs:

- Frontend HTTPS: `https://localhost:5443`
- Redirect HTTP: `http://localhost:5080` (si activado)
- API HTTPS: `https://localhost:4000` (si `--with-api --api-https`)

## Comandos

Build + release:

```bash
python python/deploy_secure.py build
```

Servir release actual:

```bash
python python/deploy_secure.py serve --with-api --api-https
```

Build + serve:

```bash
python python/deploy_secure.py full --with-api --api-https
```

Rollback:

```bash
python python/deploy_secure.py rollback --steps 1
```

## Certificados

- Certificado: `python/certs/localhost.crt`
- Clave: `python/certs/localhost.key`

Si no existen, el script intenta crearlos con OpenSSL automaticamente.
