# NPTonboard – Employee Hiring & Onboarding Platform

**NPTonboard** is a standalone internal application designed to streamline and digitize employee onboarding for **NPT’s global subsidiaries—India, Canada, and the United States.**

Version **1.0** focuses on activating the India onboarding workflow (digital + manual), while the architecture and routing are fully prepared for Canada and US expansion in future versions.

---

## Current Status

| Component                 | Stack                                                               | Status             |
| ------------------------- | ------------------------------------------------------------------- | ------------------ |
| **Frontend**              | Next.js 15 • TypeScript • Tailwind CSS • React Hook Form + Zod      | Active Development |
| **Backend**               | Next.js Route Handlers (REST-ish) • Node.js • Shared Contract Types | In Progress        |
| **HR Authentication**     | Azure AD (whitelisted emails)                                       | Upcoming           |
| **Employee Invite Flow**  | Public invite link + token + OTP + secure cookie                    | UI Scaffold Ready  |
| **India Onboarding Flow** | Digital multi-step form + Manual PDF (HR data entry)                | Building           |
| **Canada & US Workflows** | Disabled in v1 (UI-ready outlines, backend & country rules pending) | Scheduled for v2   |

---

## Project Overview

NPTonboard manages onboarding for employees across multiple subsidiaries. The system supports two primary user groups:

### 👤 Employees (Digital Flow)

- Access onboarding using a secure, expiring invite link
- Identity verification via **invite token + OTP + HTTP-only cookie**
- Multi-step onboarding form (India active in v1)
- Document uploads (S3 via presigned URLs)
- Digital declaration & signature
- Respond to HR modification requests (digital only)
- One-time onboarding access (no “account” after approval/termination)

### 🧑‍💼 HR Team

- Azure-authenticated login to a standalone dashboard
- Work in the context of a **selected subsidiary (IN / CA / US)**
- Create employee onboarding records:

  - **Digital Form** (invite + OTP verification)
  - **Manual PDF Flow** (HR fills data based on emailed PDF)

- Track statuses and invite expiry
- Resend invites & generate modification links
- Review submissions and uploaded documents
- Request modifications (digital only)
- Approve onboardings & assign employee numbers (per subsidiary)
- Terminate onboardings and permanently delete terminated records (when allowed)

---

## 🏗️ Project Structure

### Frontend (App Router)

```bash
src/
  app/
    layout.tsx            # Root layout wrapper
    page.tsx              # Root landing

    onboarding/
      page.tsx            # Invite landing: reads ?token=..., triggers OTP flow
      [id]/
        page.tsx          # Employee multi-step form + read-only views based on status

    dashboard/
      layout.tsx          # HR dashboard shell (navbar + sidebar)
      page.tsx            # Home: list + filters + "Invite Employee"
      terminated/
        page.tsx          # Terminated onboardings view
      settings/
        page.tsx          # Dashboard-level settings (per subsidiary / global)
      onboardings/
        [id]/
          page.tsx        # HR detail view: tabs (personal, bank, docs, audit, etc.)

  api/
    v1/
      admin/
        onboardings/
          route.ts          # POST (create new onboarding), GET (list for active subsidiary)
        onboardings/
          [id]/
            route.ts        # GET (detail), PUT (update formData), DELETE (permanent delete)
            approve/
              route.ts      # POST (approve + employeeNumber)
            terminate/
              route.ts      # POST (terminate onboarding)
            resend-invite/
              route.ts      # POST (resend digital invite, new token)
            request-modification/
              route.ts      # POST (ModificationRequested + new token + HR message)

      onboarding/
        invite/
          verify/
            route.ts        # POST: validate invite token, generate OTP, email OTP
        otp/
          verify/
            route.ts        # POST: validate OTP, set secure cookie
        [id]/
          route.ts          # GET: employee fetch; POST: final submit (Submitted/Resubmitted)

      presign/
        route.ts            # POST: presigned S3 URLs (shared HR/employee uploads)

  components/
    ui/                   # Reusable UI primitives (buttons, inputs, dialogs, etc.)
    onboarding/           # Multi-step form components per country/section
    dashboard/            # HR dashboard list, filters, summary cards

  lib/
    api/                  # API client layer (aligned with app/api routes)
    config/               # App-wide configs (subsidiaries, env-based URLs, etc.)
    utils/                # Utility helpers (status chips, formatting, etc.)
    security/             # Token/OTP helpers, cookie utilities (frontend-side)

  types/
    onboarding.ts         # Shared onboarding types (status, methods, subsidiary, form shapes)
    index.ts              # Barrel exports for shared types
```

> The **frontend** and **API** folder structures are intentionally aligned with domain concepts:
> `dashboard` ↔ `/api/v1/admin/onboardings` and `onboarding` ↔ `/api/v1/onboarding/...`.

---

## ⚙️ Tech Stack

- **Next.js 15** (App Router)
- **TypeScript + React**
- **Tailwind CSS**
- **React Hook Form + Zod** (strongly-typed, validated multi-step forms)
- **Next.js Route Handlers** (REST-ish JSON APIs)
- **MongoDB** (onboarding records, OTP + invite metadata)
- **AWS S3** (document and signature storage via presigned URLs)
- **Email Provider** (SES / Resend / SendGrid – for invite, OTP, and notifications)
- **Cloudflare Turnstile** (server-side validated on final submission)
- **KMS-backed encryption** for sensitive identifiers (Aadhaar, SIN, SSN, bank details) — app-level encryption around DB writes/reads

Some infrastructure pieces (Turnstile, email provider wiring, KMS integration) may be partially stubbed in code while backend implementation is completed.

---

## Getting Started

### 1. Install dependencies

```bash
npm install
# or
pnpm install
```

### 2. Run development server

```bash
npm run dev
```

Visit:
[http://localhost:3000](http://localhost:3000)

### 3. Environment variables

Copy the example file:

```bash
cp .env.example .env.local
```

Minimum envs (subject to change as backend wiring progresses):

- Database connection (MongoDB)
- S3 credentials & bucket
- Email provider keys
- Cloudflare Turnstile keys
- Azure AD app/client configuration

---

## Version 1 Scope

### ✔️ Active / In Progress

- **India Onboarding (IN)**

  - Digital onboarding flow:

    - Invite token → OTP → secure cookie → `/onboarding/[id]`
    - Multi-step form: personal info, government IDs, education, employment, bank, declaration & signature
    - Single final submission (no partial server saves)
    - S3 document uploads (Aadhaar, PAN, passport, etc.)
    - Location capture at submit (blocking if not provided)
    - Cloudflare Turnstile validation at submission (backend wiring in progress)

  - Manual PDF flow:

    - HR creates onboarding with method = `manual`
    - System emails blank PDF + instructions
    - Employee completes PDF and emails HR
    - HR fills full form in dashboard and uploads documents on behalf of employee
    - HR can approve directly once form is complete

- **HR Dashboard**

  - Subsidiary switcher (IN / CA / US)
  - Onboarding list with filters/search (status, dates, employee number)
  - Invite generation (digital/manual) for India
  - Onboarding detail view: tabs for personal, education, employment, bank, documents
  - Termination and Terminated view (including delete for terminated records)

- **Invite & OTP Flow (Digital)**

  - Email invite link: `/onboarding?token=<rawToken>`
  - Token validation + OTP generation (API contracts in place)
  - OTP verification and cookie-based access to `/onboarding/[id]`

### ❌ Disabled until v2

- **Canada onboarding (CA)** – schemas defined, UI patterns reused, rules & flows inactive
- **US onboarding (US)** – schemas defined, UI patterns reused, rules & flows inactive

When HR switches to CA/US in v1:

> “This module will be available in Version 2.”

---

## Development Standards

- TypeScript **strict** mode enabled
- ESLint + Prettier enforced
- Modular, feature-driven folder structure aligned with domain routes
- UI primitives under `components/ui`
- Shared onboarding types in `types/onboarding.ts` to mirror backend contracts
- CI (upcoming): lint, build, type checks

---

## 🤝 Collaboration

### Branch Strategy

- `main` → stable
- `dev` → integration branch
- `feature/*` → individual development branches

### Pull Requests

- Must build & lint cleanly
- Include screenshots for UI updates
- Must not break shared contracts between frontend and API routes
- Prefer small, focused PRs by feature (dashboard list, invite modal, India Step 1, etc.)

---

## 👥 Contributors

| Name      | Role                 |
| --------- | -------------------- |
| **Parv**  | Team Lead & Designer |
| **Faruq** | Frontend Engineer    |
| **Ridoy** | Backend Engineer     |

---

## 📄 License

Internal use only — © NPT.
