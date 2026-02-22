# AI Security Review

Guia para que una IA (o auditor humano) revise vulnerabilidades y calidad del codigo de todo el proyecto.

## 1. Alcance obligatorio

Revisar de punta a punta:

- `server/` (API, auth, permisos, crypto, persistence, schedulers).
- `src/` (hooks de seguridad, estado, UI sensible, offline/sync).
- `browser-extension/` (autocompletado y permisos del navegador).
- Configuracion: `.env.example`, `package.json`, `vite.config.js`, `eslint.config.js`.

## 2. Objetivo de la auditoria

Detectar riesgos explotables y deuda critica:

- Broken access control.
- Cryptographic failures.
- Exposure of secrets.
- Input validation gaps e inyecciones.
- Race conditions y data integrity bugs.
- Flaws en offline/sync/shared/emergency/qr.

## 3. Como usar esta guia con una IA

### Paso A: dar contexto

Pasar al modelo:

- Este archivo (`docs/AI_SECURITY_REVIEW.md`).
- `docs/SISTEMA_COMPLETO.md`.
- Arbol del repo (`rg --files`).

### Paso B: pedir auditoria

Prompt sugerido:

```text
Actua como security reviewer senior.
Audita TODO el repositorio con foco en OWASP Top 10, crypto, access control y data integrity.
Entrega findings por severidad (Critical, High, Medium, Low), con archivo y linea.
Incluye exploit path, impacto y fix concreto.
No des texto generico.
```

### Paso C: exigir formato estricto de salida

Formato esperado por finding:

1. `Severity`: Critical/High/Medium/Low
2. `Title`
3. `Evidence`: `ruta/archivo:linea`
4. `Impact`
5. `Exploit scenario`
6. `Fix`
7. `Test recomendado`

## 4. Checklist tecnico por prioridad

### Critical

- Endpoints sensibles sin auth o sin autorizacion valida.
- Bypass de permisos en shared vault o emergency access.
- Exposicion de passwords/secrets en logs o respuestas API.
- Reuso de token QR o tokens sin expiracion fuerte.
- Uso incorrecto de crypto (nonce reuse, key handling inseguro).

### High

- Validaciones de payload insuficientes.
- Falta de checks de integridad en rutas de update/delete.
- Problemas de concurrencia en store/sync.
- Riesgos de replay en sincronizacion.

### Medium

- Manejo de errores con leakage de detalles internos.
- Falta de hardening adicional en endpoints de alto impacto.
- Falta de limites de operacion en flujos de import/export.

### Low

- Inconsistencias de logging y observabilidad.
- Deuda tecnica que complica auditorias futuras.

## 5. Comandos utiles para la auditoria

```bash
npm run lint
npm run build
rg -n "password|secret|token|key|encrypt|decrypt|sign|verify|auth|permission|shared|emergency|offline|sync|qr" src server browser-extension
rg -n "TODO|FIXME|HACK" src server browser-extension
```

## 6. Auditoria enfocada por modulo

- `server/index.js`: rutas, middlewares y controles de acceso.
- `server/store.js`: operaciones criticas de datos e integridad.
- `server/multilayer-crypto.js`: cifrado y lifecycle de material sensible.
- `server/entry-signature.js`: firma/verificacion en alta, update y lectura.
- `src/hooks/useCredentials.js`: cola offline, merge, retry, sync.
- `src/hooks/useVaultSecurity.js`: estado de bloqueo y manejo de password maestra.
- `browser-extension/*`: acceso a credenciales y proteccion de datos en cliente.

## 7. Criterio de salida minima

Una auditoria NO esta completa si no incluye:

- hallazgos con evidencia real,
- severidad razonada,
- impacto explotable,
- fix implementable,
- test de regresion propuesto.

## 8. Flujo de remediacion recomendado

1. Corregir todo `Critical`.
2. Corregir todo `High`.
3. Agregar tests de regresion.
4. Re-ejecutar auditoria completa.
5. Registrar cambios en `docs/SISTEMA_COMPLETO.md`.

## 9. Nota para equipos

Este documento esta pensado para auditorias periodicas (por release o sprint). Recomendado: ejecutar al menos una auditoria completa antes de cada release de produccion.
