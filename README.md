# NPTonboard – Employee Hiring & Onboarding Platform

**NPTonboard** is a standalone internal application designed to streamline and digitize employee onboarding for **NPT’s global subsidiaries—India, Canada, and the United States.**

Version **1.0** focuses on activating the India onboarding workflow, while the architecture is fully prepared for Canada and US expansion in future versions.

---

## Current Status

| Component                 | Stack                                                    | Status             |
| ------------------------- | -------------------------------------------------------- | ------------------ |
| **Frontend**              | Next.js 15 • TypeScript • Tailwind CSS                   | Active Development |
| **Backend**               | Next.js Route Handlers • Node.js • Shared Contract Types | In Progress        |
| **HR Authentication**     | Secure login & sessions                                  | Upcoming           |
| **Candidate Invite Flow** | Public invite link + token                               | UI Scaffold Ready  |
| **India Onboarding Flow** | Digital form + PDF/manual workflows                      | Building           |
| **Canada & US**           | Disabled in v1 (UI-ready, backend pending)               | Scheduled for v2   |

---

## Project Overview

NPTonboard manages onboarding for employees across multiple subsidiaries. The system supports two primary user groups:

### 👤 Candidates

- Access onboarding using a secure invite link
- Identity verification (token + OTP)
- Multi-step forms (India activated in v1)
- Document uploads
- Digital signature & declarations
- Handle HR modification requests

### 🧑‍💼 HR Team

- View onboarding dashboard by subsidiary
- Create candidate invitations (Digital or Manual PDF)
- Track statuses and expiration
- Review submissions
- Request modifications
- Approve employees & assign employee numbers

---

## 🏗️ Project Structure

```
src/
  app/
    (employee)/
      onboarding/
        [inviteToken]/     # Candidate onboarding entry point
    (hr)/
      login/               # HR login screen (placeholder)
      dashboard/           # HR Dashboard (placeholder)
    layout.tsx             # Root layout wrapper
    page.tsx               # Root landing
  components/
    ui/                    # Reusable UI primitives
  lib/
    api/                   # API client layer (mock until backend ready)
    config/                # App-wide configs
    utils/                 # Utility helpers
  types/
    index.ts               # Placeholder shared types (to be replaced by backend contracts)
```

---

## ⚙️ Tech Stack

- **Next.js 15** (App Router)
- **TypeScript + React**
- **Tailwind CSS**
- **React Hook Form + Zod**
- **Node.js Route Handlers**
- Shared Type Contracts (upcoming)
- AWS S3 (planned)
- Cloudflare Turnstile (planned)

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
http://localhost:3000

### 3. Environment variables

Copy the example file:

```bash
cp .env.example .env.local
```

---

## Version 1 Scope

### ✔️ Active

- Full **India** onboarding flow (Digital + Manual PDF)
- HR dashboard with subsidiary switcher
- Invite generation for India
- Candidate landing page scaffold

### ❌ Disabled until v2

- **Canada onboarding**
- **US onboarding**

When HR switches to CA/US:

> “This module will be available in Version 2.”

---

## Development Standards

- TypeScript strict mode enabled
- ESLint + Prettier enforced
- Modular, feature-driven folder structure
- UI primitives under `components/ui`
- API layer replaceable with backend contracts
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
- Must not break shared types or app structure

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
