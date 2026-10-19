# Deployment notes

## Required configuration

Set these values in the deployment environment; do not commit secrets:

- `NODE_ENV=production`
- `PORT`
- `MONGODB_URI`
- `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, and `RESET_SECRETKEY` (each at least 32 characters)
- `CORS_ORIGIN` as a comma-separated list of exact frontend origins
- `TRUST_PROXY_HOPS` to the number of trusted reverse proxies in front of Express
- `CLOUDINARY_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`
- `NODEMAILER_GMAIL` and `NODEMAILER_PASSKEY`
- `ACCESS_TOKEN_EXPIRY`, `REFRESH_TOKEN_EXPIRY`, and `RESET_SECRETKEY_EXPIRY`

Outside production, local HTTP origins on `localhost`, `127.0.0.1`, and `::1` are allowed for Vite development, regardless of the development port. A wildcard `CORS_ORIGIN=*` is ignored locally and rejected in production. Production requires an explicit comma-separated list of exact frontend origins; wildcard origins are never accepted.

## Scaling and database indexes

The rate limiters currently use the process-local memory store, and Socket.IO uses its default process-local adapter. Run a single backend instance unless and until a shared rate-limit store and Socket.IO adapter are configured; multiple replicas otherwise have independent limits and socket rooms.

Database startup synchronizes the OTP indexes. Review the resulting index changes against a production backup before deploying this schema change. The Page text-search index now targets `pageName` and `pageDescription`; existing databases may need the old text index dropped and the corrected index created during a planned migration.

Set `TRUST_PROXY_HOPS` to match the actual proxy chain. Do not trust client-supplied forwarded headers by configuring more hops than the infrastructure controls.
