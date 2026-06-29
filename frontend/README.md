# Mentor Platform — Frontend

A full-stack mentor-patient web application built with **Next.js 16**, **TypeScript**, and **Tailwind CSS** as part of the Arbisoft AI-Focused Internship Program 2026 (Week 1).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| HTTP Client | Axios |
| Charts | Recharts |
| Animations | Framer Motion |
| Icons | Lucide React |
| Testing | Vitest + React Testing Library |
| Linting | ESLint + Prettier |

---

## Project Structure

```
frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/          # Login page
│   │   └── register/       # Registration page
│   ├── (dashboard)/
│   │   ├── doctor/         # Doctor dashboard
│   │   ├── patient/        # Patient dashboard
│   │   └── video/[id]/     # Video call page
│   ├── globals.css
│   ├── layout.tsx          # Root layout with shared Navbar
│   └── page.tsx            # Landing / home page
├── components/
│   ├── analytics/          # DoctorAnalytics, PatientAnalytics
│   ├── vault/              # File vault (upload, filter, display)
│   ├── AppointmentForm.tsx
│   ├── AppointmentList.tsx
│   ├── CalendarModal.tsx
│   ├── Navbar.tsx
│   ├── NotificationBell.tsx
│   ├── Logo.tsx
│   └── Skeleton.tsx
├── contexts/
│   └── ThemeContext.tsx     # Dark/light mode context
├── lib/
│   ├── api.ts              # Axios instance & API helpers
│   ├── auth.ts             # Auth utilities
│   ├── appointmentServiceProxy.ts
│   ├── fileServiceProxy.ts
│   └── mockData.ts
├── types/
│   └── index.ts
└── __tests__/              # Vitest unit tests
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Install dependencies

```bash
cd frontend
npm install
```

### Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting without writing |
| `npm run test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |

---

## Features

- **Authentication** — Login and registration flows with client-side validation
- **Doctor Dashboard** — Appointment management, analytics, and patient overview
- **Patient Dashboard** — View appointments, upload files, track health data
- **Video Calls** — Dynamic video session pages via `/video/[id]`
- **File Vault** — Drag-and-drop file upload with filtering and display
- **Analytics** — Charts and insights using Recharts
- **Dark / Light Mode** — Theme toggle via React Context
- **Notifications** — Real-time notification bell component

---

## Testing

```bash
npm run test
```

Tests are written with **Vitest** and **React Testing Library**, covering:
- `AppointmentForm` component
- `Logo` component
- Auth utilities

---

## Week 1 Checklist (Arbisoft Internship)

- [x] Set up Next.js with TypeScript, ESLint, and Prettier
- [x] Built SPA with 5+ routes and a shared layout
- [x] Built forms with client-side validation
- [x] Configured ESLint + Prettier with a clean lint pass
- [x] Written 3+ unit tests using Vitest + React Testing Library
- [x] Maintained `prompts.md` log of AI prompts used

---

## Author

**Muhammad Usama** — Arbisoft AI-Focused Internship 2026
