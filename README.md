# n8n-nodes-hagbard

n8n community nodes for [Hagbard](https://hagbard.studio): new businesses before they open, from public records (sales-tax registrations, building permits, liquor-licence applications), in the counties of your Hagbard plan.

- **Hagbard Trigger**: starts a workflow when Hagbard finds a new business or a stage change (permit → registered → open). Filter by county and business type.
- **Hagbard**: Get Many (list with filters), Get (one business), Find by Name (name + city), Unlock (lifetime plans).

[Installation](#installation) · [Credentials](#credentials) · [Operations](#operations) · [Data](#data) · [Compatibility](#compatibility)

## Installation

In n8n: **Settings → Community Nodes → Install**, package name `n8n-nodes-hagbard`. See the [n8n community nodes docs](https://docs.n8n.io/integrations/community-nodes/installation/).

## Credentials

You need a Hagbard plan with API access (Solo, Team or Lifetime).

1. In Hagbard, open **Settings → API** and create a key (shown once).
2. In n8n, create a **Hagbard API** credential and paste the key.

n8n checks the key against `GET /api/v1/me`.

## Operations

| Node | Operation | API |
|---|---|---|
| Hagbard Trigger | New business, stage change, or both; Smart Trigger Matched (each new match of your Smart Triggers, or one of them; `GET /api/v1/triggers/rule-matched`) | `GET /api/v1/triggers/new-businesses` (polling) |
| Hagbard | Get Many | `GET /api/v1/businesses` (county, type, stage, first seen since; cursor pagination) |
| Hagbard | Get | `GET /api/v1/businesses/{id}` |
| Hagbard | Find by Name | `GET /api/v1/businesses/lookup?name=&city=` |
| Hagbard | Unlock | `POST /api/v1/businesses/{id}/unlock` (lifetime plans, uses one monthly unlock) |

Hagbard updates its data once a day (around 11:00 UTC), so a poll interval of one hour is plenty. Each trigger item has an `id` of the form `<business id>:<stage>` and is emitted once.

Full API reference: https://app.hagbard.studio/api/v1/openapi.json

## Data

Each business has: name, business type, stage and stage date, first seen, planned opening, address, city, ZIP, county, state, coordinates, a chain flag, one fact from the public records and the owner company (never a person). On lifetime plans, the fact and owner company are hidden until you unlock the business.

Phone numbers and websites are not part of the API.

## Templates

Ready-made workflows for the **Smart Trigger Matched** event in [`templates/`](templates) (import in n8n: Workflows → Import from File):

- `smart-trigger-to-slack.json`: post each match to a Slack channel
- `smart-trigger-to-google-sheet.json`: add one row per match to a Google Sheet
- `smart-trigger-to-hubspot-task.json`: create a HubSpot task per match (Hagbard can also do this itself: Smart Trigger action "create in my CRM")

Pick your credentials after the import. Set up the Smart Triggers themselves in Hagbard under Settings → Smart Triggers.

## Compatibility

Built with `@n8n/node-cli`, n8n nodes API version 1. No runtime dependencies.

## License

[MIT](LICENSE.md)
