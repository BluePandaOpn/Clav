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

- Windows: `start.bat [auto|setup|dev|all]`
  - Usa `.ps1` si PowerShell esta disponible.
  - Si falla, usa fallback a `.bat`.
- PowerShell: `start.ps1 -Profile auto|setup|dev|all`
- Unix/macOS/Linux: `./start.sh [auto|setup|dev|all]`
  - Ejecuta la pipeline `.sh`.
  - En `auto`, termina install/quality/build/doctor y arranca deploy seguro Python.

## Deploy Python seguro (opcional)

Para despliegue local HTTPS con auto-actualizacion y releases:

- Script: `python/deploy_secure.py`
- Bootstrap de entorno: `python/bootstrap_venv.py`
- Uso rapido (Windows): `python\run-secure-deploy.bat` (usa `python/.venv`)
- Uso rapido (PowerShell): `.\python\run-secure-deploy.ps1`
- Uso rapido (Unix): `./python/run-secure-deploy.sh`
- Perfiles cross-shell: `python/script/01-setup.*`, `python/script/02-run.*`, `python/script/03-full.*`

## Auto-reparacion / actualizacion

Si el launcher detecta errores de pipeline en `setup/auto`, ejecuta una reparacion automatica y reintenta:

- Windows CMD: `update.bat`
- PowerShell: `update.ps1`
- Unix: `update.sh`

La reparacion sincroniza desde `origin` (repo oficial) y aplica reset hard + clean.

## Perfiles

- `auto`: install + quality + build + doctor + arranque Python seguro.
- `setup`: install + quality + build + doctor.
- `dev`: install + dev.
- `all`: ejecuta los 5 pasos.
