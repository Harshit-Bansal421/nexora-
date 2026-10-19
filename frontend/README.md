# Nexora frontend

The frontend is a Vite, React, and Tailwind CSS application. The screens in
`src/pages/` are rendered through React Router in `src/App.jsx`. The
`stitch_screens/` directory is retained as a design reference; it is not served
as part of the application.

## Run locally

```sh
npm install
npm run dev
```

## Stitch screen routes

| Route | Screen |
|---|---|
| `/` or `/landing` | Landing page |
| `/signup` | Sign up |
| `/login` | Log in |
| `/verify-email` | Verify email |
| `/forgot-password` | Forgot password |
| `/reset-password` | Reset password |
| `/settings/security` | Saved passwords and security |
| `/feed` or `/home` | Home |
| `/search` | Search results |
| `/profile/:username` | User profile |
| `/settings` | Settings |
| `/pages/explore` | Explore pages |
| `/pages/:pageId` | Page view |
| `/pages/:pageId/info` | Page information |
| `/posts/:postId/comments` | Post comments |
| `/posts/new` | Create a post |
| `/notifications` | Notifications |
| `/profile/edit` | Edit profile |

Tailwind uses the theme tokens defined in `tailwind.config.js`; PostCSS loads
Tailwind and Autoprefixer from `postcss.config.js`.
