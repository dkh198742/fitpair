# FitPair — Deployment Guide

## What you'll need (all free)
- A [Supabase](https://supabase.com) account (database + auth)
- A [Vercel](https://vercel.com) account (hosting)
- A [GitHub](https://github.com) account (to connect Vercel to your code)
- [Node.js](https://nodejs.org) installed locally (for building)

---

## Step 1 — Set up Supabase (5 min)

1. Go to [supabase.com](https://supabase.com) and click **Start your project**.
2. Create a new project. Pick a name (e.g. "fitpair"), set a strong DB password, choose a region close to you.
3. Wait ~2 minutes for the project to provision.
4. In the left sidebar, click **SQL Editor** → **New query**.
5. Open `supabase-schema.sql` from this folder, paste the entire contents, and click **Run**.
   - This creates all tables, security rules, and the auto-profile trigger.
6. In the left sidebar, click **Settings** → **API**.
7. Copy two values — you'll need them shortly:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (a long JWT string)

---

## Step 2 — Set up the code locally (3 min)

```bash
# In this project folder:
cp .env.example .env.local
```

Open `.env.local` and fill in your two Supabase values:
```
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
```

Test that it works locally:
```bash
npm install
npm start
```

The app should open at `http://localhost:3000`. Create an account and make sure you can log in.

---

## Step 3 — Push to GitHub (3 min)

1. Go to [github.com](https://github.com) → **New repository** → name it `fitpair` → Create.
2. In your project folder, run:

```bash
git init
git add .
git commit -m "Initial FitPair"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/fitpair.git
git push -u origin main
```

---

## Step 4 — Deploy to Vercel (3 min)

1. Go to [vercel.com](https://vercel.com) and sign up with GitHub.
2. Click **Add New Project** → import your `fitpair` repo.
3. Before clicking Deploy, click **Environment Variables** and add:
   - `REACT_APP_SUPABASE_URL` → your Supabase project URL
   - `REACT_APP_SUPABASE_ANON_KEY` → your anon key
4. Click **Deploy**. In ~2 minutes you'll get a live URL like `fitpair.vercel.app`.

**That's it!** Share that URL with your partner.

---

## Step 5 — Link your accounts in the app

1. Both of you create accounts at your new URL.
2. One person opens the **Together** tab and shares their 6-character partner code.
3. The other person enters that code and clicks **Link**.
4. You're connected — you'll now see each other's progress!

---

## Customizing

- **Change macro goals**: Macros tab → Goals button
- **Rename yourself**: The display name comes from what you enter at sign-up. To change it, you can update it directly in Supabase → Table Editor → profiles.
- **Custom domain**: In Vercel, go to your project → Settings → Domains → Add domain.

---

## Notes

- All data is stored securely in Supabase. Each user can only see their own data and their linked partner's data.
- The AI Coach uses your Anthropic API key automatically (via the FitPair widget in Claude.ai). If you're running this standalone outside of Claude.ai, you'll need to add your own Anthropic API key.
- Chat history is saved per user so the AI coach remembers your conversation.
