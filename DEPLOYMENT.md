# Deploying the Exam System to Vercel

A complete, start-to-finish guide. Follow the steps in order — several of them depend on the
one before.

**What you are building:** two Vercel projects from one GitHub repository.

```
GitHub repo: exam-system
│
├── backend/    →  Vercel project #1  →  https://exam-system-api.vercel.app
│                  Express API running as serverless functions
│
└── frontend/   →  Vercel project #2  →  https://exam-system-app.vercel.app
                   React app (static build)
```

**Time required:** about 30–40 minutes the first time.

**You will need free accounts on:** [MongoDB Atlas](https://cloud.mongodb.com) ·
[Cloudinary](https://cloudinary.com) · [GitHub](https://github.com) · [Vercel](https://vercel.com)

---

## Before you start: why the code is structured this way

Three things about Vercel drive the whole setup. Knowing them makes the rest make sense.

**1. There is no "server" that stays running.** Vercel runs your Express app as *serverless
functions* — they wake up for a request and shut down after. That is why `app.js` (which builds
the app) is separate from `server.js` (which is local-only and calls `app.listen`). Production
uses `api/index.js` instead.

**2. The filesystem is read-only and disappears.** Anything written to disk during a request is
gone by the next one. That is why uploaded past papers now go to **Cloudinary** instead of
`backend/uploads/`.

**3. Request bodies are capped at 4.5MB.** A 10MB PDF cannot be sent *through* the API. So the
browser uploads the file **directly to Cloudinary**, and only tiny JSON goes to your backend.
This keeps the 20MB file limit working.

---

## Step 1 — MongoDB Atlas (your database)

Your local MongoDB is not reachable from the internet, so Vercel cannot use it. Atlas is
MongoDB's free cloud version.

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) and sign up.
2. **Create a cluster** → choose **M0 (Free)** → pick the region closest to you
   (Mumbai / Singapore for Pakistan) → **Create Deployment**.
3. **Create a database user** (Atlas prompts you automatically):
   - Username: `examadmin`
   - Password: click **Autogenerate** and **copy it somewhere safe** — you cannot view it again.
   - Click **Create Database User**.
4. **Network Access** (left sidebar) → **Add IP Address** → **Allow Access from Anywhere**
   (`0.0.0.0/0`) → **Confirm**.

   > **Why allow everywhere?** Vercel's serverless functions do not have fixed IP addresses —
   > they change on every deploy. There is no specific IP you could allow. Your database is
   > still protected by the username and password.

5. **Get your connection string**: **Database** → **Connect** → **Drivers** → copy the string.

   It looks like:
   ```
   mongodb+srv://examadmin:<db_password>@cluster0.ab1cd.mongodb.net/?retryWrites=true&w=majority
   ```

6. **Fix it up** — two edits are required:
   - Replace `<db_password>` with the real password (remove the `<` and `>` too).
   - Insert the database name `exam_system` **before** the `?`.

   Final result:
   ```
   mongodb+srv://examadmin:YourRealPassword@cluster0.ab1cd.mongodb.net/exam_system?retryWrites=true&w=majority
   ```

   > If your password contains `@`, `/`, `:` or `#`, it must be URL-encoded — or just
   > regenerate a password without special characters. This is the single most common
   > connection failure.

**Keep this string. You will paste it three times: local `.env`, Vercel backend env vars, and
when seeding.**

---

## Step 2 — Cloudinary (file storage)

1. Sign up at [cloudinary.com](https://cloudinary.com) (free tier: 25GB — plenty).
2. On the **Dashboard**, find **Product Environment Credentials**.
3. Copy these three values:

   | Value | Looks like |
   |---|---|
   | **Cloud Name** | `dyvqqil95` |
   | **API Key** | `123456789012345` |
   | **API Secret** | click the eye icon to reveal |

> **Never put the API Secret in the frontend.** It stays on the backend only. The backend uses
> it to sign each upload; the browser only ever receives a short-lived signature.

---

## Step 3 — Generate a JWT secret

This signs your login tokens. Anyone who knows it can forge a login as any user, including admin.

Run this in your terminal and copy the output:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> The app **refuses to start** if `JWT_SECRET` is missing, shorter than 32 characters, or still
> set to the `.env.example` placeholder. This is deliberate — a deployment silently running on a
> known secret is worse than one that won't boot.

---

## Step 4 — Set up your local `.env` and seed the database

Before deploying, get it working locally against Atlas. If it works here, it will work there.

Open `backend/.env` and fill it in:

```env
PORT=5000
NODE_ENV=development

MONGO_URI=mongodb+srv://examadmin:YourRealPassword@cluster0.ab1cd.mongodb.net/exam_system?retryWrites=true&w=majority

JWT_SECRET=<paste the long random string from Step 3>
JWT_EXPIRE=7d

CORS_ORIGIN=http://localhost:3000

CLOUDINARY_CLOUD_NAME=<your cloud name>
CLOUDINARY_API_KEY=<your api key>
CLOUDINARY_API_SECRET=<your api secret>
```

Now seed the database with courses and demo accounts:

```bash
cd backend
npm install
npm run seed
```

> ⚠️ **`npm run seed` deletes all existing users and courses** before inserting the demo data.
> Run it once at the start. **Never run it again once real students have accounts.**

Then set up indexes (one time only):

```bash
npm run fix-indexes
```

### Test it locally

Two terminals:

```bash
# Terminal 1
cd backend && npm run dev
# → 🚀 Server running on port 5000

# Terminal 2
cd frontend && npm install && npm start
# → opens http://localhost:3000
```

Log in with `admin@exam.com` / `admin123`. If this works, you are ready to deploy.

---

## Step 5 — Push to GitHub

```bash
cd a:/mega-projects/exam_system

git add -A
git commit -m "chore: prepare for deployment"
```

Create the repository on GitHub (either way works):

```bash
# With the GitHub CLI:
gh repo create exam-system --private --source=. --push

# Or manually: create an empty repo on github.com, then:
git remote add origin https://github.com/YOUR-USERNAME/exam-system.git
git branch -M main
git push -u origin main
```

> **Check before pushing:** run `git status` and confirm `backend/.env` is **not** listed.
> It is in `.gitignore`, so it should not be. If you ever do commit it by accident, generate a
> new `JWT_SECRET` and rotate your Atlas password — removing the file later is not enough,
> because git keeps history.

---

## Step 6 — Deploy the BACKEND (Vercel project #1)

1. Go to [vercel.com/new](https://vercel.com/new) and sign in with GitHub.
2. Find `exam-system` → **Import**.
3. Configure it — **this part matters**:

   | Setting | Value |
   |---|---|
   | **Project Name** | `exam-system-api` |
   | **Framework Preset** | **Other** |
   | **Root Directory** | click **Edit** → select **`backend`** ← *easy to miss* |
   | Build Command | leave empty |
   | Output Directory | leave empty |

4. Expand **Environment Variables** and add all seven:

   | Name | Value |
   |---|---|
   | `MONGO_URI` | your Atlas string from Step 1 |
   | `JWT_SECRET` | your random string from Step 3 |
   | `JWT_EXPIRE` | `7d` |
   | `NODE_ENV` | `production` |
   | `CORS_ORIGIN` | `*` ← **temporary**, fixed in Step 8 |
   | `CLOUDINARY_CLOUD_NAME` | your cloud name |
   | `CLOUDINARY_API_KEY` | your API key |
   | `CLOUDINARY_API_SECRET` | your API secret |

   > `CORS_ORIGIN` is `*` for now only because the frontend URL does not exist yet. Step 8
   > locks it down. **Do not skip Step 8.**

5. Click **Deploy** and wait ~1 minute.

6. **Verify it.** Open `https://exam-system-api.vercel.app/api/health` in your browser.
   You should see:

   ```json
   { "status": "API is running ✅", "environment": "production", "time": "..." }
   ```

   **Copy your backend URL.** You need it in the next step.

---

## Step 7 — Deploy the FRONTEND (Vercel project #2)

1. [vercel.com/new](https://vercel.com/new) again → import **the same repository**.
2. Configure:

   | Setting | Value |
   |---|---|
   | **Project Name** | `exam-system-app` |
   | **Framework Preset** | **Create React App** |
   | **Root Directory** | click **Edit** → select **`frontend`** |

3. Add one environment variable:

   | Name | Value |
   |---|---|
   | `REACT_APP_API_URL` | `https://exam-system-api.vercel.app/api` |

   > Use **your** backend URL from Step 6. It must end in **`/api`** and have **no trailing
   > slash**.

4. Click **Deploy**.

5. **Copy your frontend URL** (e.g. `https://exam-system-app.vercel.app`).

---

## Step 8 — Close the CORS loop ⚠️ Do not skip

Your backend currently accepts requests from anywhere. Lock it to your frontend.

1. Vercel → **exam-system-api** project → **Settings** → **Environment Variables**.
2. Edit `CORS_ORIGIN`, change `*` to your real frontend URL:

   ```
   https://exam-system-app.vercel.app
   ```

   No trailing slash. For several origins, separate with commas and no spaces.

3. **Redeploy the backend** — environment variable changes do **not** apply to a running
   deployment: **Deployments** tab → newest deployment → **⋯** menu → **Redeploy**.

---

## Step 9 — Final verification

Open your frontend URL and work through this list:

- [ ] `https://<backend>/api/health` returns the JSON status
- [ ] Login as **admin** — `admin@exam.com` / `admin123`
- [ ] Login as **instructor** — `ali.instructor@exam.com` / `instructor123`
- [ ] Login as **student** — `ahmed.student@exam.com` / `student123`
- [ ] Instructor: create an exam
- [ ] Student: take the exam and see the result
- [ ] Instructor: upload a past paper on the Resources page — **try one bigger than 5MB**
      (this proves the direct-to-Cloudinary path works)
- [ ] Download that file back
- [ ] Delete it
- [ ] Navigate to `/student`, then press **F5** — the page reloads instead of showing 404
- [ ] Open DevTools (F12) → **Console** → no red CORS errors

### 🔴 Change the demo passwords

The seeded accounts use public passwords from this repository. Log in as admin and change them —
or delete the demo accounts — before anyone real uses the system.

---

## Troubleshooting

### "Failed to fetch" / CORS error in the browser console

The exact message tells you which side is wrong:

- **`No 'Access-Control-Allow-Origin' header`** → `CORS_ORIGIN` on the backend does not match
  your frontend URL. Check for a trailing slash, `http` vs `https`, and that you **redeployed**
  the backend after changing it (Step 8).
- **`CORS: this origin is not allowed to call the API`** (a JSON 403) → the backend is running
  and correctly rejecting you. Same fix.

### Login spins forever / 503 "Database unavailable"

Almost always Atlas Network Access. Confirm `0.0.0.0/0` is listed and **Active** (it can take a
minute to apply). Otherwise check `MONGO_URI` — especially special characters in the password.

### Backend deploy succeeds but every route 404s

**Root Directory** was not set to `backend`. Settings → General → Root Directory → `backend` →
redeploy.

### Frontend build fails with `Treating warnings as errors`

Vercel sets `CI=true`, so CRA promotes ESLint warnings to errors. Reproduce locally with the
exact same command:

```bash
cd frontend && CI=true npm run build
```

Fix whatever it lists. As a **last-resort** unblock (not a fix), add a Vercel environment
variable `CI` = `false`.

### Refreshing `/student/exam/123` gives 404

`frontend/vercel.json` is missing or was not deployed. It contains the SPA rewrite that sends
all paths to `index.html`.

### Uploads fail with "File storage is not configured"

One of the three `CLOUDINARY_*` variables is missing on the **backend** project. Add it and
redeploy.

### Changed `REACT_APP_API_URL` but the frontend still calls the old URL

CRA bakes `REACT_APP_*` values into the JavaScript **at build time**. Changing the variable does
nothing until you **redeploy the frontend**.

---

## How it works in production

```
Browser  ──►  exam-system-app.vercel.app        (React static files)
                        │
                        │  REACT_APP_API_URL
                        ▼
              exam-system-api.vercel.app/api/*   (Express serverless)
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
   MongoDB Atlas                   Cloudinary
   (users, exams,                  (past papers,
    attempts, results)              course materials)

   File upload skips the API entirely:
   Browser ──(signed request)──► Cloudinary directly

   Download goes the other way round:
   Browser ──► API (checks your login) ──► returns a signed link
           ──► Cloudinary (link expires in 5 min)
```

**Why files are stored as Cloudinary "private" assets:** the ordinary CDN URL for a private
asset returns `401`. The only way to read a past paper is a short-lived signed link that the
backend hands out *after* checking you are logged in. So the file itself is access-controlled,
not merely hidden behind an unguessable URL.

### Known limitations

These are honest gaps, not bugs to be surprised by later:

- **Login rate limiting is per-instance.** `express-rate-limit` counts in memory, and each
  serverless instance has its own memory. It raises the cost of password guessing but is not a
  hard cap. A shared store (Redis / Upstash) would be the real fix.
- **Download links expire after 5 minutes.** Files are stored as Cloudinary *private* assets:
  the plain CDN URL returns `401`, and the only way in is a signed link the backend mints per
  request for a logged-in user. That is the correct behaviour, but it means a copied link stops
  working shortly after — by design.
- **Cold starts.** The first request after a quiet period takes 1–3 seconds while the function
  boots and connects to MongoDB. Subsequent requests are fast.
- **Atlas M0 is 512MB.** Fine for an exam system; keep an eye on it if attempt volume grows.

---

## Everyday commands

```bash
# Local development
cd backend  && npm run dev      # API on :5000
cd frontend && npm start        # App on :3000

# Tests
cd backend && npm test          # 15 smoke tests, no database needed

# Verify the frontend build exactly as Vercel will run it
cd frontend && CI=true npm run build

# Database maintenance
cd backend && npm run fix-indexes
cd backend && npm run seed      # ⚠️ WIPES all users and courses

# Deploy: just push. Vercel rebuilds both projects automatically.
git add -A && git commit -m "feat: your change" && git push
```

---

## Demo accounts (from `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@exam.com` | `admin123` |
| Instructor | `ali.instructor@exam.com` | `instructor123` |
| Instructor | `sara.instructor@exam.com` | `instructor123` |
| Student (Sem 1) | `ahmed.student@exam.com` | `student123` |
| Student (Sem 5) | `hassan.student@exam.com` | `student123` |
| Student (Sem 8) | `maher.student@exam.com` | `student123` |

Eight students total, one per semester — see `backend/seed.js` for the full list.

**These passwords are public in this repository. Change them before real use.**
