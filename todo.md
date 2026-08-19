# Dental Management System — TODO

## Foundation
- [x] Database schema: patients, appointments, treatments/clinical records, tooth chart conditions, invoices, payments, inventory items, stock movements, insurance providers, patient insurance, insurance claims, users/staff (role enum: admin | dentist | receptionist | staff)
- [x] Migrations generated and applied
- [x] Server tRPC routers for all modules with role-based authorization
- [x] Vitest tests for key procedures (14/14 passing)
- [x] Professional clinical design system (index.css, fonts, palette)

## 1. Role-based authentication
- [x] 4 roles: Admin, Dentist, Receptionist, Staff (enum extended in schema)
- [x] Role-scoped access enforced server-side (role checks in all procedures)
- [x] Role-scoped sidebar navigation rendered per role

## 2. Dashboard overview
- [x] KPI cards: today's appointments, revenue, new patients, pending tasks
- [x] Chart: appointment trends over time
- [x] Chart: revenue over time
- [x] Role-based dashboard visibility

## 3. Patient management
- [x] Patient registration form
- [x] Patient profile page with demographics
- [x] Medical & dental history records per patient
- [x] Patient list with search and filtering
- [x] Patient status (active/inactive)

## 4. Appointment scheduling
- [x] Calendar view of appointments
- [x] Book appointment
- [x] Reschedule appointment
- [x] Cancel appointment
- [x] Status tracking: scheduled, confirmed, completed, no-show

## 5. Dental chart & clinical records
- [x] Tooth diagram (FDI 32-teeth) visualization
- [x] Tooth conditions (decay, filling, crown, etc.) per tooth
- [x] Treatment notes / diagnoses per patient
- [x] Treatment plans with procedures and status
- [x] Treatment history

## 6. Billing & payments
- [x] Invoice generation from treatment plans
- [x] Payment recording (cash/card/bank transfer)
- [x] Outstanding balance tracking
- [x] Payment history per patient
- [x] Refund/adjustment handling (invoice adjustments)

## 7. Inventory management
- [x] Supplies/materials catalog
- [x] Stock in / stock out operations
- [x] Stock level monitoring
- [x] Low-stock alerts
- [x] Inventory list with stock adjustments

## 8. Insurance management
- [x] Insurance providers list
- [x] Patient insurance details (provider, policy)
- [x] Claim creation (with co-pay/deductible)
- [x] Claim status tracking (pending, submitted, approved, denied)

## 9. Reports & analytics
- [x] Appointment statistics report
- [x] Revenue report
- [x] Patient demographics report
- [x] Exportable summaries (CSV export)

## 10. User & staff management
- [x] Add clinic staff accounts (admin only)
- [x] Edit staff and assign roles (admin only)
- [x] Deactivate staff (admin only)
- [x] Clinic-wide settings page (admin only): clinic info, preferences

## Polish & Delivery
- [x] Seed demo data for all modules
- [x] Screenshots verified, vitest passing (14/14)
- [x] Checkpoint saved

## Tooth Chart Illustration Upgrade
- [x] Redesign ToothChart: each tooth rendered as a distinct realistic illustration shaped by tooth type (central incisor, lateral incisor, canine, premolars, molars) with crown/root detail
- [x] Keep condition-coloring overlay (decay, filling, crown, etc.) and click interactivity working for all 32 teeth
- [x] Verify chart visually in browser, checkpoint, deliver

## Sketch-Style Tooth Redesign (reference: Shutterstock tooth types sketch)
- [x] Redesign glyphs: realistic anatomy per reference — molars with 2-3 separate roots and bulbous roots, canines with long single root, incisors with slender roots; sketchy cross-hatch/line shading instead of flat fill
- [x] Keep condition color tint, missing/extraction dimming, click selection and FDI labels working
- [x] Verify visually, checkpoint, deliver

## Surface-Level Dental Charting (Dentsoftware-style)
- [x] Schema: toothSurfaceConditions table (tooth number, surface, condition)
- [x] Server: clinical.surfaces query + clinical.setSurface mutation
- [x] UI: ToothSurfaceChart component — 5-surface square diagram (mesial/distal/buccal/lingual/occlusal) per tooth
- [x] UI: Tooth detail dialog showing both whole-tooth and per-surface marking
- [x] Wired into PatientDetail Clinical tab and Clinical page
- [x] Demo surface data seeded, vitest 14/14 passing, checkpoint saved

## Odontogram Anatomy Adaptation (user request: adapt the anatomy of every tooth from ZoliQua/React-Odontogram-Modul)
- [x] Study the odontogram repo's tooth SVG assets and anatomy shapes (measured SVG templates 11/12/13/14/15/16/17/31/46)
- [x] Rebuild ToothGlyph: odontogram-style anatomy per tooth type — pulp chamber, crown/root detail, pink gingiva band around crown, multi-root molars (46 template), generated into client/src/lib/toothAnatomy.ts
- [x] Keep condition color tinting, missing/extraction dimming, click selection, FDI labels, surface chart compatibility
- [x] Verify visually (patient detail + clinical page), run tests (14/14), checkpoint, deliver

## Canva Prototype Showcase (user request)
- [x] Capture clean full-page screenshots of each app module page (Dashboard, Patients, Appointments, Clinical, Billing, Inventory, Insurance, Reports, Staff, Settings)
- [x] Prepare screenshot assets (crop sidebar, consistent 16:9 framing)
- [x] Create one high-fidelity prototype design per module in the user's Canva account — PPTX at /home/ubuntu/dentacare_prototype.pptx, imported as Canva presentation "Dentacare Prototype Pages" (design DAHStl9D-8c) in folder FAHStj-chIs
- [x] Verify designs render correctly in Canva, export as PNG, and deliver links/exports (canva_sheet.png + exports zip verified)

Screenshot crops verified: sidebar correctly removed on all 10 modules; each content crop is 1360px wide (heights 913–3204px). Assets ready at /home/ubuntu/canva_shots/*_content.png. Billing/inventory crops confirmed clean.

## Reference-Layout Chart Rebuild (user's exported odontogram SVG as reference)
- [x] Analyze the exported SVG: continuous gingiva band per arch, tooth placement/orientation, FDI number labels above/below
- [x] Rebuild ToothChart layout to match reference: full 32-tooth row per arch, correct arch order 18-11/21-28 (upper) and 48-41/31-38 (lower), FDI number rows, auto-fit container width (glyphs' own bone/gum layers form the continuous band)
- [x] Keep anatomy glyphs, condition tinting, surface charting, click selection
- [x] Verify visually (/patients/1 + /clinical), tsc clean, tests 14/14, checkpoint, deliver

## Sidebar Fix + Odontogram Feature Additions (user request)
- [x] Diagnose sidebar issue: inspect DashboardLayout and each page for sidebar layout/render bugs (persisted localStorage width had shrunk to icon-rail size)
- [x] Fix sidebar so it renders and behaves correctly on every page — clamped persisted width on load (MIN_WIDTH–MAX_WIDTH), restore DEFAULT_WIDTH when reopening after collapse
- [ ] Dental chart: Status vs Plan marking modes (current findings vs planned treatments)
- [ ] Dental chart: visibility toggles (bone, pulp, wisdom teeth)
- [ ] Dental chart: quick arch presets (upper/lower, 6 front, molars, all)
- [ ] Periodontal status: schema (periodontal status table per tooth or 6-point probing values)
- [ ] Periodontal status: server tRPC procedures
- [ ] Periodontal status: chart view tab (like the reference demo) with per-tooth marking
- [ ] Demo seed data for periodontal status
- [ ] Verify all pages visually, tests 14/14, checkpoint, deliver

## Final Chart Refinement
- [x] Enlarge tooth glyphs so crowns fill their cells better (cell ratio changed to 1:1.75, size cap raised to 72)
- [x] Fix vertical spacing: lower arch must not overlap the "Quick groups" row (added chart padding, tighter arch geometry)
- [x] Mirror Status/Plan toggle, visibility toggles (bone/pulp/wisdom) onto Clinical page chart + "Saving to" status/plan selector
- [x] Seed demo periodontal records for demo patients (28 rows each for patients 1-4, perio-focused dataset for patient 4)
- [x] Run full vitest suite (14/14) + final visual verification

## ADA / CDT Procedure Code Auto-Population
- [x] Standard ADA/CDT Code dataset with categories, standard fees, tooth/surface rules (shared/cdtCodes.ts)
- [x] Searchable, categorized CDT Code Picker modal component (CDTCodePicker.tsx)
- [x] Billing invoice line items CDT code autocomplete, quick preset chips, and auto-fee calculation (Billing.tsx)
- [x] Itemized treatment planning with CDT procedure codes, per-procedure status toggling, and fee summaries (TreatmentPlanCard.tsx, PatientDetail.tsx, Clinical.tsx)
- [x] Tooth & surface dialog CDT library integration for fast clinical finding and procedure entry
- [x] Unit tests for CDT library search and lookups (15/15 passing)
