#!/usr/bin/env bash
# renewCo. platform — one-time setup on a fresh DigitalOcean Ubuntu 24.04 Droplet.
#
# Run as root on the Droplet:
#   curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/deploy/setup-droplet.sh -o setup.sh
#   sudo bash setup.sh
# or copy this file over and run it. The script asks for anything it needs.
set -euo pipefail

APP_USER=renewco
APP_DIR=/opt/renewco
DATA_DIR=/var/lib/renewco
ENV_FILE="$APP_DIR/Backend/.env"

[[ $EUID -eq 0 ]] || { echo "Run as root (sudo bash setup-droplet.sh)"; exit 1; }

read -rp "Git repository URL (HTTPS, e.g. https://github.com/you/CarbonCredits.git): " REPO_URL
read -rp "Branch to deploy [main]: " BRANCH; BRANCH=${BRANCH:-main}
read -rp "Domain name (leave blank to use the Droplet's IP for now): " DOMAIN
read -rp "Email for HTTPS certificate notices (only if a domain was given): " CERT_EMAIL
read -rsp "Groq API key (blank to skip the chatbot): " GROQ_KEY; echo

echo "==> Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git nginx ufw sqlite3
if ! command -v node >/dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> Adding 1 GB swap (helps the frontend build on small Droplets)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Creating app user and folders"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$DATA_DIR/storage" "$DATA_DIR/backups"
chown -R "$APP_USER:$APP_USER" "$DATA_DIR"

echo "==> Fetching the code"
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch --all && git -C "$APP_DIR" checkout "$BRANCH" && git -C "$APP_DIR" pull
else
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> Writing Backend/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<ENV
NODE_ENV=production
PORT=4000
HOST=127.0.0.1
TRUST_PROXY=1
JWT_SECRET=$(openssl rand -hex 48)
DB_PATH=$DATA_DIR/carbon_credits.db
STORAGE_DIR=$DATA_DIR/storage
GROQ_API_KEY=$GROQ_KEY
GROQ_MODEL=openai/gpt-oss-20b
ENV
  chown "$APP_USER:$APP_USER" "$ENV_FILE"; chmod 600 "$ENV_FILE"
else
  echo "    .env already exists — left unchanged"
fi

echo "==> Installing dependencies and building"
sudo -u "$APP_USER" bash -c "cd $APP_DIR/Backend && npm ci --omit=dev"
sudo -u "$APP_USER" bash -c "cd $APP_DIR/Frontend && npm ci && npm run build"
sudo -u "$APP_USER" bash -c "cd $APP_DIR/Backend && npm run check"

echo "==> Installing the systemd service"
install -m 644 "$APP_DIR/deploy/renewco.service" /etc/systemd/system/renewco.service
systemctl daemon-reload
systemctl enable --now renewco
sleep 3
curl -fsS http://127.0.0.1:4000/api/health && echo

echo "==> Configuring Nginx"
SERVER_NAME=${DOMAIN:-_}
sed "s/__SERVER_NAME__/$SERVER_NAME/" "$APP_DIR/deploy/nginx-renewco.conf" > /etc/nginx/sites-available/renewco
ln -sf /etc/nginx/sites-available/renewco /etc/nginx/sites-enabled/renewco
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> Firewall"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

if [[ -n "$DOMAIN" ]]; then
  echo "==> HTTPS certificate for $DOMAIN (DNS must already point at this Droplet)"
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$CERT_EMAIL" --redirect || \
    echo "    Certificate failed — check the DNS A record, then run: certbot --nginx -d $DOMAIN"
fi

echo "==> Nightly database backup (keeps 14 days)"
cat > /etc/cron.daily/renewco-backup <<CRON
#!/bin/sh
sqlite3 $DATA_DIR/carbon_credits.db ".backup '$DATA_DIR/backups/carbon_credits-\$(date +%F).db'"
find $DATA_DIR/backups -name '*.db' -mtime +14 -delete
CRON
chmod 755 /etc/cron.daily/renewco-backup

echo "==> Create the first administrator"
read -rp "Admin name: " ADMIN_NAME
read -rp "Admin email: " ADMIN_EMAIL
read -rsp "Admin password (min 8 chars): " ADMIN_PASS; echo
sudo -u "$APP_USER" bash -c "cd $APP_DIR/Backend && npm run -s create-admin -- \"$ADMIN_NAME\" \"$ADMIN_EMAIL\" \"$ADMIN_PASS\"" || true

IP=$(curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}')
echo
echo "Done. Open: ${DOMAIN:+https://$DOMAIN}${DOMAIN:-http://$IP}"
echo "Logs:    journalctl -u renewco -f"
echo "Update:  sudo bash $APP_DIR/deploy/update.sh"
