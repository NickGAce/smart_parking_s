# Frontend integration notes

## Role `uk`

Backend documentation currently does not provide a complete permission matrix for role `uk`.
To keep the SPA stable and secure, `uk` is treated as a **restricted role**:

- default post-login route: `/dashboard`
- allowed navigation routes: `/dashboard`, `/notifications`
- all other protected routes redirect to role default route

When backend clarification appears, this matrix should be updated in route guards and navigation config.
