# Coolify y Cursor Cloud Agents (Sygos)

Guía para que un **Cloud Agent** pueda disparar despliegues de Sygos en **Coolify** sin guardar secretos en el repositorio.

La skill del repo está en `.cursor/skills/coolify-deploy/SKILL.md`. El script auxiliar es `scripts/coolify-deploy.sh`.

## Suposiciones

- No hay referencias a Coolify en el código de Sygos; la configuración del application (repo Git, rama, variables, dominio) está en tu instancia Coolify.
- El agente **no** crea el recurso: solo valida la API y llama a **deploy** con el UUID que configures en secrets.
- Patrón API según [documentación oficial de Coolify](https://coolify.io/docs/api/making-requests) (`POST /api/v1/deploy`, Bearer token).

## Secrets en Cursor

En **Dashboard → Cloud Agents → Environments → [tu entorno] → Secrets** (o equivalente al vincular el repo), define:

| Secret | Requerido | Descripción |
| --- | --- | --- |
| `COOLIFY_URL` | **Sí** | URL pública de tu instancia, sin barra final. Ej.: `https://coolify.ejemplo.com` o la URL de [Coolify Cloud](https://app.coolify.io) si aplica. |
| `COOLIFY_TOKEN` | **Sí** | Token API creado en Coolify (**Keys & Tokens → API Tokens**) con permiso mínimo **`deploy`**. Se envía como `Authorization: Bearer …`. |
| `COOLIFY_APP_UUID_STAGING` | Opcional* | UUID del application/service de **staging** en Coolify. |
| `COOLIFY_APP_UUID_PRODUCTION` | Opcional* | UUID del application/service de **producción**. |
| `COOLIFY_APP_UUID` | Opcional | UUID por defecto si no usas flags `--staging` / `--production`. |
| `COOLIFY_DEPLOY_WEBHOOK` | Opcional | URL completa del webhook de deploy del recurso (alternativa al POST JSON). |

\*Al menos un UUID (o el webhook) es necesario para desplegar; sin ellos el script solo puede verificar la API.

### Dónde obtener el UUID

1. Abre el **application** de Sygos en Coolify.
2. En **Webhooks**, la URL de deploy suele incluir `uuid=<valor>`.
3. O copia el identificador desde la URL o detalle del recurso en la UI (formato alfanumérico de Coolify).

### Self-hosted: API habilitada

En instancias propias, confirma **Settings → Advanced → API Access** activado.

## Red y egress

| Escenario | Qué configurar |
| --- | --- |
| Coolify con HTTPS público | Asegura que el entorno del agente permita salida HTTPS al hostname de `COOLIFY_URL`. |
| Egress restringido en Cursor | Añade el dominio de Coolify a la **allowlist** del environment. |
| Coolify solo en red local | Un Cloud Agent en la nube **no** alcanzará la API; usa URL/túnel público, **self-hosted worker** en la misma red, o despliegue manual desde tu red. |

## Verificar conectividad (desde un agente)

Con los secrets ya cargados en la sesión:

```bash
curl --fail-with-body -sS \
  --header "Authorization: Bearer ${COOLIFY_TOKEN}" \
  --header "Accept: application/json" \
  "${COOLIFY_URL%/}/api/v1/teams/current" | jq .
```

- **Éxito (`200`)**: JSON con el team asociado al token → listo para `--dry-run` del script.
- **`401`**: token inválido o revocado.
- **Timeout / DNS / connection refused**: revisar URL, firewall y política de egress del environment.

Dry-run de deploy (sin efectos):

```bash
bash scripts/coolify-deploy.sh --dry-run --production
# o --staging, o --uuid '<tu-uuid>'
```

## Despliegue real

Solo después de que el usuario apruebe el dry-run:

```bash
bash scripts/coolify-deploy.sh --execute --production
```

## Qué puede faltar respecto a tu skill local de IDE

Si tu skill local incluye pasos que **no** están en este repo, configúralos manualmente o amplía la skill:

- Comando de build/start exacto en Coolify (Prisma `db push`, seed en `npm start`, etc.).
- Variables de entorno del application (`DATABASE_URL`, claves de integración).
- Despliegue por **tag** en lugar de UUID (`tag=` en la API).
- Preview deployments (`pull_request_id` en la API).
- Pasos post-deploy (smoke test URL, notificación Slack).

Pega esos pasos en el chat del agente o añade una sección en la skill del repo cuando los tengas estables.

## Referencias

- [API Tokens](https://coolify.io/docs/core/security/credentials/api-tokens)
- [Deploy endpoint](https://coolify.io/docs/api/endpoints/deployments/deploy-by-tag-or-uuid)
- [Deploy webhooks](https://coolify.io/docs/core/automation/deploy-webhooks)
