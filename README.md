# Aurora School CMS

A lightweight, modular school website and content management system.
Built with MySQL (or MariaDB), Express, React and Node.js. It needs no MongoDB, no Redis and no separate services.

## What is included

| Module | What it does |
| --- | --- |
| School Identity | Name, logo, favicon, brand colour, contact details, map, social links |
| Portal Layout | Main menu, home boxes, sidebar boxes, hotlines, anthem and page background |
| Header Banner | The banner photo and school name on every page |
| Noticeboard | Written notices with PDF, JPG, JPEG and PNG attachments, pinning, scheduling and expiry |
| Result Publication | Classes 1 to 10, NCTB-based subjects, students, marks, grading, result sheet, public lookup |
| Head Teacher's Message, About | Editable pages with home page summaries |
| Achievements | Awards and milestones |
| Media & Gallery | Photos, YouTube links and self-hosted videos |
| Facilities | Classrooms, labs, playground and your own items. A count of 0 hides the item |
| Admission | Standard Bangladeshi admission form, form builder, applications, status tracking |
| Payments | SSLCommerz online, bKash/Nagad/Rocket send-money, bank deposit, office payment |
| Custom Pages | Any extra page, optionally in the main menu |
| Teachers & Staff | Officers, teachers, staff and information officer, with card and table views, search and sort |
| Departments | Departments grouped by faculty, each listing its teachers |
| Meeting Calendar | Events highlighted on the home page calendar |
| News | Headlines in the home page strip |
| Publications | Syllabus, routines, forms and magazines as downloads, by category |
| Co-curricular Activities | Clubs, sports and cultural programmes |
| Feedback | Public feedback form with an admin inbox |
| User Accounts | Admin and staff, per-staff permissions, email verification |
| Email | SMTP settings, branded template, editable templates, custom messages, sent log |
| Media & Image Optimisation | Automatic resize and WebP conversion, and a media library |
| SEO & Speed | Page titles, Open Graph, School schema data, sitemap, robots.txt |
| Security | Login lockouts, password rules, activity log |

Every module can be configured from **Admin > All Modules**. Modules can be turned off there too, except the core ones
(School Identity, Media, SEO, Accounts, Security). The order on that page also sets the menu and home page order.

## Run it on your own computer

On this PC a portable MariaDB is already set up in `.localdb` (ignored by git; leave it out of any ZIP upload). Start it with `npm run db:local` and leave that window open. In a second window run `npm run build` and `npm start`, then open `http://localhost:5000`. The footer has a Sign in link (`/signin`). The admin setup key is `SETUP_KEY` in `.env`.

Anywhere else, you need Node.js 24 (or 22.12 and newer) and a MySQL or MariaDB server (XAMPP is fine).

1. Create an empty database, for example `school_cms`, with the `utf8mb4` character set.
2. Copy `.env.example` to `.env` and fill it in. For local testing use:
   `NODE_ENV=development`, `PUBLIC_URL=http://localhost:5000`, `TRUST_PROXY=0` and `FORCE_HTTPS=false`.
3. Install and start:

```bash
npm install
```

```bash
npm run build
```

```bash
npm start
```

4. Open `http://localhost:5000/signin` and create the admin account with your `SETUP_KEY`.

Tables are created automatically on first start. To try the site with sample content, run `npm run seed:demo` once
on an empty database. It refuses to run in production.

For development with live reload, run `npm run dev` and open `http://localhost:5173`.

Run the grading tests with `npm test`.

## Hosting

### Which Hostinger plan?

Hostinger runs Node.js apps on **Business Web Hosting and Cloud plans only**, not on the entry-level shared plans.
Check this before buying or deploying. On a plan without Node.js, use a VPS instead.

### Hostinger: install from the ZIP (easiest)

Run `npm run package` to create `release/school-cms-install-VERSION.zip`, then follow `INSTALL.txt` inside it. In short: create a database in hPanel, upload the ZIP under **Websites > Create site > Web App > Upload your website files**, deploy with Node version 24 and entry file `server.js`, then open your domain and follow the installation wizard.

The ZIP cannot be installed by unzipping it in File Manager, because Node.js apps must be created from the dashboard.

The wizard saves settings and uploads in `school-cms-data`, beside `public_html`, because deployments replace the app folder. To update the site later, upload a newer ZIP to the same website. If the settings file is ever lost, the wizard returns and can reconnect to the existing database without losing data, though saved email and payment passwords must be entered again.

### Hostinger Business or Cloud (from GitHub)

1. In hPanel, create a MySQL database and user, and note the names and password.
2. Push this project to a private GitHub repository. `.env` and `uploads/` are ignored, so no secrets or files are uploaded.
3. In hPanel, go to **Websites > Add website > Node.js Apps** and import the repository. Alternatively, upload a ZIP without `node_modules`.
4. Use these settings:
   - Framework: Express
   - Node version: 24
   - Build command: `npm run build`
   - Entry file: `server.js`
5. Add the variables from `.env.example` as environment variables: `NODE_ENV=production`, `PUBLIC_URL`, the `DB_*` values, `APP_SECRET`, `SETUP_KEY`, `TRUST_PROXY=1`, `FORCE_HTTPS=true`.
6. Set `UPLOAD_DIR` to a folder **outside** the app folder, for example `/home/USERNAME/school-uploads`, so that a redeploy cannot remove uploaded files.
7. Deploy, then open `https://your-domain/signin` to create the admin account.
8. In **Admin > Email**, enter your SMTP details (for Hostinger email, `smtp.hostinger.com`, port 465) and press **Send test**.

If the site redirects forever after enabling HTTPS, the proxy count is wrong: check `TRUST_PROXY`.

If `sharp` cannot run on the host, the site still works. Uploads are stored at full size, and the Media Library shows a warning.

### VPS (Ubuntu example)

```bash
git clone YOUR_REPOSITORY school && cd school && npm install && npm run build
```

Create `.env` from `.env.example`, then keep the app running with pm2:

```bash
npm install -g pm2 && pm2 start server.js --name school && pm2 save && pm2 startup
```

Put nginx in front of it, and add a certificate with certbot:

```nginx
server {
  server_name www.example.edu.bd;
  client_max_body_size 110m;
  location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### GitHub

GitHub Pages can only serve static files. It cannot run Node.js or MySQL, so **the whole system cannot live on GitHub alone**. There are two ways to use GitHub:

- **As the deployment source (recommended).** Keep the code on GitHub and deploy it to Hostinger or a VPS, as above.
- **Front end on GitHub Pages, API elsewhere.** The included workflow `.github/workflows/pages.yml` publishes the React site.
  The API and database must still run on Hostinger or a VPS. In the repository's Actions variables, set `VITE_API_URL` to the API address.
  On the server set `ALLOWED_ORIGINS` to the Pages address and `CROSS_SITE_COOKIES=true`.
  In this mode, search engine tags are not added by the server, and images placed inside rich text use relative links, so hosting everything together is the better option.

### Backups

Back up both the database and the uploads folder. Check what your hosting plan's automatic backups actually cover, and test a restore.

## How results are calculated

The built-in **Bangladesh Education Board (Standard)** scale is read-only. Schools can copy it and edit the copy.

| Marks | Grade | Point |
| --- | --- | --- |
| 80 to 100 | A+ | 5.00 |
| 70 to 79 | A | 4.00 |
| 60 to 69 | A- | 3.50 |
| 50 to 59 | B | 3.00 |
| 40 to 49 | C | 2.00 |
| 33 to 39 | D | 1.00 |
| 0 to 32 | F | 0.00 |

- GPA is the average of the grade points of compulsory subjects, capped at 5.00.
- An F, or an absence, in any compulsory subject fails the whole result.
- A fourth subject adds only the points above 2, and an F in it does not fail the student.
- 1st and 2nd papers with the same "Combined subject" name are added together and graded as one subject.
- Marks are stored, and results are worked out when read. Editing a grading scale therefore changes every exam that uses it, including published ones. Copy the scale when rules change between years.

The starting subject list follows the NCTB structure but should be checked against your current syllabus. It is all editable under **Result Publication > Classes & subjects**.

## Signing in and the private admin address

Everyone signs in at `/signin`, which the footer links to. After signing in, the browser is sent to the admin panel at a private address that is generated uniquely for each site. There is no `/admin` page.

The address appears only for signed-in users and in **Admin > Security > Configure**, where admins can change it. It is left out of public pages, the JavaScript files, `robots.txt`, the sitemap and emails. If you lose it, sign in at `/signin` and you are taken there.

This cuts down automated attacks, but it is not a replacement for strong passwords. Anyone with an account can see the address, so the login lockouts and permissions remain the real protection.

## Security summary

- Passwords are hashed with scrypt, a memory-hard algorithm, with a unique salt for each password.
- SMTP and payment gateway passwords are encrypted at rest with AES-256-GCM, using a key derived from `APP_SECRET`.
- Logins are locked after repeated failures, per connection and per account, and locks grow with repeat attempts.
- Sessions are random tokens in HttpOnly, SameSite cookies, stored only as hashes, and can be revoked.
- Cross-site requests are blocked by an Origin check.
- SQL is parameterised, rich text is sanitised on the server, and a strict Content Security Policy is set.
- Uploads are identified by their content rather than their name. SVG and scripts are refused, and EXIF data (including GPS) is removed from images.
- Applicants' documents are stored privately and need a signed-in user with permission.

No software can honestly promise complete protection. Keep these in place too: HTTPS, strong unique passwords, regular `npm audit` and updates, tested backups, and hosting-level firewall or Cloudflare protection against large-scale attacks, which an app cannot stop by itself.

## Adding a module

Create a manifest in `server/src/modules/` with `key`, `title`, optional `schema` (settings), `contentSchema` (content),
`permissions`, `nav` and `mount({ pub, admin })`, then add it to the `ALL` list in `server/src/modules/index.js`.
The admin forms, on/off switch and permissions list are generated from the manifest.

## Project layout

```text
server/src/core      database, auth, uploads, email, SEO, shared helpers
server/src/modules   one manifest and its routes per feature
server/src/lib       grading engine (pure functions, unit tested)
server/src/seed      starting curriculum and email templates
client/src/site      public website
client/src/admin     sign-in page and admin panel, loaded only when needed
```
