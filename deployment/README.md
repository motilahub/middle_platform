# Middle Platform Offline Deployment

This directory is self-contained. It includes the application images in `images.tar` and does not require internet access after Docker itself is installed.

1. Extract the package on the target server.
2. Run `./deploy.sh`.
3. Open `http://<server-address>:8080`.

On the first run, `deploy.sh` creates `.env` with random database, session, and model-provider credential-encryption secrets. Keep `MODEL_PROVIDER_ENCRYPTION_KEY` unchanged after model-provider API Keys have been saved, otherwise those credentials can no longer be decrypted. Edit `.env` before deployment only when a different port or HTTPS cookie setting is required. After HTTPS is terminated in front of the service, set `COOKIE_SECURE=true` and run `./deploy.sh` again. When deploying a newer package, keep the existing `.env`; the script preserves its secrets and updates `IMAGE_TAG` to the package version automatically.

The service data is kept in Docker volumes named `middle_platform_postgres_data` and `middle_platform_upload_data`. Re-running the script preserves those volumes. To inspect the deployment, run `docker compose --env-file .env -f docker-compose.offline.yaml ps`.
