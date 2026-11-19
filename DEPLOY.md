# Putting Baseline online (free) for testers

You need: a GitHub account (you have one), and a free Render account (sign in with GitHub, no card).
Time: about 20 minutes the first time.

## 1. Push the code
Commit this folder to your GitHub repo (use a branch called `beta`, or the main branch). If the repo is private, that is fine: Render can read private repos once you let it.

## 2. Create the app on Render
1. Go to render.com, sign in with GitHub.
2. Click **New +**, then **Blueprint**.
3. Choose your Baseline repo (and the branch). Render reads `render.yaml` and proposes a web service and a database.
4. Click **Apply**. The first build takes about 5 to 10 minutes.
5. When it says **Live**, open the address at the top, like `https://baseline-xxxx.onrender.com`. That is your app.

## 3. First sign-in
- Open the address, tap **Create an account**, choose **Coach or trainer**. That account is yours.
- For quick demo data (a team called Explorers with players), open the service in Render, go to **Environment**, and add:
  - `SEED_DEMO` = `true`
  - `SEED_PASSWORD` = a password you choose (do not leave the default on a public address)
  - `SEED_ROSTER` = `Neha,Sahanaa,Asmi,Medha,Pratinka` (your real player names, separated by commas; add `:7` after a name for a jersey number)
  Save, and the service restarts and creates `coach@demo.in`, `trainer@demo.in` and `parent@demo.in`. Afterwards set `SEED_DEMO` back to `false`.
- You can also just create the team and players by hand in the app. That takes five minutes and needs no settings.

## 4. On a phone
Open the address in **Chrome on Android**. Tap the menu (three dots), then **Install app** (or **Add to Home screen**). You get an icon that opens the app full screen, like a normal app. No file to download.

## 5. Avoid the slow first load
Render's free service goes to sleep after 15 minutes without visits and takes up to a minute to wake. Two fixes:
- Open the app a few minutes before a match.
- Or create a free monitor at uptimerobot.com: type HTTP(s), URL `https://YOUR-ADDRESS/api/health`, every 5 minutes. That keeps it awake.
The app keeps saving your taps on the phone while it waits, so nothing is lost if the server is slow.

## 6. Things to know about the free plans
- Render's free database is deleted after 30 days unless you upgrade. That is plenty for a beta. To keep data longer, create a free database at neon.com, copy its connection string, and put it in the service's `DATABASE_URL` setting instead.
- There are no backups. After the tournament, if you want a copy, ask me for an export script.
- Use real player names only if the parents and coaches know and agree. Keep the repo private.

## Optional: a real APK
Installing from Chrome is the easiest way. If you want a file you can send to someone:
1. Go to pwabuilder.com and paste your Render address.
2. Choose **Package for stores**, then **Android**, and download the package. It contains a test APK.
3. On the phone, allow installing from your browser or file manager when asked, and open the APK.
This needs the live address first, and it is the same app inside a wrapper, so there is nothing extra to maintain.

## If something goes wrong
- **The page says it cannot reach the server:** wait a minute and reload (the service was asleep).
- **Build failed on Render:** open the build log and send me the last 20 lines.
- **You can sign in but data is missing:** check the service is using the Render database (the `DATABASE_URL` setting is filled in).

## The Trainer app
It is part of the same service, so there is nothing extra to create on Render. After you deploy, open your address with `/trainer/` on the end, for example `https://baseline-xxxx.onrender.com/trainer/`. Install it from the browser menu like the Coach app; it gets its own green icon. You sign in once for both apps. Players and parents never need it, because their training charts appear on the profile in the Coach app.
