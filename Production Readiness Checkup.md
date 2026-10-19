# Production Readiness Checkup

Oct 12, 2026 · @Kevin

## Overview

Your server works. Now you will make it **safe to leave running on the internet**, where real visitors, and real attackers, can reach it. Professional developers run through a checklist like this before every launch, and you will need every item here before your site handles user accounts or payments.

| Part | Problem it fixes |
| --- | --- |
| Fail fast | A missing secret silently falls back to a password anyone can read |
| `NODE_ENV` | Your code cannot tell your laptop from the live site |
| Session cookie | The login cookie could be stolen or sent by other websites |
| Page and API guards | Logged-out `fetch` calls get an HTML page instead of a clear error |
| Login limiter | Attackers can guess passwords thousands of times |
| Practice routes | Demo routes leak information on the live site |
| Health check | Render has no simple way to tell whether your server is alive |

Files you will change: `server.js` and `.env`, plus a setting in Render.

## Before you start

1. **Commit your current work** with Git.
2. **Open your Render dashboard** in another tab. Part 2 changes a setting there.
3. **Know your secrets.** Open `.env` and list every variable your server uses. You will need that list in Part 1.

## Part 1: Fail fast on missing settings

Look at your session setup:

```js
secret: process.env.SESSION_SECRET || 'fallback_secret',
```

If `SESSION_SECRET` is missing on Render, your server quietly uses `'fallback_secret'`, a password that is sitting in your code on GitHub. Anyone who reads it can forge login cookies. Your server would look fine while being completely unlocked.

The professional rule is **fail fast**: if a required setting is missing, refuse to start, and say exactly what is wrong.

**Step 1.** Right below `require('dotenv').config();` at the very top of `server.js`, add:

```js
// Stop immediately if any required setting is missing
const REQUIRED_ENV = ['SESSION_SECRET', 'APP_PASSWORD', 'NASA_API_KEY'];
for (const name of REQUIRED_ENV) {
    if (!process.env[name]) {
        console.error(`Missing ${name} in .env (or in Render's Environment settings)`);
        process.exit(1);
    }
}
```

Adjust the list to match the variables your server actually uses.

- **`process.env[name]`** uses square brackets because the variable's name is stored in `name`. It is the same as writing `process.env.SESSION_SECRET` on the first pass.
- **`process.exit(1)`** stops Node immediately. The `1` means "stopped because of an error."

**Step 2.** Remove the fallback from your session setup:

```js
secret: process.env.SESSION_SECRET,
```

**Step 3.** Make your session secret strong. Run this in your terminal to generate a long random string, then paste it into `.env` as your `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put the same new value in Render's Environment settings. Changing it logs everyone out once, which is fine.

**Step 4.** Test it. Temporarily rename `SESSION_SECRET` in `.env` to `SESSION_SECRETX` and start your server. It should refuse to start with a clear message. Change it back.

## Part 2: Know when you are in production

Some settings should be different on your laptop and on the live site. For example, the live site uses HTTPS, but `localhost` does not. The standard way to tell them apart is an environment variable called `NODE_ENV`.

**Step 1.** In Render, open your web service's **Environment** settings and add:

- **Key:** `NODE_ENV`
- **Value:** `production`

Do **not** add it to your local `.env`. On your laptop, it stays unset.

**Step 2.** Near your other constants in `server.js` (like `PORT`), add:

```js
const isProduction = process.env.NODE_ENV === 'production';
```

`isProduction` is now `true` on Render and `false` on your laptop. You will use it in Parts 3 and 6.

> Express also checks `NODE_ENV` itself. In production mode, it hides error details from visitors automatically, and some packages run faster.

## Part 3: Lock down the session cookie

Your login lives in a cookie called `connect.sid`. If someone steals it, they are logged in as you, no password needed. Three cookie settings make it much harder to steal or misuse.

**Step 1.** Update the `cookie` part of your session setup:

```js
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 15 * 60 * 1000,   // 15 minutes
        httpOnly: true,           // page JavaScript cannot read it
        sameSite: 'lax',          // other sites cannot send it with their forms
        secure: isProduction      // only sent over HTTPS on the live site
    }
}));
```

| Setting | What it stops |
| --- | --- |
| `httpOnly: true` | If an XSS attack ever slips through, the attacker's script still cannot read the cookie |
| `sameSite: 'lax'` | Another website cannot make your browser send its login cookie along with a hidden form submission. This attack is called **CSRF**. |
| `secure: isProduction` | The cookie is never sent over plain HTTP on the live site, where someone on public Wi-Fi could read it |

**Why `secure` only in production?** Your laptop uses `http://localhost`, without the S. With `secure: true` locally, your browser would refuse to send the cookie and you could never stay logged in. `secure` works on Render even behind its proxy, because you already set `app.set('trust proxy', 1)`.

**Step 2.** Restart, log in, and find `connect.sid` in DevTools under **Application** (Chrome) or **Storage** (Firefox), then **Cookies**. Check the **HttpOnly** and **SameSite** columns. After you deploy, check again on your live site: **Secure** should be checked there too.

## Part 4: Separate guards for pages and APIs

Your server has two kinds of protected routes, and they need different answers when someone is not logged in:

| Who is asking | Example | What they need |
| --- | --- | --- |
| A **person** visiting a page | `/dashboard`, `/guestbook` | To be sent to the login page |
| **JavaScript** calling an API | `fetch('/api/guestbook')` | A clear `401` error in JSON |

If an API route redirects, `fetch` quietly follows the redirect and gets your home page's HTML. Then `response.json()` crashes with a confusing "Unexpected token <" error, instead of a clear "please log in."

**Step 1.** Replace your `requireAuth` function with these two guards:

```js
// For API routes: JavaScript gets a clear JSON error
function requireAuth(req, res, next) {
    if (!req.session.isAuthenticated) {
        return res.status(401).json({ error: 'Please log in first.' });
    }
    next();
}

// For pages: people get sent to the login page
function requireLoginPage(req, res, next) {
    if (!req.session.isAuthenticated) {
        return res.redirect('/');
    }
    next();
}
```

**Step 2.** Use `requireLoginPage` on your protected **page** routes:

```js
app.get('/dashboard', requireLoginPage, (req, res) => {
app.get('/guestbook', requireLoginPage, (req, res) => {
```

Keep `requireAuth` on every route that starts with `/api/`.

### Never use 301 for this

`res.redirect('/')` sends status `302`, which means "go here **for now**." Status `301` means "this page has **moved permanently**," and browsers remember that. A browser that saw a 301 from `/dashboard` may keep sending that visitor to the home page even after they log in. Only use 301 when a page truly moves forever.

**Step 3.** Test both while logged out:

- Visit `/dashboard`: you land on the home page.
- Visit `/api/guestbook`: you see `{ "error": "Please log in first." }`.
- In the Network tab, the API request shows status `401`.

## Part 5: Protect the login from guessing

Your main rate limiter allows 100 requests every 10 seconds. That is fine for browsing, but it lets an attacker try **36,000 passwords an hour** against your login. Login routes need their own, much stricter limit.

**Step 1.** Add this limiter right below your main one:

```js
// Strict limit for login attempts: 10 tries per 15 minutes, per visitor
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message: { error: 'Too many login attempts. Please wait 15 minutes and try again.' }
});
```

**Step 2.** Add it to your login route, between the path and the handler:

```js
app.post('/login', authLimiter, (req, res) => {
```

That is the same pattern as `requireAuth`: middleware listed on one route runs only for that route.

**Step 3.** Your main limiter's `message` is HTML, but most of your requests now come from `fetch`, which expects JSON. Change it to an object:

```js
message: { error: 'Too many requests. Please wait 10 seconds.' }
```

**Step 4.** Test it. On your home page, enter a wrong password 11 times. The 11th attempt should show the "Too many login attempts" message, with status `429` in the Network tab.

> The limiter counts per IP address. Testing it locks **you** out for 15 minutes too. Restarting your server resets the count.

## Part 6: Hide practice routes in production

While learning, you built routes like `/api/headers-demo`, which sends back every header your browser sent, **including your session cookie**. That is great for learning, but on a live site it hands information to anyone who asks.

**Step 1.** Wrap practice routes in an `if` so they only exist on your laptop:

```js
// Practice routes: only available on your own computer
if (!isProduction) {
    app.get('/api/headers-demo', (req, res) => {
        res.set('X-Student-Name', 'Your Name Here');
        res.json({
            browser: req.get('User-Agent'),
            languages: req.get('Accept-Language'),
            allRequestHeaders: req.headers
        });
    });
}
```

On Render, the route is never created, so visiting it gets your normal `404`.

**Step 2.** Look through `server.js` for any other route you only made for practice or testing, and move it inside the same `if` block, or delete it.

## Part 7: A health check route

Hosting services like Render can check on your server every few seconds by visiting one simple URL. If it stops answering, they know something is wrong. During a deploy, Render can also wait until the new version answers before switching visitors over to it.

**Step 1.** Add this route with your other routes:

```js
// Lets Render (or anyone) check that the server is running
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
```

Keep it simple and public. It should not need a login, and it should not reveal anything private.

**Step 2.** In Render, open your web service's **Settings** and find **Health Check Path**. Set it to `/health` and save.

**Step 3.** Visit `/health` on your live site. You should see `{ "status": "ok" }`.

## Testing checklist

- [ ] The server refuses to start, with a clear message, when a required variable is missing from `.env`
- [ ] `'fallback_secret'` no longer appears anywhere in your code
- [ ] `NODE_ENV` is `production` in Render's Environment settings, and not in your local `.env`
- [ ] Locally, the `connect.sid` cookie shows **HttpOnly** and **SameSite: Lax**
- [ ] On the live site, the cookie also shows **Secure**
- [ ] Logged out, `/dashboard` and `/guestbook` send you to the home page
- [ ] Logged out, `/api/guestbook` returns a `401` JSON error
- [ ] Logging in still works, including "Remember me"
- [ ] 11 wrong passwords in a row show the "Too many login attempts" message
- [ ] `/api/headers-demo` works locally but returns `404` on the live site
- [ ] `/health` returns `{ "status": "ok" }`, and Render's Health Check Path is set

## Submit

1. **Add `NODE_ENV=production`** and your new `SESSION_SECRET` in Render's Environment settings, and set the **Health Check Path** to `/health`.
2. **Commit and push.** Wait for Render to redeploy.
3. **Run the testing checklist on your live site.**
4. **Send your teacher the Render URL.**

## Grading rubric (10 points)

| Criterion | Points | Full credit | Partial credit |
| --- | --- | --- | --- |
| **Fail fast** | 2 | Server checks every required variable at startup and exits with a clear message; no fallback secret remains | 1 pt: the check exists but the fallback secret is still in the code |
| **Production mode** | 1 | `NODE_ENV=production` is set on Render, and `isProduction` is used in the code | — |
| **Secure cookie** | 2 | Cookie has `httpOnly`, `sameSite: 'lax'` and `secure: isProduction`; the live cookie shows Secure | 1 pt: one setting missing |
| **Page and API guards** | 2 | Pages redirect with 302 to the home page; `/api/` routes return `401` JSON; no 301 redirects | 1 pt: guards exist but one kind of route uses the wrong guard |
| **Login limiter** | 1 | `/login` has its own strict limiter that returns a JSON message | — |
| **Practice routes hidden** | 1 | `/api/headers-demo` returns `404` on the live site | — |
| **Health check** | 1 | `/health` returns `{ "status": "ok" }` on the live site | — |
| **Total** | **10** |  |  |

> **Grading** in a private browser window, visit `/dashboard` (should redirect), `/api/guestbook` (should show the `401` JSON), `/api/headers-demo` (should `404`) and `/health`. Then log in and check the cookie flags in DevTools.