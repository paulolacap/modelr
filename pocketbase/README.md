# Accounts (PocketBase on Coolify)

Shape Workshop has an optional **Log in** button. Signed-in people can save designs to their account and open
them on any device. Signed out, the app works as before and nothing leaves the browser.

The page talks to a PocketBase server. Its address is set in `src/head.html`:

```html
<meta name="account-url" content="https://pb.jpzl.dev">
```

Remove that line (and rebuild) to hide the Log in button.

## Set up PocketBase in Coolify

1. In Coolify, open the project, choose **+ New → Service**, search for **PocketBase** and add it.
2. Set its domain to `https://pb.jpzl.dev` (the `*.jpzl.dev` tunnel already routes it, no DNS change needed).
   Deploy it.
3. Create the superuser: on first start PocketBase prints a one-time installer link in its logs (Coolify → the service →
   Logs). Open it, swapping the host for `pb.jpzl.dev`, and pick an email and password. After that the dashboard is at
   `https://pb.jpzl.dev/_/`.
4. In the dashboard go to **Settings → Import collections**, paste the contents of `collections.json`
   from this folder, and press **Review → Confirm**. That adds the `designs` collection. Its API rules let each person
   see and change only their own designs.
5. **Settings → Mail settings**: add SMTP details so "Forgot password?" emails can be sent.
6. **Settings → Backups**: turn on scheduled backups (optionally to S3). Coolify keeps the data in a volume,
   but this gives you restorable copies.

## Optional

- **Turn off public sign-up:** Collections → `users` → API rules → set *Create rule* to superusers only
  (lock icon). You then add people from the dashboard.
- **Google / GitHub login:** Collections → `users` → Options → OAuth2. The app only has email and password today.
