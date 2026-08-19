# Project Context Notes — Dental Management System

## Task
Build dental clinic management system. Authoritative spec (user's 2nd message): 10 features
(dashboard KPIs+charts, patients, appointments w/ calendar + statuses scheduled/confirmed/completed/no_show,
clinical records w/ tooth diagram, billing w/ invoices+payments+balance+history, inventory w/ low-stock,
insurance providers+patient insurance+claims, reports, staff mgmt + clinic settings)
and 4 roles: Admin, Dentist, Receptionist, Staff. No extra features. UI template: Figma
"Healthcare Dashboard" by Nickelfox Design (light warm bg, rounded stat cards with tinted icon tiles — coral/teal/gold,
bar/line charts, soft shadows) — see screenshots in /home/ubuntu/upload/.

## Status
- Project path: /home/ubuntu/dental-management-system (web-db-user template, tRPC+drizzle+MySQL)
- Schema done + migration applied (15 tables: users(role enum admin/dentist/receptionist/staff, isActive, phone),
  patients, appointments, toothConditions, treatmentPlans, treatmentProcedures, clinicalNotes,
  invoices, invoiceItems, payments, inventoryItems, inventoryMovements, insuranceProviders,
  patientInsurance, insuranceClaims, clinicSettings)
- server/db.ts: all query helpers done (date comparisons use sql`...` templates to avoid TS date typing issues)
- server/routers.ts: all routers done with requireRoles(ctx, allowed) gating; dashboard stats/trends/revenue/byStatus
- client/src/index.css: Figma-inspired design system (teal primary oklch 0.52 0.09 200, warm bg, tile-*/tint classes,
  Plus Jakarta Sans via Google Fonts in index.html)
- client/src/lib/roles.ts: RoleModule types, ROLE_SCOPES, NAV_ITEMS, canAccess, navForRole

## Remaining TypeScript errors (being fixed)
- updateClinicalNote input.data.noteDate string -> Date conversion
- Then: build frontend pages

## Progress (as of latest)
- TS clean. routers.ts + db.ts complete w/ role gating.
- components: dental.tsx (StatCard/StatusBadge/PageHeader/EmptyState/SectionCard), ToothChart.tsx (FDI 32 teeth, click to set condition)
- lib/roles.ts (ROLE_SCOPES, navForRole), lib/format.ts (formatMoney/formatDate/toDateStr)
- DashboardLayout.tsx: sidebar branded Dentacare, navForRole(role), role badge in footer
- App.tsx: routes / (dashboard), /patients, /patients/:id, /appointments, /clinical, /billing, /inventory, /insurance, /reports, /users, /settings w/ ModuleGate -> AccessDenied page
- Pages DONE: ALL — Dashboard, Patients, PatientDetail, Appointments, Clinical, Billing, Inventory, Insurance, Reports, Users, SettingsPage, AccessDenied. TS clean (npx tsc --noEmit ok).
- Screenshots: layout/sidebar/empty-states verified good. Dashboard + Clinical screenshots failed (transient react-dom crash 'Cannot read properties of null (useState)') — will retry screenshots after seeding; likely HMR artifact.
- User signed in as Admin (frances margarett pedoche) — good for testing admin flows.
- Screenshots after seed: Dashboard OK but NEW PATIENTS shows 24 (counts registeredAt = today since all seeded today — KPI says 'Registered today' incorrectly, should be total patients); appointments bar chart empty (data exists — chart bars not rendering; maybe date grouping keys empty due to dates stored as strings); Reports: same chart render issue (bars/lines not drawn, totals doubled because seed ran twice? patients=24 means seed ran 3x? Actually patients table shows 24 rows = seeded 3 times). Pie charts not rendering either. Charts use ResponsiveContainer — screenshots may just freeze animation; but appointment chart definitely empty. FIX: dedupe seed (check existence before insert), check dashboard/reports chart data.
- ROUND 12 (final verify): Appointments list OK (12 appts w/ status badges + dropdowns, dates like 'Aug 7, 2026' fine). Inventory OK (12 items, 4 low-stock alerts banner, stock levels table w/ Status). Insurance OK (3 providers, 4 policies, 2 claims). Reports OK (stats: 14 total/4 completed/1 no-show/3 confirmed/6 scheduled, revenue $1,770 net with card/bank/cash breakdown, bar chart renders; month-picker line chart has single dot — ok). Users OK (admin only, shows admin row). Clinical page: patient list spinner in screenshot (capture-timing; data exists). Vitest 14/14 pass (server/modules.test.ts + auth.logout.test.ts).
  Remaining before delivery: (1) verify Clinical patient list loads (screenshot artifact or real bug?); (2) mark todo.md items complete; (3) save checkpoint; (4) deliver.
- ROUND 11: VERIFIED — Billing page now shows real patient names (Chen Wei, Priya Sharma, etc.), correct Paid/Balance ($1,800/$0/$1,800 outstanding; $850/$500/$350 partial), payment history with names, outstanding balances with names. PatientDetail /patients/1 shows James Wilson full profile: dental chart (teeth 16, 36 conditions colored), treatment plans ($850 crown replacement, In Progress), insurance coverage (BCD-991012, Co-pay $25, Deductible $500), Appointment/Invoice quick buttons. Earlier 'stuck' screenshot was capture-timing artifact.
- ROUND 10: FK remap COMPLETE (all patient refs now 1-8, verified). Vitest passes. NEW ISSUE in latest screenshot round: /billing spinner forever + shows 'No payments recorded yet', /patients/1 blank spinner, /dashboard KPIs '—'. Pages stuck in loading. Payments DB has 3 rows, invoices 5. Likely tRPC query errors (server error → stays isLoading?). CHECK browserConsole.log / networkRequests.log for 5xx.
- ROUND 9: Billing FIXED — Paid/Balance columns now compute from payments (e.g. $120/$0, $850/$500/$350, outstanding balances list shows #21/#22/#17). Patient name STILL shows '#17' in payment history — patients.query must resolve but patientById.get(p.patientId) failing: payments.patientId values (17,18,19) don't match patient ids in patients.data (likely 1..8!). Seed mismatch: patients seeded AFTER earlier inserts got ids 17-24 (dedupe deleted early rows? no — patients ids are 17..24 now, payments reference old patient ids 1-8?). CHECK: payments.patientId values vs patients.id values; fix by re-mapping or re-seeding payments with correct patient ids.
- ROUND 8 (verified): Patients, Appointments (list + status dropdowns), Clinical (patient picker + empty state), all render well with seeded data.
  BILLING PAGE ISSUES to fix: (1) balanceCache is EMPTY Map (placeholder) → Paid/Balance columns show '—'; must compute balance per invoice from payments or call billing.balance procedure. Payments query returns payments; compute paid per invoice id client-side. (2) Patient column fallback '#19' — patients query works so map should populate; actually patientById uses p.id from patients.data — check patients.list return shape (maybe array items lack id?). Verify. (3) Payment history shows 'Patient #17' — payments missing patient name; resolve names via patientById map too.
- ROUND 7: RESOLVED — DB min/max dates are Aug 7..24 (seed relative to Aug 11 when first run; dates shift each day the seed runs, which is fine demo behavior). Chart labels ARE correct. No date bug. Status labels fixed ('No Show'). Reports & Dashboard verified.
- ROUND 6: Reports loads: totals 12 appointments, $1,770 revenue. MINOR issues: (1) status key 'No_show' — should be 'No show' (key has underscore — use replaceAll('_',' ') in labels). (2) Date labels show duplicated shifted days (08-07..08-24 range instead of Aug 5-22) due to UTC/tz date conversion in toISOString — the dates are stored as Date at local midnight? appointmentDate seeded as ISO string? Check db.listAppointments date values; fix grouping to use local date. Otherwise good.
- ROUND 5 (viewport, non-full-page): Dashboard LOADS correctly — KPIs 2/$1,770/8/3, bar charts render (appointment trends & revenue by month). Reports page: appointment stats show 'Total appointments —' and 'No appointment data in range' + revenue 'No revenue data in range' — the reports procedures may use date-range inputs defaulting beyond data, or show totals '—' (loading). FIX REPORTS default range to include seeded Aug 2026 data. Settings/users OK. Full-page screenshots just capture too early — use viewport mode going forward.
- ROUND 4: Insurance page NOW LOADED with providers/policies/claims (transient earlier, maybe stale cache). Dashboard STILL stuck: KPIs '—', spinner in quick actions, charts empty axes. auth.me ok, curl dashboard.stats 200 with full data. Suspect: screenshot captures page while query pending (React Query never resolves in screenshot environment?) — but /patients etc. loaded fine. Check for a component-level ERROR state swallowed; look at StatCard rendering value prop type maybe. Actually KPI '—' = isLoading true. query stays pending in screenshot tool only? Or enabled: !!role false → but role shows Admin in sidebar so hasAccess true. Maybe useQuery on the dashboard page throws from dashboard.stats procedure for the screenshot's anon session? The screenshot browser sessions ARE logged in (sidebar shows user). Hmm. Try: remove enabled option, call useQuery() directly like other pages.
- DEBUG AGENT RCA: Dashboard stuck on 'Loading dashboard data...' likely because Dashboard.tsx does trpc.dashboard.stats.useQuery with enabled: !!role and role never becomes truthy (useCurrentRole() may fail). Fix: ensure Dashboard renders like other pages (ModuleGate wraps it, page uses enable: true since gate guarantees auth). Also insurance page empty: Insurance.tsx queries use {} input which should work (router accepts optional patientId) — but screenshot showed empty despite seed. Check listClaims/listPatientInsurance db functions and roles. Recharts width(0) warnings: add height to ResponsiveContainer wrappers or render-after-mount.
- SCREENSHOT ROUND 3 (findings):
  - /patients, /appointments, /patients/1, /clinical, /billing, /inventory: ALL GOOD with seeded data. Invoice # shows '#19' style (patient id) not invoice number — check display; payments show 'Patient #17' — should show patient name.
  - INSURANCE PAGE EMPTY despite seed: providers/policies/claims all empty — insurance queries must use different input shape (router may expect patientId; the Insurance page passes wrong input or requires role guard). FIX IT.
  - DASHBOARD: KPIs still show '—' and 'Loading dashboard data...' spinner in screenshot but curl works (totalPatients=8) — screenshot may capture mid-load OR the page has an error. But patients page loaded fine same run. Check Dashboard component for error state. Charts empty area (axis only).
- DEBUG STATE 2 (updated): DB deduped OK (8 patients/12 appts). Trends date-key fix done in db.ts (r.date instanceof Date). Dashboard card label now Total Patients/totalPatients (added to db getDashboardStats). auth.me returns 200 w/ admin role but dashboard.stats/patients.list queries keep pending — network log shows auth.me status 200, but dashboard stats earlier returned stats only partially. Server devserver exited -1 at 23:42:43 then restarted. Pages still show spinner (patients.list) / loading dashes — possibly queries error silently; check browserConsole ERROR after restart, check /api/trpc response status in network log. Also recharts chart width(0) warnings earlier.
- DEBUG STATE (previous): seed ran 3x => 24 patients, ~36 appointments, 15 invoices in DB. Need dedupe (delete duplicates) and idempotent reseed via server/check.mjs (check patients count etc.).
  Charts: dashboard BarChart (dataKey 'count', series date+count from getAppointmentTrends in db.ts line 640 — looks correct) rendered EMPTY bars in screenshot; reports pie/line also empty. Suspect: screenshot tool freezes, or data keys are Date objects (r.date from date column returns Date in js, String(Date) => full ISO — tickFormatter slice(5) still shows mm-dd). Check networkRequests.log for dashboard.stats response.
  KPI 'New Patients' = newPatients counts registeredAt >= today — label says 'Registered today' but value is total (24). Fix label to 'Total patients'.
  Patients table shows duplicated rows (seed x3). Delete dupes: keep first 8 by id.
- OLD NOTE (replace me): Seed data still TODO: server/seed.mjs (use drizzle imports from drizzle/schema.ts + mysql2 w/ DATABASE_URL; insert 8 patients, appointments this month w/ all statuses, invoices+payments, 12 inventory items (3 low), 3 providers, 4 policies, 4 claims mixed statuses, 5 notes, ~10 toothConditions, 4 plans). Run: node server/seed.mjs
- Then: seed demo data (server/seed.mjs, drizzle direct SQL insert or via API? -> use drizzle imports w/ .mjs; needs DATABASE_URL),
  vitest tests, todo.md updates, checkpoint, deliver.

## Seed data plan
- Users: owner already admin; create none (seed only business data)
- 8 patients, appointments this month, invoices+payments, inventory 12 items (3 low stock),
  insuranceProviders 3, patientInsurance 4, claims 4 (mixed statuses), clinical notes 5, toothConditions ~10,
  treatmentPlans 4

## Key files
- client/src/App.tsx — routes
- client/src/pages/Home.tsx — landing/redirect
- client/src/components/DashboardLayout.tsx — sidebar layout (menuItems -> navForRole)
- server/routers.ts, server/db.ts, drizzle/schema.ts

## Tooth Illustration Upgrade (follow-up request, Aug 18)
- New component client/src/components/ToothGlyph.tsx: realistic per-tooth SVG glyphs shaped by type (central/lateral incisors, canine, premolar1/2, molar1/2, molar3) with crown/root/detail paths; toothTypeFromNumber(fdNumber) maps FDI number->type; toothTransform mirrors left side & flips lower teeth roots.
- ToothChart.tsx rewritten: each cell renders <svg viewBox="0 0 100 100"><ToothGlyph/></svg> instead of generic tooth icon; CONDITION_COLORS + new CONDITION_STROKE; missing/extraction teeth dimmed 0.35; number label bottom of cell; click/condition selection preserved.
- Verified via screenshot /patients/1 (James Wilson): chart now shows 32 distinct realistic teeth; teeth 16 and 36 colored (blue filling, purple crown) per demo data; legend present; clicks work.
- First capture showed skeletons (capture-timing); second capture rendered fully. TS clean, no new deps.
- Checkpoint NOT yet saved for this change (previous checkpoint b0bb47d2).

## Sketch-Style Tooth Redesign (Aug 18, 2nd follow-up)
Reworked ToothGlyph.tsx with sketch-style anatomy matching the Shutterstock reference: cross-hatch pencil shading lines inside each tooth, distinct crown shapes with cusps, three separate bulbous roots for molars, long single root for canines. Hatching inherits condition stroke color; ToothChart now passes hatchColor instead of highlight. Verified via screenshots /patients/2 (teeth 25 decay red, 26 root-canal orange, 16 missing dimmed) and /patients/5 (47 implant indigo) — shapes look like the hand-drawn anatomy reference with hatching visible. TS clean. Checkpoint pending.

## Dentsoftware reference (user link, Aug 19)
Page: https://www.dentsoftware.com/dental-clinic-software/ — commercial dental clinic software.
Key feature highlights the user may want to adopt:
- Appointments: drag & drop, color-coded status, day/week/month/doctor/operatory views, waiting list, recall, time checker, check-in.
- Dental charting: mark full mouth/arches/quadrants/teeth AND SURFACES; adult + pedo + mixed dentition charts; multiple treatment plans; auto progress notes; tooth notes.
- Reception: patient photo upload, barcode cards, consents w/ digital signature, automated ID generation, check-in system.
- Billing: multiple payment modes, insurance-integrated claims.
- Perio charting: pockets, furcation, bleeding, mobility.
- Prescriptions with presets; lab works; medical alerts (allergies/medication); expense module; imaging/radiology; security/permissions (HIPAA).
User's intent unclear — shared link without instruction. Need to ask which direction: adopt feature ideas (e.g., tooth surfaces charting, perio charting, patient photo, drag-drop appointment calendar) or use it as UI benchmark.

## Surface-Level Dental Charting (Aug 19, current work)
User requested Dentsoftware-style dental charting: per-surface marking. Plan: 5 surfaces (mesial, distal, buccal, lingual, occlusal), whole-tooth conditions stay.
DONE: schema toothSurfaceConditions table added (drizzle/schema.ts ~line 106); migration drizzle/0002_illegal_payback.sql generated and APPLIED via webdev_execute_sql.
DONE: db.ts helpers + routers.ts clinical.surfaces / clinical.setSurface added. UI: ToothSurfaceChart.tsx created (5-section square diagram; decay=red, filling=blue, missing=grey). PatientDetail.tsx + Clinical.tsx wired (activeSurface state, shared tooth dialog handles surface or whole-tooth). Hook-order bug fixed (canManage before surfaces query). TS clean.
Screenshot /patients/1 shows Overview tab fine (whole-tooth chart OK). TODO: verify Clinical tab surface chart renders, seed demo surface data, run pnpm test, checkpoint.
Key file refs: toothConditions in db.ts lines 218-242 (getToothConditions helper pattern); routers.ts clinical router at line ~207. PatientDetail.tsx Clinical tab uses ToothChart component; Clinical.tsx also uses ToothChart. CONDITION_COLORS defined in ToothChart.tsx (re-exportable). Condition enum: healthy, decay, filling, crown, extraction, implant, root_canal, missing, veneers, bridge.
Existing checkpoints: b0bb47d2 (initial), 4ebbef04 (illustrations), b5bff90c (sketch-style). Next checkpoint: b5bff90c+this work.
