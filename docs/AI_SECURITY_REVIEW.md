# AI Security Review Guide

Guia para que una IA (o auditor tecnico) revise vulnerabilidades y calidad del codigo de este proyecto completo.

## 1. Alcance de la revision

Revisar todo el repo:
- `server/` (API, auth, cifrado, storage, schedulers).
- `src/` (UI, seguridad cliente, manejo offline, sync).
- `browser-extension/` (si aplica en auditoria).
- configuraciones, dependencias y flujos de datos sensibles.

## 2. Objetivos de seguridad

Detectar:
- Broken access control.
- Exposicion de secretos.
- Criptografia insegura o mal usada.
- Inyecciones y validacion insuficiente.
- Riesgos de sincronizacion/offline y conflictos de datos.
- Errores de logica en emergency/QR/shared vault.
- Riesgos de privacidad (filtrado de datos en logs/eventos).

## 3. Checklist tecnico (prioridad)

### Critico
- Endpoints sin control de identidad/autorizacion real.
- Bypass en `shared vault` y `emergency access`.
- Reuso/aceptacion de token QR ya consumido.
- Exportacion o logs que incluyan passwords en claro.
- Claves privadas persistidas sin proteccion suficiente.

### Alto
- Validaciones de entrada incompletas.
- Condiciones de carrera en store/schedulers.
- Errores de expiracion temporal (`TEMPORARY`, emergency timeout).
- Integridad de firma no aplicada en todos los paths.

### Medio
- Falta de controles anti abuso (rate limit por endpoint sensible).
- Manejo de errores que filtre detalles internos.
- UX que permita acciones peligrosas sin confirmacion.

### Bajo
- Deuda tecnica, duplicidad, inconsistencias de naming.
- Falta de documentacion de decisiones de seguridad.

## 4. Prompts sugeridos para IA (copiar/pegar)

### Prompt 1: Auditoria OWASP completa
```text
Revisa este repositorio como auditor senior de seguridad.
Prioriza OWASP Top 10, cryptographic failures, access control y exposure of secrets.
Entrega findings ordenados por severidad con archivo y linea.
No describas arquitectura; enfocate en riesgos explotables y fixes concretos.
```

### Prompt 2: Revisar permisos y control de acceso
```text
Analiza endpoints de server/index.js y logica en server/store.js.
Busca bypass de permisos en shared vault, emergency access y operaciones de credenciales.
Enumera casos de abuso posibles y parches minimos.
```

### Prompt 3: Revisar criptografia y secretos
```text
Audita todo uso de crypto en server/ y src/hooks/useVaultSecurity.js.
Verifica algoritmos, manejo de claves, firma, token lifecycle y almacenamiento de material sensible.
Marca debilidades y propuestas de endurecimiento.
```

### Prompt 4: Revisar modo offline y sincronizacion
```text
Evalua useCredentials.js y flujos sync SSE/WS.
Busca perdida de datos, operaciones duplicadas, corrupcion de estado, replay y conflictos.
Propon tests y cambios para hardening.
```

## 5. Comandos recomendados de soporte

```bash
npm run lint
npm run build
rg -n "TODO|FIXME|password|token|secret|private|sign|verify|emergency|shared|offline|sync" src server
```

## 6. Resultado esperado de una buena auditoria

Debe incluir:
- Lista de vulnerabilidades con severidad (`Critical/High/Medium/Low`).
- Evidencia con referencia de archivo/linea.
- Impacto real y escenario de abuso.
- Patch recomendado (tecnico, no generico).
- Riesgos residuales y tests faltantes.

## 7. Politica de correccion sugerida

1. Corregir `Critical`.
2. Corregir `High`.
3. Agregar tests de regresion.
4. Re-ejecutar auditoria.
5. Documentar cambios en `docs/README.md`.

