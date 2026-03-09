---
trigger: always_on
---

# PreLeave AI Agent Rules

1. Call me NiceguyLang every time you respond.
2. Do not try to please me. If you find anything vague, ask me questions about them.

## When developing, 
1. Always see PRD at project_memory/PRD.md and mockups at project_memory/mockup/.
2. Do not refer to hw3_comparison folder.

## Tech Stack
Frontend: React (Vite), TypeScript, Tailwind CSS, Zustand, React Hook Form, Zod, HERE JS SDK, Axios, Web Push API.
Backend: Node.js, Express.js, TypeScript, JWT, bcrypt, BullMQ, Redis, Zod.
Infrastructure: PostgreSQL (Supabase), Prisma, Redis (Upstash), Vercel, Railway/Render, GitHub Actions.

## Architecture
Client talks to Backend via HTTPS REST.
Backend connects to PostgreSQL, Redis, BullMQ, and HERE API.
Folders are split into frontend/src, backend/src, and shared.

## Design Reference

### Key Pages
- Login/Register page: 
  - Centered card layout
  - "PreLeave" logo + title at top
  - Email and password input fields
  - toggle link to switch between login and signup
- Home page: 
  - List of upcoming trips showing all the details like locations, arrival time, and recommendation badge (Bus/Uber) with recommended leaving time
  - "Plan New Trip" button
  - User profile button
- Plan page: 
  - Input start address
  - Input destination address
  - Input arrival date and time picker
  - "Plan" button
- Profile page: 
  - Show the current user's username
  - List all the trip histories
  - "Reuse" button for duplicating a trip today
  - "Delete" button to delete a trip history
  - "Logout" button at top for user to logout

### User Flows
- Unauthenticated user visits any protected route → redirect to /login.
- Login success → redirect to /homepage.
- Homepage → click "Plan New Trip" → /trips/new → submit → display result page on homepage.
- Homepage → click profile → "Reuse" → pre-filled trip form → display result page on homepage.
- Register → email + password → "I agree" checkbox → submit → auto login → /homepage.

### UI Behavior
- Form validation: Inline red error text below each field using React Hook Form + Zod.
- Auth errors: Generic message "Invalid credentials" (never reveal which field is wrong).
- Loading: Show spinner or skeleton on async operations.
- Responsive: Mobile-first single column, side-by-side cards on desktop.

## Authentication
Register: Email, password, bcrypt hash.
Login: Access token in memory, refresh token in httpOnly cookie.
Refresh: Validate cookie, return new access.
Logout: Clear cookies.
Security: Rate limit, generic errors, no localStorage for tokens. OAuth is for later.

## Test-Driven Development
Write tests before code.
Tools: Vitest, RTL, Supertest, MSW, Playwright.
Coverage required: 80% generally, 100% happy path for critical flows.
Co-locate test files. Mock external APIs.

## Evaluation Suite
Includes unit, integration, e2e, perf, and accessibility tests.
CI blocks merges if tests or coverage fail.
Test ETA accuracy, departure times, and authentication.

## Naming and Standards
React components: PascalCase.
Hooks, services, stores, schemas: camelCase.
Env vars: UPPER_SNAKE_CASE.
Use strict TypeScript, functional components, and structured logging.

## Workflow
Branches: feature/8-user-auth, fix/12-login-redirect, chore/1-define-rules, docs/10-sprint-review.
Commits: Conventional format, examples:
  feat(auth): add registration endpoint (#8)
  fix(trip): handle null ETA response (closes #12)
  docs: update Sprint 1 review (#10)
PRs: Link to issue with "Closes #XX" in PR description. Need passing tests, screenshots for UI changes, and one approval.

## Do and Do Not
Do: Use HERE API, Zod, TDD, WCAG 2.1 AA, strict TypeScript (no any), consistent API response format { success, data, error }.
Do Not: Use Google Maps, Uber API, Next.js, NestJS, GraphQL, commit secrets, or store tokens in localStorage.

## Test-only Credentials
Prioritize using these credentials for testing in the browser (e.g., if account doesn't exist, sign up using these):
- Username: test001@example.com
- Password: 114514