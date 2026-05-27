# Where Work

A Node.js + Express + Handlebars app for construction job tracking.

## Features

- Track construction jobs by address and map location.
- Google Maps integration with place autocomplete and map marker selection.
- Upload multiple site photos for each job.
- Upload large batches of site photos for each job (no fixed photo count limit).
- Capture work brief notes for completed work.
- Record materials used and materials left on site.
- Assign one or more workers to each job.
- Manage worker list from a dedicated workers page.
- Automatically compress and resize uploaded images for mobile-friendly storage.

## Stack

- Express
- express-handlebars
- MongoDB with Mongoose
- Multer for image uploads
- express-validator for form validation

## Setup

1. Install dependencies:

   npm install

2. Copy environment values:

   copy .env.example .env

3. Edit .env and set:

   - MONGO_URI
   - GOOGLE_MAPS_API_KEY
   - AUTH0_SECRET
   - AUTH0_BASE_URL
   - AUTH0_CLIENT_ID
   - AUTH0_CLIENT_SECRET
   - AUTH0_ISSUER_BASE_URL
   - AUTH0_METADATA_NAMESPACE

4. Run app:

   npm run dev

5. Open browser:

   http://localhost:3000

## Materials Input Format

Use one line per material in this format:

name|quantity|unit

Example:

Concrete|3|bags
Sand|1.5|m3

## Notes

- Uploaded images are saved in public/uploads.
- Uploaded images are compressed to optimized JPEG files on the server.
- Authentication is powered by Auth0 (`express-openid-connect`).

## Roles

- Access flags are stored as Auth0 user metadata:
   - `app_metadata.admin: true|false`
   - `app_metadata.supervisor: true|false`
- `Admin` has full access and is the only user type allowed to edit user access.
- User access management UI is available at `/admin/users` (Admin only).
- Application routes (`/jobs`, `/calendar`, `/workers`, `/materials`, `/checklists`) require either `admin=true` or `supervisor=true`.
- Set the first admin manually in Auth0 user metadata, then use `/admin/users` for ongoing access changes.
