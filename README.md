# OfficeFlow — Leave & Government Holiday Calendar (Production Ready)

**OfficeFlow** is an enterprise-ready, light SaaS Office Leave & Government Holiday Calendar web application built for private office teams. It features real-time shared calendar views, explicit leave visibility management by management (`Show on Calendar [ON/OFF]`), manual admin calendar mentions, unified Soft Red treatment for Sundays & Government Holidays, privacy protection between peer employees, manager approval workflows, official Tamil Nadu / Indian government holiday tracking (configured from **October 2026 through December 2027**), role-based access control, and complete Supabase PostgreSQL schema with Row Level Security (RLS).

---

## 🔒 Production Security & Access Architecture

* **Authentication Guard**: Unauthenticated visitors are automatically redirected to `/login`.
* **No Public Registration**: Public signups are disabled. Only pre-provisioned active company profiles in the `profiles` table can access the workspace.
* **Role-Based Protection**: Non-admin employees are strictly blocked from all `/admin/*` routes via `AdminLayout` and redirected to `/calendar`.
* **Leave Privacy**: Private employee reasons, medical explanations, internal admin notes, and rejection details are masked from peer employees and visible only to the owner and Admin.
* **Row Level Security (RLS)**: PostgreSQL policies on Supabase enforce security at the database layer. Service-role keys are never exposed to the client.

### Pre-Configured Company Members

| Name | Work Email | Role | Department | Default Password |
| :--- | :--- | :--- | :--- | :--- |
| **Dinesh Kumar** | `dinesh@officeflow.local` | 👑 **Admin / Manager** | Management | `password123` |
| **Pachamuthu S** | `pachamuthu@officeflow.local` | 👤 **Employee** | Engineering | `password123` |
| **Arun Vijay** | `arun@officeflow.local` | 👤 **Employee** | Design & Product | `password123` |
| **Reshma Banu** | `reshma@officeflow.local` | 👤 **Employee** | Quality Assurance | `password123` |

---

## 🛠️ Tech Stack & Build Verification

* **Framework**: Next.js 15 (App Router) + React 19 + TypeScript (Strict Mode)
* **Styling**: Tailwind CSS (Tailored SaaS Light Theme)
* **Icons**: Lucide React
* **Database & Auth**: Supabase PostgreSQL + SSR Auth with Row Level Security (RLS)
* **Date Handling**: Bounded local calendar computation (October 2026 – December 2027)

### Verification Status
* ✅ **TypeScript**: `npx tsc --noEmit` — 0 errors
* ✅ **ESLint**: `npm run lint` — 0 errors, 0 warnings
* ✅ **Production Build**: `npm run build` — 15/15 static routes optimized and compiled successfully

---

## 📦 Step-by-Step Production Deployment Guide

### Step 1: Database Setup on Supabase

1. Log in to [Supabase](https://supabase.com) and create a new project (e.g. `officeflow-calendar`).
2. Navigate to **SQL Editor** in your Supabase project dashboard.
3. Open [`supabase/schema.sql`](supabase/schema.sql) and execute the script to create tables, indexes, views, and RLS policies.
4. Open [`supabase/seed.sql`](supabase/seed.sql) and execute the script to populate the 4 company members, 2026–2027 government holidays, and sample mentions.
5. In your Supabase dashboard, go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon / public key**

---

### Step 2: Push Code to GitHub

1. Initialize git (if not already done) and stage the production codebase:
   ```bash
   git init
   git add .
   git commit -m "feat: OfficeFlow production ready leave & holiday calendar"
   ```
2. Create a new **Private** GitHub repository (e.g., `officeflow-calendar` or `dwellvise-calendar`).
3. Link the remote and push:
   ```bash
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/officeflow-calendar.git
   git branch -M main
   git push -u origin main
   ```

*(Note: `.env.local`, `.env`, and secret keys are protected by `.gitignore` and will never be committed).*

---

### Step 3: Deploy on Vercel

1. Log in to [Vercel](https://vercel.com) and click **"Add New..." → "Project"**.
2. Import your GitHub repository `officeflow-calendar`.
3. In the **Configure Project** screen, under **Environment Variables**, add the following keys:

| Environment Variable | Recommended Value / Description |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project-ref.supabase.co` (from Supabase API settings) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-supabase-anon-key` (from Supabase API settings) |
| `NEXT_PUBLIC_APP_NAME` | `OfficeFlow` |
| `NEXT_PUBLIC_APP_DEFAULT_START` | `2026-10-01` |
| `NEXT_PUBLIC_APP_MAX_END` | `2027-12-31` |

4. Click **"Deploy"**. Vercel will build the Next.js app and provide your live production URL (e.g., `https://officeflow-calendar.vercel.app`).

---

## 🧪 Comprehensive Test Matrix

| Scenario | Steps | Expected Result | Verified |
| :--- | :--- | :--- | :---: |
| **1. Unauthenticated Redirection** | Visit `/calendar` without logging in. | Immediately redirects to `/login`. Internal calendar is not exposed. | ✅ |
| **2. Role Guarding** | Log in as Pachamuthu and navigate to `/admin`. | Access Restricted screen shown with button to return to calendar. | ✅ |
| **3. Casual Leave Creation** | Apply for Casual Leave. | Stored in database as `pending`. Not shown on shared calendar. | ✅ |
| **4. Admin Approval (Show OFF)** | Dinesh approves leave with `Show on Calendar = OFF`. | Status becomes `approved`. Remains hidden from shared calendar. | ✅ |
| **5. Admin Approval (Show ON)** | Dinesh toggles `Show on Calendar = ON`. | Immediately appears on shared calendar for all employees. | ✅ |
| **6. Visibility Toggle OFF** | Dinesh toggles `Show on Calendar = OFF`. | Immediately disappears from shared calendar. | ✅ |
| **7. Manual Admin Mention** | Dinesh creates "Quarterly All-Hands Meeting" on Oct 6. | Visible in Indigo to all employees; only Admin can edit/delete. | ✅ |
| **8. Sunday & Holiday Color** | Inspect Sundays & Government Holidays. | Both use the **identical single Soft Red** `#FEE2E2` / `#B91C1C`. | ✅ |
| **9. Sunday + Holiday Overlap** | Inspect Nov 8, 2026 (Deepavali on Sunday). | Uses the same single Soft Red color without conflicting badges. | ✅ |
| **10. Multi-day Leaves** | Apply leave spanning multiple dates (e.g. Oct 15–17). | Stored as a single record and rendered across all days cleanly. | ✅ |
| **11. Peer Privacy** | View another employee's leave details as an employee. | Only Name, Dates, and Leave Type shown; confidential reason is hidden. | ✅ |
| **12. Date Bounds** | Navigate months between Oct 2026 and Dec 2027. | Navigation is strictly bounded between Oct 2026 and Dec 2027. | ✅ |

---

## 💻 Local Development

```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Run TypeScript typecheck
npx tsc --noEmit

# Run ESLint linter
npm run lint

# Build production bundle
npm run build
```
