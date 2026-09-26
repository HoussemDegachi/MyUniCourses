# Setup

Two people can work in parallel: one does the accounts below, one runs the code.
The app runs without any of this, so nobody is blocked.

---

## 1. Run it (5 minutes, no accounts needed)

Two terminals.

**Backend**

```
cd backend
npm install
cp .env.example .env
npm run dev
```

**Frontend**

```
cd planner
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:5173.

You now have working course search, schedule generation, conflict detection,
component swapping, and .ics import and export. The prompt box is switched off and
sign-in is hidden until the keys below are filled in.

If uoCampus blocks you or is down, set `USE_SAMPLE_DATA=true` in `backend/.env` and
everything keeps working on built-in data. Do this before demoing on venue wifi if
the live scrape is flaky.

---

## 2. Gemini (10 minutes)

This turns on the prompt box, the professor summaries, and the schedule write-ups.

1. Go to https://aistudio.google.com/apikey and sign in with a Google account.
2. Create an API key. The free tier is plenty for a hackathon.
3. Put it in `backend/.env`:

```
GEMINI_API_KEY=your-key-here
```

4. Restart the backend. The startup log should say `gemini: on`.

Test it: type "no classes before 10, Fridays off, good profs matter most" in the
prompt box and press Read my preferences. The sliders should move.

**Do not** put this key in the frontend. It lives on the server only, which is why
the frontend calls `/api/preferences/parse` instead of Google directly. A key in
browser code is visible to anyone who opens dev tools.

---

## 3. Auth0 and Google Calendar (60 to 90 minutes)

This is the long one. It turns on sign-in and the Add to Google Calendar button.
Sign-in alone is what the MLH Auth0 prize asks for, so **do steps A to C first and
demo that**. Steps D to F add the calendar write and can be dropped if time runs short.

### A. Create the tenant

1. Sign up at https://auth0.com. Pick a region close to you.
2. Note your domain. It looks like `something.us.auth0.com`.

### B. Create the API

1. Applications, then APIs, then Create API.
2. Name: `Profound API`. Identifier: `https://profound.api` (this is just a string,
   it doesn't have to resolve). Signing algorithm: RS256.

Put it in `backend/.env`:

```
AUTH0_DOMAIN=something.us.auth0.com
AUTH0_AUDIENCE=https://profound.api
```

### C. Create the frontend app

1. Applications, then Applications, then Create Application.
2. Pick **Single Page Web Application**, then React.
3. In its Settings tab, set all three of these to `http://localhost:5173`:
   Allowed Callback URLs, Allowed Logout URLs, Allowed Web Origins.
4. Save.

Put it in `planner/.env.local`:

```
VITE_AUTH0_DOMAIN=something.us.auth0.com
VITE_AUTH0_CLIENT_ID=the-client-id-from-this-app
VITE_AUTH0_AUDIENCE=https://profound.api
```

Restart both. A Sign in button appears in the header, and the backend log says
`auth0: on`. **Stop here if you are short on time.** Sign-in works, and that is
what the Auth0 prize requires.

### D. Connect Google

1. In Google Cloud Console (https://console.cloud.google.com), create a project.
2. APIs and Services, then Library, then enable **Google Calendar API**.
3. OAuth consent screen: External. Add your own email under Test users, otherwise
   Google blocks every account but the owner.
4. Credentials, then Create Credentials, then OAuth client ID, then Web application.
   Authorized redirect URI: `https://something.us.auth0.com/login/callback`
   (your Auth0 domain, exactly).
5. Copy the client ID and client secret.

### E. Point Auth0 at Google

1. In Auth0: Authentication, then Social, then Create Connection, then Google.
2. Paste the Google client ID and secret.
3. Under Permissions, turn on **Calendar**. This is the step everyone forgets. If
   you skip it, sign-in works and the calendar push fails with a permission error.
4. On the Applications tab of that connection, enable your SPA application.
5. In Authentication, then Database, you can disable the username-password
   connection so Google is the only way in. Optional.

### F. Let the backend read the Google token

Auth0 holds the Google token. The backend fetches it through the Management API.

1. Applications, then Applications, then Create Application.
2. Pick **Machine to Machine**. Authorize it for **Auth0 Management API**.
3. Grant exactly one scope: `read:user_idp_tokens`. Nothing else.
4. Copy its client ID and secret into `backend/.env`:

```
AUTH0_M2M_CLIENT_ID=...
AUTH0_M2M_CLIENT_SECRET=...
```

Restart the backend. The log says `calendar: on` and the Add to Google Calendar
button appears.

### Test it

Sign in with Google. Google should ask for calendar permission during that same
screen. Build a schedule, press Add to Google Calendar, then check
calendar.google.com. There should be a new calendar named `Profound: 2026 Fall Term`
holding one weekly repeating event per class.

### When it breaks

| What you see | What it means |
|---|---|
| `This account isn't connected to Google Calendar` | You signed in with username and password, not Google. Sign out, sign in with Google. |
| `Google hasn't granted calendar access` | Step E3 was skipped, or you approved before it was set. Sign out and back in to re-approve. |
| `Sign-in isn't configured on this server` | The backend has no `AUTH0_DOMAIN` or `AUTH0_AUDIENCE`. |
| Sign-in loops or errors on redirect | The callback URL in step C3 does not match the port you're on exactly. |
| `access_denied` from Google | Your account isn't in Test users on the consent screen (step D3). |

---

## 4. Demo day checklist

- [ ] Run through the whole flow once on venue wifi before judging
- [ ] If the scrape is slow or blocked, set `USE_SAMPLE_DATA=true` and note it in
      the pitch. It is sample data, not a fake demo, so say so plainly.
- [ ] Sign in ahead of time so the Google consent screen isn't in the middle of your demo
- [ ] Know the answer to "how do you stop the AI making things up": it never sees
      the schedule, only the facts computed from it
- [ ] Know the answer to "where does the prof data come from": Rate My Professors'
      public endpoint, cached, and a production version would need their permission

## 5. Deploying (only if you have spare time)

Frontend: `npm run build` in `planner`, upload `dist` anywhere static.
Backend: any Node host. Set every variable from `.env.example`.

Then add the deployed URLs to Auth0's callback, logout and web origin lists, and to
`CORS_ORIGIN` in the backend. Both lists take comma separated values.

If you register the GoDaddy domain for the MLH prize, point it at the frontend.
