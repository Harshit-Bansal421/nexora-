# Nexora Frontend Screen Map & Feature Architecture

This document maps all Stitch design screens from project **"nexora 1.0"** (Stitch Project ID: `8804274342850910855`) to their respective features and corresponding backend endpoints (`/api/v1/*`).

Stitch screenshots and screen metadata are kept locally as visual references:

- Screenshots: `/frontend/stitch_screens/screenshots/`
- Metadata: `/frontend/stitch_screens/metadata.json`

---

## 1. Design System Tokens & Theme Strategy

The frontend inherits the **"The Collaborative Canvas"** design system extracted from Stitch:

| Token Category       | Value / Spec                                               | Tailwind Utility                                          |
| -------------------- | ---------------------------------------------------------- | --------------------------------------------------------- |
| **Primary Color**    | Action Blue `#005bc4` / Darker `#004fad`                   | `bg-primary`, `text-primary`, `hover:bg-primary-dim`      |
| **Secondary Color**  | Forest `#006d4a` / Mint `#6ffbbe`                          | `bg-secondary`, `bg-secondary-container`                  |
| **Tertiary Accent**  | Warm Amber `#865400` / Gold `#fea619`                      | `bg-tertiary`, `text-tertiary`                            |
| **Surface Base**     | Soft Paper `#f9f9ff`                                       | `bg-surface`                                              |
| **Surface Cards**    | Pure White `#ffffff`                                       | `bg-surface-container-lowest`                             |
| **Surface Layering** | `#f1f3ff` (low), `#e9edff` (mid), `#e0e8ff` (high)         | `bg-surface-container-*`                                  |
| **Display Font**     | `Plus Jakarta Sans`, 600-800 weight                        | `font-headline`                                           |
| **Body & UI Font**   | `Inter`, 400-600 weight                                    | `font-body`, `font-sans`                                  |
| **Roundness**        | 8px default, 12px inputs, 16px cards, 9999px pills         | `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full` |
| **Elevation**        | Tonal Layering + Soft Ambient Glow (`rgba(0,91,196,0.04)`) | `shadow-stitch-soft`, `shadow-stitch-ambient`             |

---

## 2. Feature Group 1: Public Discovery & Landing

### Screens:

1. **Landing Page** (`24679f9664e147f1a8d11b8498e47a79`)
   - _Screenshot_: `screenshots/landing_page_24679f9664e147f1a8d11b8498e47a79.png`
   - _Canvas Variants_: Screens `6c5948bfe49f4b80994314fa68b0b0f1`, `5c69ef8d2479473b83c79e04c6e98874`, `f8f6e648c3374576b0086e5c1763ca9c` (landing iterations).

### UI Purpose & Features:

- Platform introduction: "Empowering Students to Learn, Collaborate, and Excel Together."
- Hero CTA: "Get Started Free" (navigates to `/signup`) and "Sign In" (`/login`).
- Topics showcase: Academic, Career, Tech, Life.
- Trending community pages preview carousel.
- Platform stats and trust indicators (active learners, verified mentors).

### Backend Endpoints Used:

- `GET /api/v1/posts?page=1&limit=4` — Preview high-upvote public posts.
- `GET /api/v1/pages?limit=6` — Display public community hubs preview.
- `GET /api/v1/users/currentuser` — Check if visitor already has an active session (redirects to `/feed`).

---

## 3. Feature Group 2: Authentication & Account Lifecycle

### Screens:

1. **Signup** (`1ca3022b69574b798ad4dbf2d3ff9883`)
   - _Screenshot_: `screenshots/signup_1ca3022b69574b798ad4dbf2d3ff9883.png`
   - _Canvas Variants_: Screens `958de7c6a158454ea35d88b4ae164e7e`, `6e95a279be3449e5b313552bfc56c715`, `e847040b7167400994dbcc3515be819b`.
2. **Verify Email** (`d8ed008d9c194dc697147e5783179401`)
   - _Screenshot_: `screenshots/verify_email_d8ed008d9c194dc697147e5783179401.png`
   - _Canvas Variants_: Screens `da0c696b62454b93904124e454326fee`.
3. **Login** (`0bbc5cdc8d384a53a28fbcfd64535987`)
   - _Screenshot_: `screenshots/login_0bbc5cdc8d384a53a28fbcfd64535987.png`
   - _Canvas Variants_: Screens `3947f3ad986d49099344ff35b6c1285f`, `dc483438a40747c882b9b5be1fd1c56c`.
4. **Forgot Password** (`b052ec0868da49338ab6bd714c04fb92`)
   - _Screenshot_: `screenshots/forgot_password_b052ec0868da49338ab6bd714c04fb92.png`
   - _Canvas Variants_: Screens `c997663693354da4b2fb8ac7eaaed08e`, `291949f0c9d9424db7e45cafd040d693`.
5. **Reset Password** (`bfd31f22ac954887ad808ac3362be8ea`)
   - _Screenshot_: `screenshots/reset_password_bfd31f22ac954887ad808ac3362be8ea.png`
   - _Canvas Variants_: Screens `ef5fbd8a814f45fcac0467738a5584b1`.
6. **Saved Passwords & Security** (`ab609c6a14a44872b3c2e00bc7514d88`)
   - _Screenshot_: `screenshots/saved_passwords_ab609c6a14a44872b3c2e00bc7514d88.png`

### Backend Endpoints Used:

- `POST /api/v1/users/signup` — Multipart form upload (`username`, `email`, `password`, `profileImage`).
- `POST /api/v1/users/verify-email` — Submits 6-digit verification code (`email`, `otp`), activates user session.
- `POST /api/v1/users/resend-email` — Triggers OTP resend for `"email_verify"` or `"password_reset"`.
- `POST /api/v1/users/login` — JSON credentials (`username`, `password`), receives HttpOnly JWT cookies.
- `POST /api/v1/users/forgot-password` — Initiates password reset flow by requesting reset code.
- `POST /api/v1/users/verify-reset-otp` — Verifies reset OTP and stores temporary `ResetToken` cookie.
- `POST /api/v1/users/reset-password` — Finalizes new password submission with `ResetToken`.
- `PATCH /api/v1/users/change-password` — In-app password change (`oldpassword`, `newpassword`, `confirmpassword`).
- `POST /api/v1/users/logout` — Revokes current session cookies.
- `POST /api/v1/users/logout-all` — Revokes all active user sessions across devices.

---

## 4. Feature Group 3: Core Feed, Search & Discovery

### Screens:

1. **Home Page Updated** (`e99d7dd35a71457f90a379cfd72b75b7`)
   - _Screenshot_: `screenshots/home_page_updated_e99d7dd35a71457f90a379cfd72b75b7.png`
   - _Canvas Variants_: Screens `007a235e8fbf46c285f07ddc839b5900`, `441a7ef558ce4405a496d267413abb16`, `5ec7508e5d4e4efb932582c031a2e34e`, `72feab6d00e74bb88cbe9faf13aa685a`, `74ff217e711e48aca7a98d027d87da52`, `e2dbb5f56d414dae8479804a3d694ed6`.
2. **Search Results** (`e41feca028e94c6ea9f3b561d6203d57`)
   - _Screenshot_: `screenshots/search_results_e41feca028e94c6ea9f3b561d6203d57.png`
   - _Canvas Variants_: Screens `2c6e70f6462b4f9eb203d60b6f52c5f3`, `76527ad19bec47838028887ca24d0f98`, `93310d851dc84ccfb68870c5054f1e99`, `d436ab196b7a475485e22b1f63fc93c1`.

### UI Purpose & Features:

- Sticky header with brand logo, universal search input, unread notification bell icon, and user profile avatar.
- Category filter pills: All, Academic, Career, Tech, Life.
- Dynamic feed cards showing:
  - Author info (avatar, username, title/badge e.g., "Legend", "Mentor", timestamp).
  - Post topic badge and title.
  - Formatted description snippet.
  - Multi-image grid and video player support.
  - Action bar: Upvote button with counter, downvote button, comment counter, save bookmark button, and share modal.
- Search Results view showing query match highlights, tab filters (Posts vs Pages), and empty state illustrations.

### Backend Endpoints Used:

- `GET /api/v1/posts/` — Main feed pagination (`?page=1&limit=10`).
- `GET /api/v1/posts/topic/:topic` — Topic filtering (`topic = Academic | Career | Tech | Life`).
- `GET /api/v1/posts/search?search=...` — Intent-based full text search.
- `POST /api/v1/posts/:post_id/vote` — Toggle upvote or downvote (`type: "upvote" | "downvote"`).
- `POST /api/v1/posts/:post_id/save` — Save/bookmark post to user profile.
- `DELETE /api/v1/posts/:post_id/save` — Unsave post.
- `GET /api/v1/notifications/?pages=1&limit=5` — Notification bell badge count.

### WebSockets & Real-Time Sync:

- `reacted-post`: Live update of vote numbers.
- `post-created`: Live badge or auto-prepend when new posts are posted to joined communities.

---

## 5. Feature Group 4: Post Creation & Media Upload

### Screens:

1. **Upload Post** (`f5e913157a5b40c6abcc2caa59fdb4e8`)
   - _Screenshot_: `screenshots/upload_post_f5e913157a5b40c6abcc2caa59fdb4e8.png`
   - _Canvas Variants_: Screens `4974f3a2db964d3da885b6b06e2b299a`, `c873c926680f4a38a40a71ca9607f37f`, `2497c8eb129f4becb44cd1300e58c025`.

### UI Purpose & Features:

- Post composition modal / dedicated screen.
- Title input (with 150 character counter).
- Topic selector dropdown/pills (`Academic`, `Career`, `Tech`, `Life`).
- Community page selection multi-picker (allows posting directly to one or multiple joined pages).
- Rich description text area (with 500 word/character warning).
- Media dropzone supporting up to 3 images and 1 video with instant local preview and removal buttons.
- Publishing state indicators with progress animations.

### Backend Endpoints Used:

- `POST /api/v1/posts/` — Multipart upload (`title`, `topic`, `description`, `pages`, `PostImages`, `PostVideos`).
- `PATCH /api/v1/posts/:post_id` — Edit existing post (`removeImages`, `removeVideos`, `addImages`, `addVideos`, `title`, `description`, `topic`).
- `GET /api/v1/pages/?limit=50` — Loads available community pages for the page selector.
- `POST /api/v1/posts/add/pages/:post_id` — Attach post to additional communities.
- `DELETE /api/v1/posts/remove/pages/:post_id` — Remove post from selected communities.

---

## 6. Feature Group 5: Threaded Discussions & Post Details

### Screens:

1. **Post Comments** (`d8bc027ce42046bbbd8176d4ca47103f`)
   - _Screenshot_: `screenshots/post_comments_d8bc027ce42046bbbd8176d4ca47103f.png`
   - _Canvas Variants_: Screens `bf26e1be03214e598ac6f3d85cb848aa`, `d2ddcaa8be8342b0b4666e0eacbfebb3`, `e442b22fb5654e11a4413ec44aa5a14d`.

### UI Purpose & Features:

- Full post view with high-res media display.
- Sort toggle for discussions: "Top" (by upvotes) vs "Latest" (newest first).
- Pinned comment banner (highlighted with distinctive soft-blue container).
- Helpful badge indicator for verified solutions (awards +10 XP).
- Infinite threaded reply tree with expandable/collapsible child replies.
- Real-time typing indicators ("sarah_k is typing...").
- Floating / sticky comment input bar with reply recipient indicator.

### Backend Endpoints Used:

- `GET /api/v1/posts/:post_id` — Retrieves post details and author meta.
- `GET /api/v1/comments/post/:post_id` — Fetches top-level comments (`parentComment=null&sort=top`).
- `GET /api/v1/comments/post/:post_id?parentComment=:comment_id` — Fetches child replies for nested thread.
- `POST /api/v1/comments/post/:post_id` — Post comment or reply (`body`, `parentComment`).
- `POST /api/v1/comments/:comment_id/upvote` — Upvote comment.
- `POST /api/v1/comments/:post_id/:comment_id/status` — Mark comment as `"pinned"` or `"helpful"` (post owner only).
- `PATCH /api/v1/comments/:comment_id` — Edit comment.
- `DELETE /api/v1/comments/:comment_id` — Delete comment.

### WebSockets & Real-Time Sync:

- `join-post` / `leave-post`: Room management.
- `new-comment`: Instantly adds comment to thread.
- `comment-vote-update`: Live upvote tally update.
- `comment-status`: Real-time pin/helpful badge shift.
- `typing` / `stop-typing`: Typing indicator broadcast.

---

## 7. Feature Group 6: Community Pages (Explore, View & Governance)

### Screens:

1. **Page Explore** (`be4f3a1e22134910a8db933e44afe76d`)
   - _Screenshot_: `screenshots/page_explore_be4f3a1e22134910a8db933e44afe76d.png`
   - _Canvas Variants_: Screens `11a9b00cb64444c9a1907fbb1bc0c9dc`, `3d38ec8fe6704acd81a140ac24567a9d`, `e6fc93875e184d7cb3459f59351d239e`.
2. **Page View** (`e2caf79ed827436490d3c89195828e68`)
   - _Screenshot_: `screenshots/page_view_e2caf79ed827436490d3c89195828e68.png`
   - _Canvas Variants_: Screens `14139082e251404f9243c4b8db78dbe9`, `1e24591e1c5a4aaba0d22f1d6c92a1e2`, `2792c2b8586c4bdd98f10e24f344dff4`, `7a0159d4757343ac91a689fcc5fc21c3`, `807a1b60bf7a490aa7cebec29ff1be7a`, `ab72735b3b1546d6a01d335365b0b532`.
3. **Page Info - Updated Navigation** (`06aaa0d4367844fdabe35973fc4e8e93`)
   - _Screenshot_: `screenshots/page_info_-_updated_navigation_06aaa0d4367844fdabe35973fc4e8e93.png`
   - _Canvas Variants_: Screens `3e895fe688494c188374ca3ac6ad9b6d`, `43def96b108c4f5d8537308d93321857`, `a76e5e56a98041fd9e9508df569249f8`, `d03c76f3fcba40c187d37546a404773b`, `e26f0120cf73472d8ebaded9c421dd8b`.

### UI Purpose & Features:

- **Explore Pages**: Grid of active communities, categorized by topic tags, with member counts, public/private lock icons, and quick-join buttons.
- **Page View**: Hero banner, community profile avatar, description, member count, moderator avatars, and dedicated feed filtered to posts inside this page.
- **Page Management & Governance**:
  - Open vs Private badge.
  - Join request modal for private communities (with custom message).
  - Pending member approval queue for moderators & owners.
  - Member roster with role badges ("Owner", "Moderator", "Member").
  - Role management: Appoint moderator, revoke moderator, remove member, transfer ownership before leaving.
  - Edit community metadata (name, description, tags, banner).

### Backend Endpoints Used:

- `GET /api/v1/pages/` — Explore all community pages with search/topic filters.
- `POST /api/v1/pages/` — Create new page (multipart: `pageName`, `pageDescription`, `title`, `type`, `pageProfileImage`).
- `GET /api/v1/pages/:page_id` — Page details, permissions, user role (`owner`, `moderator`, `member`, `viewer`).
- `GET /api/v1/posts/page/:pageid` — Community post stream.
- `POST /api/v1/pages/:page_id/join` — Join open page or submit join request for private page.
- `DELETE /api/v1/pages/:page_id/leave` — Leave page (passing `newOwner` if owner).
- `PATCH /api/v1/pages/:page_id` — Update community metadata.
- `DELETE /api/v1/pages/:page_id` — Delete community page.
- `GET /api/v1/pages/:page_id/members` — Member roster list.
- `DELETE /api/v1/pages/:page_id/members` — Remove users from community.
- `POST /api/v1/pages/:page_id/moderators` — Add member to moderators.
- `DELETE /api/v1/pages/:page_id/moderators` — Remove moderator privileges.
- `GET /api/v1/pages/:page_id/requests` — View pending join requests.
- `POST /api/v1/pages/:page_id/request` — Accept/reject pending join request (`status: "approved" | "reject"`).

### WebSockets & Real-Time Sync:

- `join-page` / `leave-page`
- `joined-page`, `removeuser-page`, `responseJoin-page`
- `updated-page`, `deleted-page`, `madeModerator-page`

---

## 8. Feature Group 7: User Profile, Settings & Saved Posts

### Screens:

1. **User Profile** (`3e4bd033b57a44c391ad651a003c5202`)
   - _Screenshot_: `screenshots/user_profile_3e4bd033b57a44c391ad651a003c5202.png`
   - _Canvas Variants_: Screens `1ef595b02c844aa08f20093cb7569ec2`, `5264bd620b8340e28c9df5dcd57005ef`, `0b5b440a961e45aa9b7fd06763519b9a`, `9d12163b1b604c07ad58c65c71982b8e`, `f6818d6cb29540699ffe9646e137669f`.
2. **Edit Info** (`c92c129115ae403382e541e63df8b234`)
   - _Screenshot_: `screenshots/edit_info_c92c129115ae403382e541e63df8b234.png`
   - _Canvas Variants_: Screens `d1d0235a1a844541948ba45d2038188e`, `ae41dce7f58e42768f5f3d8687dcb32e`, `5cdf1894e6674b3ebcbfdc3fa81abdb5`, `79b7d97dfc9f48789c601775b68561a2`, `cd98e35a77214e24b40066ac89ffead2`, `bbd90ff2a7e54cc8b824b6b2f5cd0dad`.
3. **Settings** (`a2e697a7bef244ea80abe8d3594ad44f`)
   - _Screenshot_: `screenshots/settings_a2e697a7bef244ea80abe8d3594ad44f.png`
   - _Canvas Variants_: Screens `a443281008d243af8b3284c93a3de844`, `3c563f0813ec4a49a32eb1b560861486`, `3966f82403c74d20a76ebe2d75d4d1c2`.

### UI Purpose & Features:

- Profile banner and avatar with level/rank indicator (e.g., "Legend", "Mentor", "Helper", "Contributor", "Newcomer").
- XP progression bar towards the next rank.
- Followers / Following tally with Follow / Unfollow interactive button.
- Profile Tabs:
  - **Posts**: User's published contributions.
  - **Saved**: Private bookmarks collection (accessible only to profile owner).
  - **About / Badges**: Verified badges and profile bio.
- **Edit Info**: Update username, profile bio, change avatar preview.
- **Settings**: Account preferences, change password, session termination (Logout, Logout All Devices).

### Backend Endpoints Used:

- `GET /api/v1/users/currentuser` — Logged-in profile data.
- `GET /api/v1/posts/user/:username` — Public post history of the specified user.
- `GET /api/v1/posts/saved` — Bookmarked posts collection.
- `POST /api/v1/users/follow/:user_id` — Follow target user.
- `DELETE /api/v1/users/unfollow/:user_id` — Unfollow target user.
- `PATCH /api/v1/users/update-username` — Change username.
- `PATCH /api/v1/users/change-password` — Change password.
- `POST /api/v1/users/logout` — Logout.
- `POST /api/v1/users/logout-all` — Logout all devices.

### WebSockets:

- `join-user` / `leave-user`: Live follow count updates.
- `followed-user` / `following-user` broadcasts.

---

## 9. Feature Group 8: Notifications & Activity Stream

### Screens:

1. **Notifications** (`54d2d4d2cc3e4f7eb9a2a5064ad50c5a`)
   - _Screenshot_: `screenshots/notifications_54d2d4d2cc3e4f7eb9a2a5064ad50c5a.png`
   - _Canvas Variants_: Screens `de2162f2e83b43078e7719c2accbd108`, `8f673f1fb7884c56a3dce44e4e4ad89a`, `05f0d4d77e2b488c87416afd89485c28`, `d02589f3d95e4cb68bcb5be428c4e3c8`.

### UI Purpose & Features:

- Notification inbox grouped by unread / read states.
- Type-specific visual icons and avatars:
  - Comments & Replies (`MessageSquare`).
  - Upvotes (`ArrowBigUp`).
  - Helpful solutions marked (`CheckCircle2`).
  - Page membership & moderator appointments (`ShieldCheck`, `Users`).
  - Join requests approvals/rejections (`UserCheck`, `UserX`).
- Quick actions: "Mark all as read" button.
- Click-to-navigate action: jumps directly to the relevant post, comment, or community page.

### Backend Endpoints Used:

- `GET /api/v1/notifications/?pages=1&limit=20` — Fetch unread notifications.
- `GET /api/v1/notifications/:notification_id/read` — Mark item as read on click.
- `GET /api/v1/notifications/all/read-all` — Mark entire inbox as read.

### WebSockets:

- `notification`: Live event pushed immediately to user's active socket, triggering an interactive toast notification and updating the notification badge in real time.

---

## 10. Design & Backend Discrepancies Resolution Matrix

In compliance with **STEP 3**, where Stitch designs and the frozen backend disagree, the frontend gracefully adapts while preserving the visual layouts:

| Area                         | Stitch Design                              | Frozen Backend Reality                                                                                  | Frontend Adaptation Strategy                                                                                                        |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **App Branding**             | "HelpHub" displayed in some screen mockups | Backend is named "Nexora"                                                                               | Display "Nexora" with tagline "The Collaborative Learning Hub"; keep layout and aesthetics identical.                               |
| **User Roles & Titles**      | Static UI badges                           | Model enum: `["Newcomer", "Contributor", "Helper", "Mentor", "Legend"]` with XP thresholds              | Compute titles and XP progress bars dynamically from backend `point` and `title` fields.                                            |
| **Notifications Pagination** | Standard `?page=1`                         | Backend controller expects `?pages=1` (plural)                                                          | API client query builder adapts: maps `page` to `pages` specifically for `/notifications/` requests.                                |
| **Post Images & Videos**     | Multiple media cards                       | Multer accepts max 3 images and 1 video                                                                 | File dropzone enforces max 3 image files and 1 video file with clear user feedback.                                                 |
| **Social Login Buttons**     | Google / GitHub buttons in login screen    | Backend has basic `googleId` field in model but auth controller only implements username/password + OTP | Keep social buttons in UI with graceful "Coming soon" notification toast; prioritize username/password and email verification flow. |
| **Comment Threading**        | Deeply nested comment layout               | Aggregation supports `parentComment` hierarchy with `statusPriority`                                    | Frontend fetches top-level comments and lazy-loads child replies when user clicks "View Replies", respecting the backend structure. |
| **Search Tab Filters**       | Tabs for "Posts", "People", "Pages"        | Backend has text search for posts (`/posts/search`) and text search for pages (`/pages?search=...`)     | Frontend runs parallel queries to `/posts/search` and `/pages?search=...` when switching tabs, delivering seamless unified search.  |
