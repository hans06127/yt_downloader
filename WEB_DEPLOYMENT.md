# Web deployment

This branch keeps the packaged Windows desktop flow as the default and adds a separated web runtime.

## Architecture

- Frontend: static Next.js export
- Backend: Flask + Gunicorn, one worker
- Job state: SQLite
- Download artifacts: per-job server directory, delivered as a ZIP
- Cookies: isolated by the browser client identifier
- Cleanup: background TTL cleanup for job state, artifacts and inactive cookies

The SQLite queue and in-process downloader are intentionally single-instance.
Run exactly one Gunicorn worker. Horizontal scaling requires an external queue
and shared object storage.

## Frontend

Copy `frontend/.env.example` to the environment configuration and set:

~~~env
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
NEXT_PUBLIC_USE_MOCK=false
~~~

The API URL may include `/api`; the frontend normalizes both forms.

Build the static frontend:

~~~bash
cd frontend
npm ci
npm run build:export
~~~

## Backend

Install the web requirements:

~~~bash
python -m pip install -r requirements-web.txt
~~~

Set the variables described in `.env.web.example`, then run:

~~~bash
gunicorn --workers 1 --threads 8 --timeout 0 --bind 0.0.0.0:$PORT app:app
~~~

At minimum configure:

~~~env
YT_DOWNLOADER_RUNTIME=web
YT_DOWNLOADER_CORS_ORIGINS=https://frontend.example.com
YT_DOWNLOADER_WEB_DATA_DIR=/data/yt-downloader
~~~

The data directory must be writable and should use a persistent volume.

## Browser download flow

1. The browser creates a random local client identifier.
2. API and SSE requests send it through `X-Client-Id`.
3. The backend stores jobs and cookies under that client identity.
4. Completed files are archived per job.
5. The frontend downloads the ZIP through `/api/job-download/:jobId`.
6. Expired database records, files and cookies are removed by the cleanup loop.

## Security boundary

The client identifier prevents accidental cross-user mixing but is not account
authentication. Do not expose a public multi-user production service until real
authentication, authorization, rate limits and abuse controls are added.

YouTube cookies are sensitive credentials. Use HTTPS, restrict CORS to the exact
frontend origin, mount private backend storage and keep the TTL short.

## Validation

~~~bash
python -m unittest discover -s tests -p "test_*.py"
cd frontend
npm ci
npm run lint
npm run build
~~~
