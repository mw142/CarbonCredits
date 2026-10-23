#!/usr/bin/env bash
# Pull the latest code, rebuild and restart. Run on the Droplet: sudo bash /opt/renewco/deploy/update.sh
set -euo pipefail
APP_DIR=/opt/renewco
APP_USER=renewco
sqlite3 /var/lib/renewco/carbon_credits.db ".backup '/var/lib/renewco/backups/pre-update-$(date +%F-%H%M).db'" || true
sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only
sudo -u "$APP_USER" bash -c "cd $APP_DIR/Backend && npm ci --omit=dev"
sudo -u "$APP_USER" bash -c "cd $APP_DIR/Frontend && npm ci && npm run build"
install -m 644 "$APP_DIR/deploy/renewco.service" /etc/systemd/system/renewco.service
systemctl daemon-reload
systemctl restart renewco
sleep 3
curl -fsS http://127.0.0.1:4000/api/health && echo " — renewCo. is running"
