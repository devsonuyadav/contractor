# Contractor Compliance (EZForm module)

A standalone EZForm module for managing contractor companies, their compliance requirements, reviews and site access. It follows the same pattern as the MOC module (`workflow/`, served at `/ez-workflow`): its own Next.js app, served at **`/ez-contractor`** on the same host so it shares the login cookie.

Until the ezformsapi controllers exist, the app runs on an **in-browser demo API** with seeded data for three companies that run contractor programs. One of them, Delta Mechanical, is also a contractor for the other two.

## Run it

```bash
cd contractor
npm install        # or reuse node_modules from containers/ (same versions)
npm run dev        # http://localhost:3040/ez-contractor
```

Everything is saved in the browser's localStorage. Use the **date menu** in the header to move time forward (runs the nightly renewal/reminder/expiry check) or to reset the demo data. Use the **login menu** (top right) to sign in as someone from any company.

## Five-minute demo

1. **Overview** (admin): status donut, "Waiting on you", recent activity, what's expiring.
2. **Review queue** → open *Keystone Scaffolding · Certificate of Liability Insurance* → approve, or send back with a note.
3. **Contractors → Ortega Roofing** → workers tab: Dana is blocked (course expired), Priyanka is new. Click **View as Luis**.
4. **Contractor portal** (Luis): renew the insurance certificate (upload + expiry date), have Priyanka take *Working at Heights* (slides + quiz, auto-approved), ask for an exception on Dana's course.
5. Back as **Priya Nair**: grant the exception in the review queue, then **Gate check-in** → scan `ORT-1002`: Dana is now clear.
6. **Requirements**: create a requirement (Form, Document, Training or Policy signoff), edit a group, see the version warning.
7. Date menu → **+30 days**: renewals open, reminder emails appear under **Emails & reminders**, lapsed items turn red and block at the gate.

### One company on both sides

8. Sign in as **Chen Wei (Delta Mechanical)**. The sidebar has *Your contractors* (Delta's own program for Ironwood Welding and Kestrel Insulation) and *Your clients* (Northwind Utilities and Riverside Energy).
9. **Workers**: one roster for Delta. Expand Jonas Berg and **Put on crew** for Riverside Energy; Riverside's worker trainings are assigned to him only.
10. Still as Chen: **Review queue → Subcontractor checks**. Ironwood Welding is Delta's subcontractor on Riverside's turbine shutdown, so its workers' comp certificate comes to Delta first. **Pass to Riverside Energy**.
11. Sign in as **Sean Doyle (Ironwood Welding)** → *Riverside Energy*. The checklist is Delta's Riverside requirements minus the ones Riverside keeps for direct contractors (the prequalification questionnaire). Open *Certificate of Liability Insurance* → **Use this copy** sends the certificate Delta approved; it goes to Delta to check.
12. Back as **Priya Nair**: Ironwood shows as *Subcontractor of Delta Mechanical Services*. Review the certificate Delta passed on, then **Approve subcontractor**. At **Gate check-in**, `IWF-1001` clears at the Turbine Hall only while Riverside approves Delta, Delta approves Ironwood, and Riverside approves Ironwood.
13. **Add contractor** → type "kest" → Kestrel Insulation is already on EZForm, so you add the existing company instead of creating a second one.
14. Any contractor-only login (for example Luis Ortega) → **Manage your own contractors** → **Request access**. Managing your own contractors is a paid EZForm feature, so it waits for EHSSoftware.io.
15. Sign in as **Sam Rivera (EHSSoftware.io)** → **Subscriptions** → **Approve** Ortega Roofing. Sign back in as Luis: the program screens are there, with a starter library.

## How it works

A company is never "a client" or "a contractor". It is an **organization**, and the role belongs to each **relationship** between two organizations. The same company can run its own program and work for other companies from one account.

| Record | Owned by | What it is |
| --- | --- | --- |
| Organization | itself | Company profile and contact, shared with every client. `program_enabled` turns on the client side |
| Member | organization | A login. One member acts on both sides of their company |
| Worker | organization (employer) | One roster and one badge ID, valid at every client |
| Requirement, group, site | organization (as client) | Its program. Other companies never see or reuse it |
| Relationship | client org → contractor org | Status (New, Pending, Approved, Denied), sites, groups, tags, and the **crew** (which of the contractor's workers work for this client). `sponsor_id` marks a subcontractor brought in by another contractor |
| Assignment | relationship | One row per relationship × requirement (× crew member): current approval, open submission, exception, history |

Access follows the relationship, not a role: every route checks whether the signed-in company is the client or the contractor on that record (`asClient` / `asContractor` in `src/mock/server.ts`).

Working **as a contractor** is free, because the client that invited you pays for it. Running **your own program** needs an EHSSoftware.io subscription: a company asks from `/setup`, and EHSSoftware.io staff (the Sam Rivera login) turn it on from **Subscriptions**. Turning it on the first time fills a starter library; turning it off hides the program screens but keeps everything, so turning it back on restores it.

Rules (all in `src/mock/logic.ts`):

- **Snapshots.** An assignment keeps the requirement version it was opened against. Editing the library updates only items nobody has started; everything else picks up the new version at its next renewal.
- **Renewals.** 30 days before an approval expires, a renewal opens and the contractor gets a reminder (again at 7 days). The old approval keeps counting until it actually expires.
- **Review.** Documents and forms go to a reviewer; training and signoffs count as soon as they're completed (configurable per requirement).
- **Exceptions.** A contractor can ask for a waiver until a date; if granted, the item counts as compliant until then.
- **Score.** Approved-and-unexpired (or waived) scored items ÷ scored items, separately for the company and for its workers.
- **Gate.** A worker is cleared at a site only if the site's owner has a relationship with the worker's employer, the worker is on that crew, the contractor is Approved and assigned to the site, and every scored company item and every scored item of that worker is compliant.
- **Crews.** Worker requirements go only to the crew for that client. Taking someone off a crew, or deactivating them, keeps their records so they come back intact.
- **Shared identity.** Adding a contractor searches the EZForm directory first, so a company already on the platform is linked rather than duplicated. Its profile edits reach every client.
- **Reuse.** A document requirement can reuse a copy another client already approved (same title, not expired). The server copies the approved evidence and the new client still reviews it.
- **Flow-down.** A contractor brings one of its own approved contractors onto a client's work (*Your subcontractors here* on its client page). That creates a client → subcontractor relationship sponsored by the contractor's relationship with the same client:
  - Requirements: the sponsor's groups plus the subcontractor's sites' groups, minus requirements the client marks *direct contractors only* (`flows_down: false`, a setting that doesn't bump the version). Groups the client assigns to the subcontractor directly always apply. Changes to the sponsor's groups or sites flow down; a subcontractor can only be on the sponsor's sites.
  - Review: submissions that need review go to the sponsor first (*Subcontractor checks* in its review queue), then to the client. The client can review before the sponsor has checked; the history records it.
  - Gate: the subcontractor's worker clears only if the client approves the sponsor and has it on that site, the sponsor still approves the subcontractor in its own program, the sponsor's scored company items are compliant, and the subcontractor's own record passes the usual checks.
  - One tier only: a subcontractor can't bring in its own subcontractors yet.

## Code map

```
src/
  app/                  client side: the company's own program (dashboard, contractors, reviews, requirements, sites, gate, emails)
  app/portal/           contractor side: all clients, clients/[id] checklist, item/[id], workers roster, profile, inbox
  app/setup/            turn on the client side for a company that only works for others
  components/           shared UI, review modal, editors, portal completion screens
  services/queries.ts   React Query hooks + Api.* calls (Controller/Action names)
  api/client.ts         axios instance; uses the demo adapter unless NEXT_PUBLIC_USE_MOCK_API=false
  mock/                 demo API: logic.ts (rules), server.ts (routes), seed.ts (data), db.ts (storage)
  lib/                  types, dates, labels, form validation
```

## Moving to the real API

The screens only call `Api.*` / `apiGet('Controller/Action')`, using the endpoint names proposed in the build plan (`Contractor/*`, `ComplianceRequirement/*`, `RequirementGroup/*`, `Site/*`, `Assignment/*`, `ComplianceActivity/GetList`, `Notification/GetOutbox`, `Gate/*`). When the .NET controllers ship:

1. Set `NEXT_PUBLIC_USE_MOCK_API=false` and `NEXT_PUBLIC_API_BASE_URL` (defaults to `/ezformsapi/api/v1/`).
2. Implement the rules in `src/mock/logic.ts` server-side; responses are wrapped as `{ data, message }` like the rest of ezformsapi.
3. Replace the demo login menu with the host session (the other apps rely on the host's cookie; `NEXT_PUBLIC_AUTH_TOKEN` is a dev-only fallback).
4. Swap stored data URLs for `File/Upload` keys.
5. Add the module to the server menu (`Menu/GetXmlMenus`) and the `/ez-contractor` path to the host.

## EZForm extension points

- **Form requirements** can name an EZForm template (`ezform_template_id`). Once wired, contractors fill that template (stages, submit rules) and the finished record becomes the evidence.
- **Gate check-in** mirrors the Scan User field; the same compliance check can run inside EZForm site sign-in forms.
- **Submit rules** can gain a "contractor compliance" value source so permits refuse to submit for a non-compliant contractor.
