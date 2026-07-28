# n8n-nodes-praxicraft-assess

[n8n](https://n8n.io) community node for **[Praxicraft Assess](https://docs.praxicraft.com)** — invite candidates, fetch results, manage pipelines and interviews, and react to signed webhooks. Thin wrapper over the Assess [Public API](https://docs.praxicraft.com/authentication).

Product docs: [n8n setup](https://docs.praxicraft.com/n8n) · [Automations](https://docs.praxicraft.com/automations) · [Webhooks](https://docs.praxicraft.com/webhooks)

## Install

### Community nodes UI

1. Open n8n → **Settings → Community nodes → Install**
2. Enter package name:

```text
n8n-nodes-praxicraft-assess
```

3. Confirm. Restart n8n if your host requires it.

### npm (self-hosted)

```bash
cd ~/.n8n
npm install n8n-nodes-praxicraft-assess
```

Enable community packages per [n8n’s installation docs](https://docs.n8n.io/integrations/community-nodes/installation/).

## Credentials

Add **Praxicraft Assess API**:

| Field | Value |
|-------|--------|
| **API Key** | `ct_live_…` from [Assess → Developer → API Keys](https://assess.praxicraft.com/assess/api) |
| **Base URL** | `https://assess.praxicraft.com` (default; override for staging) |

Credential test calls `GET /api/v1/public/org/` (needs `organisation:read` or full access).

### Recommended scopes

| Use case | Scopes |
|----------|--------|
| Invite + result webhooks | `assessments:read`, `invitations:write`, `candidates:read`, `webhooks:write` |
| Pipeline enroll | `pipelines:read`, `pipelines:write`, `webhooks:write` |

## Nodes

### Praxicraft Assess Trigger

Starts a workflow when Assess delivers a signed webhook.

1. Select events (for example `assessment.completed`, `candidate.passed`).
2. **Activate** the workflow. The node registers its webhook URL with Assess, sends a test ping, and verifies `X-Praxicraft-Signature`.
3. **Deactivate** deletes the Assess webhook endpoint.

Supported events include assessment, candidate, invitation, pipeline, and interview lifecycle events. See [Webhooks](https://docs.praxicraft.com/webhooks).

### Praxicraft Assess (actions)

| Resource | Operations |
|----------|------------|
| Assessment | List, Get, Create, Update, Duplicate, List Results, List/Attach/Replace/Remove Cases |
| Case | List, List Platform Cases, Create, Get, Update, Delete |
| Invitation | List, Invite, Bulk Invite, Get, Get Result, Remind, Cancel |
| Pipeline | List, Get, Enroll, Bulk Enroll, List/Get Enrollment, Reject, Hold, Unhold |
| Webhook | List, Create, Get, Update, Delete, List Deliveries, Test |
| Organisation | Get, Stats, List Team, Squads, Audit Log |
| Interview | List, Create, Bulk Create, Get, Cancel, Reschedule, Analysis, Replay, Share, Templates, … |
| Integration | List, Get Connect URL, Test |

Create/update operations accept a **Body (JSON)** field matching the Public API. Responses are flat JSON.

#### Example: invite a candidate

1. Resource **Invitation** → **Invite**
2. Set assessment slug, email, optional name
3. Enable **Send Email** if Assess should mail the invite link

#### Example: act on completion

1. Trigger on `assessment.completed` (payload includes `invite_token`)
2. Action **Invitation → Get Result** with that token (`candidates:read`)

## Development

```bash
git clone https://github.com/praxicraft-platform/n8n-nodes-praxicraft-assess.git
cd n8n-nodes-praxicraft-assess
# --ignore-scripts: n8n-workflow pulls isolated-vm; we only need TypeScript types
npm ci --ignore-scripts
npm test
npm run build
```

## Release

Version tags (`v*`) trigger GitHub Actions to publish to npm with provenance:

```bash
# bump version in package.json, then:
git tag v0.2.0
git push origin v0.2.0
```

Requires npm Trusted Publishing for this repository (or `NPM_TOKEN` secret).

## License

[MIT](./LICENSE)
