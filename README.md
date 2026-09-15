# Contractor Compliance (EZForm module)

A simple EZForm module for contractor paperwork. Every company can work **both ways** from one account:

- **My contractors**: companies that work for you. You list what you need, they upload it, you approve it.
- **My clients**: companies you work for. You upload what each one asks for and keep it current, so nothing expires before they notice. A client that isn't on EZForm can be added by you; then you enter its list yourself and your uploads count straight away.

People belong to their own company, so they are **internal** to it. A client sees a contractor's people as **external** users.

It's its own Next.js app, served at **`/ez-contractor`**, and runs on an in-browser demo API until the ezformsapi controllers exist.

## Run it

```bash
cd contractor
npm install
npm run dev        # http://localhost:3040/ez-contractor
```

Data is saved in the browser. Use the **login menu** (top right) to switch company, and the **date menu** to move time forward or reset the data.

## Five-minute demo

1. **Priya Nair (Riverside Energy)**, a power plant that hires contractors.
   - **Home**: 3 uploads waiting for review, and what's expired or expiring.
   - **Contractors → Keystone Scaffolding**: review the insurance certificate, approve it or send it back with a note.
   - **Who can work**: Dana Brooks can't work because her heights training expired.
2. **Luis Ortega (Ortega Roofing)**, a contractor.
   - **Clients → Riverside Energy**: upload Priyanka's site orientation. It waits for Riverside to review.
   - Sign back in as Priya and approve it.
3. **Chen Wei (Delta Mechanical)**, which works both ways.
   - **Clients**: Riverside (on EZForm, reviews Delta's uploads) and Harbor Chemicals (not on EZForm, tracked by Delta itself). Harbor's insurance expires in 12 days, so Delta can renew it before Harbor notices.
   - **Contractors → Ironwood Welding**: Delta hires its own contractor.
4. Date menu → **+30 days**: items expire, and people are blocked in **Who can work**.

## How it works

| Record | What it is |
| --- | --- |
| Company | Name and contact. `on_ezform: false` for a client a contractor added itself |
| User | Someone who signs in for a company |
| Person | A member of a company's team. Tracked, gets a badge number, doesn't need to sign in |
| Requirement | Something a client asks for: for the company or for each person, with or without an expiry date |
| Link | Client ← contractor. `added_by: CLIENT` (the client reviews uploads) or `CONTRACTOR` (the contractor tracks the client itself) |
| Upload | A file for one link × requirement (× person): waiting, approved or sent back |

Rules, all in `src/mock/logic.ts`:

- A client's list applies to every contractor it adds. A self-tracked client has the list the contractor entered.
- Each checklist line is **Not uploaded**, **Waiting for review**, **Sent back**, **Done**, **Expiring soon** (30 days or less) or **Expired**.
- A new copy of something already approved waits for review while the old one keeps counting until it expires.
- A person **can work** when every company item and every one of their own items is done.

## Code map

```
src/
  app/                  / (home), contractors, requirements, check-in, clients, people
  components/           Checklist, upload/review/requirement/person modals, app shell
  services/queries.ts   React Query hooks + Api.* calls (Controller/Action names)
  api/client.ts         axios instance; uses the demo adapter unless NEXT_PUBLIC_USE_MOCK_API=false
  mock/                 demo API: logic.ts (rules), server.ts (routes), seed.ts (data), db.ts (storage)
```

## Moving to the real API

1. Build the endpoints in `src/mock/server.ts` in ezformsapi (`Contractor/*`, `Client/*`, `Requirement/*`, `Upload/*`, `Person/*`, `CheckIn/GetList`), wrapped as `{ data, message }`.
2. Set `NEXT_PUBLIC_USE_MOCK_API=false` and `NEXT_PUBLIC_API_BASE_URL`.
3. Replace the demo login menu with the host session, and map Users and People to EZForm internal/external users.
4. Store files with `File/Upload` instead of data URLs.

The earlier, fuller version (subcontractors, sites, requirement groups, exceptions, email reminders) is on the `full-demo` branch.
