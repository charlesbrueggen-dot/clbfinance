# CLB Finance

Your personal financial dashboard — built with React, Supabase, and Vite.

---

## Setup Instructions

### Step 1 — Set up Supabase database

1. Go to **supabase.com** and open your project
2. Click **SQL Editor** in the left sidebar
3. Copy the entire contents of `schema.sql`
4. Paste it into the SQL editor and click **Run**
5. All 7 tables will be created automatically with security enabled

### Step 2 — Get your Supabase keys

1. In Supabase, go to **Settings → API**
2. Copy your **Project URL** and **anon public** key

### Step 3 — Add your environment variables

1. Create a file called `.env` in the root of this project
2. Add these two lines (replace with your actual values):

```
VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### Step 4 — Install and run

```bash
npm install
npm run dev
```

The app will open at `http://localhost:5173`

---

## Deploy to Vercel

1. Push this folder to a GitHub repository
2. Go to **vercel.com** and click **Add New Project**
3. Import your GitHub repo
4. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
5. Click **Deploy**

Your app will be live at a `.vercel.app` URL instantly.

---

## Features

- ✅ Sign up / Login (Supabase Auth)
- ✅ Dashboard with pie chart and recent activity
- ✅ Income tracking with source breakdown
- ✅ Expenses with Needs/Wants/Savings categories
- ✅ Net Worth tracker with physical assets
- ✅ Investment portfolio with live price refresh
- ✅ Analytics with income vs expense trend charts
- ✅ Savings Goals with progress tracking
- ✅ Loans & Debts with compound interest calculation
- ✅ CSV Import for bank transactions
- ✅ Bank Accounts manager
- ✅ Dark mode / Light mode toggle
- ✅ Each user's data is completely private (RLS)
