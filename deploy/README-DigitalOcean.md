# Deploying renewCo. to DigitalOcean

The platform runs on one **Droplet** (Ubuntu 24.04): Node serves the site and API on 127.0.0.1:4000, and Nginx sits in front on ports 80/443.
App Platform is not suitable: it has no persistent disk, so the SQLite database and uploaded files would be wiped on every deploy.

## 1. Push the code to GitHub
Commit everything except `Backend/.env` (it is in `.gitignore`). The server creates its own `.env`.

## 2. Create the Droplet
DigitalOcean → Create → Droplets:
- Region: **Sydney (SYD1)**
- Image: **Ubuntu 24.04 (LTS) x64**
- Size: Basic, Regular, **1 GB RAM / 1 vCPU** is enough to start
- Authentication: **SSH key** (recommended) or a strong root password
- Optional: tick **Backups**

Note the Droplet's IP address.

## 3. (Optional) Point a domain at it
At your domain registrar, or in DigitalOcean → Networking → Domains, add an **A record** for your domain (e.g. `platform.renew-co.com.au`) pointing to the Droplet IP. Do this before step 4 if you want HTTPS set up automatically.

## 4. Run the setup script
```bash
ssh root@<droplet-ip>
curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/deploy/setup-droplet.sh -o setup.sh
bash setup.sh
```
If the repository is **private**, the raw link and the clone need access. Either make a GitHub fine-grained personal access token (read-only, this repo) and enter the repo URL as `https://<token>@github.com/<owner>/<repo>.git`, or copy `setup-droplet.sh` to the server with `scp`.

The script asks for the repo URL, branch, domain (optional), certificate email, Groq API key and the first admin account. It then:
- installs Node 22, Nginx, the firewall and SQLite tools, and adds 1 GB swap
- clones the code to `/opt/renewco`, installs dependencies and builds the frontend
- writes `Backend/.env` with a random `JWT_SECRET`, keeping the database and uploads in `/var/lib/renewco`
- runs the app as a systemd service (`renewco`) that restarts automatically
- configures Nginx (including the live market stream), opens ports 22/80/443 and gets an HTTPS certificate when a domain is set
- backs up the database nightly to `/var/lib/renewco/backups` (14 days kept)

## Everyday commands
| Task | Command |
|---|---|
| Deploy the latest code from GitHub | `sudo bash /opt/renewco/deploy/update.sh` |
| View logs | `journalctl -u renewco -f` |
| Restart | `sudo systemctl restart renewco` |
| Edit settings (e.g. Groq key) | `sudo nano /opt/renewco/Backend/.env`, then restart |
| Add another admin | `cd /opt/renewco/Backend && sudo -u renewco npm run create-admin -- "Name" email password` |
| Add HTTPS later | `sudo certbot --nginx -d your-domain` |

## Notes
- Moving existing local data: copy your local `Backend/db/carbon_credits.db` to `/var/lib/renewco/carbon_credits.db` (stop the service first, then `chown renewco:renewco` the file).
- The server refuses to start in production without its own `JWT_SECRET`. The setup script generates one; never reuse the development default.
