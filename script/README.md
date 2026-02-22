# Script System

Carpeta de automatizacion con pipelines multiplataforma.

## Estructura

- `01-install.*`: instala dependencias.
- `02-dev.*`: arranca entorno de desarrollo.
- `03-quality.*`: lint y format check.
- `04-build.*`: build de produccion.
- `05-doctor.*`: diagnostico del entorno.
- `common.ps1`, `common.sh`: utilidades compartidas.

## Launchers raiz

- Windows: `start.bat [setup|dev|all]`
  - Usa `.ps1` si PowerShell esta disponible.
  - Si falla, usa fallback a `.bat`.
- Unix/macOS/Linux: `./start.sh [setup|dev|all]`
  - Ejecuta la pipeline `.sh`.

## Deploy Python seguro (opcional)

Para despliegue local HTTPS con auto-actualizacion y releases:

- Script: `python/deploy_secure.py`
- Bootstrap de entorno: `python/bootstrap_venv.py`
- Uso rapido (Windows): `python\run-secure-deploy.bat` (usa `python/.venv`)

## Perfiles

- `setup`: install + quality + build + doctor.
- `dev`: install + dev.
- `all`: ejecuta los 5 pasos.
