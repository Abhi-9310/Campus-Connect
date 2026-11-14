# Campus Connect deployment migration

## Target architecture

- Vercel: React + Vite frontend.
- Render: Express API and Socket.IO server.
- MongoDB Atlas: persistent users, connections, messages, and notifications.
- Cloudinary: profile image storage (planned; local uploads are not durable on ephemeral hosts).

## Important current limitations

The current Express server stores application data in local JSON files and profile images in a local `uploads/` directory. Those files are not a reliable production database or file store on an ephemeral hosting instance. Do not deploy this version as the production backend and assume data will persist.

The current frontend also calls relative `/api/...` URLs and opens Socket.IO at `window.location.origin`. Once the API is hosted separately, the frontend must use the Render service URL for both HTTP requests and Socket.IO.

## Migration sequence

1. Create a MongoDB Atlas database and a database user.
2. Add MongoDB persistence to the Express backend and remove JSON-file persistence.
3. Configure the backend to use Render's `PORT`, a required `JWT_SECRET`, and an explicit frontend CORS origin.
4. Change frontend API and Socket.IO URLs to use `VITE_API_URL`.
5. Move avatar uploads from local disk to durable object storage (Cloudinary).
6. Deploy the backend to Render and set its environment variables.
7. Set `VITE_API_URL` in Vercel to the Render service URL and redeploy the frontend.
8. Verify health, registration, login, profile updates, connections, messaging, and socket events.

## MongoDB Atlas setup

1. Create a MongoDB Atlas account and create a free cluster.
2. Create a database user with a strong password. This is separate from the Atlas website login.
3. In Network Access, add the network access rule required by the backend host. For a quick Render setup, Atlas commonly uses `0.0.0.0/0`; protect access with a strong database password and least-privilege database user.
4. Choose Connect -> Drivers and copy the Node.js connection string.
5. Replace the password placeholder in the connection string. Do not commit this URI to GitHub or paste it into source code.
6. Store it as the `MONGODB_URI` environment variable in Render.

## Required backend environment variables

- `MONGODB_URI`: Atlas connection string.
- `JWT_SECRET`: long random secret; never use a hard-coded fallback in production.
- `CLIENT_URL`: deployed Vercel frontend origin, e.g. `https://your-app.vercel.app`.
- `NODE_ENV`: `production`.
- `PORT`: supplied automatically by Render.

## Required frontend environment variable

- `VITE_API_URL`: Render backend origin, e.g. `https://your-api.onrender.com`. No trailing slash.

## Safety

Never commit real credentials, API keys, database passwords, or JWT secrets. If a secret has ever been committed, rotate it rather than merely deleting it from the latest commit.
