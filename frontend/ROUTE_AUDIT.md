# Nexora Route Audit

Audit status below records the evidence collected to date; “Limited” means a route rendered or was partly exercised, not that all its workflows passed.

## Frontend Routes (App.jsx)

| Path | Page Component | Backend Calls (approx.) | Auth Required | Status | Notes |
|------|----------------|------------------------|---------------|--------|-------|
| `/` | LandingPage | `GET /api/v1/pages`, `GET /api/v1/posts` | No | Limited | Rendered; page also exposes public discovery content. |
| `/landing` | LandingPage | Same as `/` | No | Limited | Alias for `/`. |
| `/signup` | SignupPage | `POST /api/v1/users/signup` | No | Limited | Flow not submitted in this pass. |
| `/login` | LoginPage | `POST /api/v1/users/login`, `GET /api/v1/users/currentuser` | No | Limited | Login succeeded for `naruto_u`; logged out after the authenticated checks. A second user was not tested. |
| `/verify-email` | VerifyEmailPage | `POST /api/v1/users/verify-email`, `POST /api/v1/users/resend-email` | No | Limited | OTP flow not exercised. |
| `/forgot-password` | ForgotPasswordPage | `POST /api/v1/users/forgot-password` | No | Limited | Not submitted. |
| `/reset-password` | ResetPasswordPage | `POST /api/v1/users/verify-reset-otp`, `POST /api/v1/users/reset-password` | No | Limited | Not submitted. |
| `/settings/security` | SecuritySettingsPage | `GET /api/v1/posts/saved`, `PATCH /api/v1/users/change-password`, `POST /api/v1/users/logout-all` | Yes (`RequireAuth`) | Limited | Saved Vault selected correctly with `?tab=saved`; security workflows not tested. |
| `/feed` | HomePage | `GET /api/v1/posts` or `GET /api/v1/posts/topic/:topic` | No | Limited | Rendered while signed in; `GET /api/v1/posts?page=1&limit=10` returned 200. Filter actions not all tested. |
| `/home` | HomePage | Same as `/feed` | No | Limited | Alias for feed. |
| `/search` | SearchResultsPage | `GET /api/v1/posts/search?search=…`, `GET /api/v1/pages?search=…` | No | Limited | Fixed the undefined `query` variable in the empty community-results branch; query route rendered after the fix. |
| `/pages/explore` | PageExplorePage | `GET /api/v1/pages`, page/member reads, join/leave and create actions | No to browse; login for mutations | Limited | Seeded communities displayed; older orphaned records reported server failures. Community cover images now use the shared image fallback. |
| `/pages/:pageId` | PageViewPage | `GET /api/v1/pages/:page_id`, `GET /api/v1/posts/page/:pageid`, member/join/leave calls | No to view; login for mutations | Limited | Seeded page/posts rendered; ancillary 500s appeared in browser. Socket joining now requires authentication. Community cover images now use the shared image fallback. |
| `/pages/:pageId/info` | PageInfoPage | `GET /api/v1/pages/:page_id`, members, requests, update, moderator/member actions, delete | Mixed; role-gated writes | Limited | The backend detail route is `/:page_id` (not `/:page_id/info`); roster/moderation flows not tested. Owner/member avatars and cover images now use shared fallbacks. |
| `/posts/new` | UploadPostPage | `GET /api/v1/pages`, `POST /api/v1/posts` (multipart) | Yes (`RequireAuth`) | Limited | Created one labeled diagnostic post (201); it navigated directly to its detail route and was deleted after verification. |
| `/posts/:postId/comments` | PostCommentsPage | `GET /api/v1/posts/:post_id`, `GET/POST /api/v1/comments/post/:post_id`, comment upvote/status calls | Public read; writes require login | Limited | After the approved aggregation fix, seeded and older posts returned 200 on initial load and reload; a fake ID returned 404 and showed “Post unavailable.” Nested replies rendered. The seeded external image URL returned 500 from `loremflickr.com`; the post API remained 200. The API response omits page references and saved state, and this page does not show vote/save controls. Post image and author/comment avatars now render shared fallbacks on image failure. |
| `/notifications` | NotificationsPage | `GET /api/v1/notifications`, read/read-all PATCH calls | Yes (`RequireAuth`) | Limited | List rendered; missing React key warning fixed and not reproduced on revisit. |
| `/profile/edit` | EditProfilePage | `PATCH /api/v1/users/update-username` | Yes (`RequireAuth`) | Limited | Full profile edit not tested. |
| `/profile/:username` | UserProfilePage | `GET /api/v1/posts/user/:username`, saved-post and follow/unfollow calls | No to view; protected operations require login | Limited | Own/other profiles not fully tested. |
| `/settings` | SettingsPage | Auth/logout actions | Yes (`RequireAuth`) | Limited | Rendered. |
| `*` | Redirect to `/` | None | No | Limited | Catch-all redirects; no standalone 404 screen. |

The private community request buttons now say `Requested` after a request is submitted; persistent pending state across reload is not available from the public page-list/detail response and needs backend support or a user-specific request-status endpoint.

## UI Navigation Elements

### Navbar (src/components/Navbar.jsx)

| Component | Type | Destination Route | Notes |
|-----------|------|-------------------|-------|
| Brand logo (Link) | Link | `/feed` (if authenticated) else `/` | Top‑left logo |
| Feed link | Link | `/feed` | Visible on desktop |
| Explore Hubs link | Link | `/pages/explore` | Desktop |
| New Post link (button) | Link | `/posts/new` | Desktop |
| Notification Bell | Link | `/notifications` | Shows unread count |
| Profile dropdown – My Profile | Link | `/profile/<username>` | Opens profile |
| Profile dropdown – Edit Profile | Link | `/profile/edit` |
| Profile dropdown – Saved Posts | Link | `/settings/security?tab=saved` |
| Profile dropdown – Settings | Link | `/settings` |
| Profile dropdown – Log out | Button | – (calls logout API) |
| Log In button (when not auth) | Link | `/login` |
| Sign Up button (when not auth) | Link | `/signup` |

### Bottom Navigation (src/components/BottomNav.jsx)

| Component | Type | Destination Route | Notes |
|-----------|------|-------------------|-------|
| Home tab | Link | `/feed` |
| Explore tab | Link | `/pages/explore` |
| Create tab (large plus) | Link | `/posts/new` |
| Search tab | Link | `/search` |
| Profile tab | Link | `/profile/<username>` (or `/login` if not auth) |

### Profile Menu (Navbar dropdown)

| Item | Destination | Notes |
|------|-------------|-------|
| My Profile | `/profile/<username>` |
| Edit Profile | `/profile/edit` |
| Saved Posts | `/settings/security?tab=saved` |
| Settings | `/settings` |
| Log out | Triggers logout action |

### Post Card Footer Buttons (src/components/PostCard.jsx)

| Button | Action | API Call |
|--------|--------|----------|
| Upvote | votePost(type=`upvote`) | POST /api/v1/posts/:postId/vote |
| Downvote | votePost(type=`downvote`) | POST /api/v1/posts/:postId/vote |
| Comment count (link) | Navigate to comments | GET /api/v1/posts/:postId/comments |
| Save / Unsave | savePost / unsavePost | POST /api/v1/posts/:postId/save OR DELETE /api/v1/posts/:postId/save |
| Share | Copy link (no API) |

## Backend Endpoints

| Method | Path | Controller | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/posts` | getPost | List all posts (public) |
| GET | `/api/v1/posts/search` | searchOnText | Search posts |
| GET | `/api/v1/posts/topic/:topic` | getTopicPosts | Posts by topic |
| GET | `/api/v1/posts/user/:username` | getUserPosts | Posts by user |
| GET | `/api/v1/posts/saved` | getSavePost | Saved posts for logged‑in user |
| GET | `/api/v1/posts/page/:pageid` | getPagePost | Posts belonging to a page |
| POST | `/api/v1/posts` | createPost | Create a new post (auth) |
| POST | `/api/v1/posts/add/pages/:post_id` | AddExistingPostToPage | Add post to hub (owner) |
| DELETE | `/api/v1/posts/remove/pages/:post_id` | removeExistingPostFromPage | Remove post from hub |
| POST | `/api/v1/posts/:post_id/vote` | reactToPost | Vote on post |
| POST | `/api/v1/posts/:post_id/save` | savePost | Save post |
| DELETE | `/api/v1/posts/:post_id/save` | unsavePost | Unsave post |
| PATCH | `/api/v1/posts/:post_id` | updatePost | Update post (auth & owner) |
| DELETE | `/api/v1/posts/:post_id` | deletePost | Delete post |
| GET | `/api/v1/posts/:post_id` | getPostById | Get single post |
| POST | `/api/v1/comments/post/:post_id` | createComment | Add comment to post |
| GET | `/api/v1/comments/post/:post_id` | getComnment | Get comments for post |
| DELETE | `/api/v1/comments/:comment_id` | deleteComment | Delete comment (owner) |
| PATCH | `/api/v1/comments/:comment_id` | editComment | Edit comment |
| POST | `/api/v1/comments/:comment_id/upvote` | upvoteComment | Upvote comment |
| POST | `/api/v1/comments/:post_id/:comment_id/status` | statusComment | Change comment status (post owner) |
| GET | `/api/v1/pages` | getPages | List all pages |
| POST | `/api/v1/pages` | createPage | Create new page (auth) |
| GET | `/api/v1/pages/:page_id` | getParticularPage | Get page details |
| PATCH | `/api/v1/pages/:page_id` | updatePageinfo | Update page (owner) |
| DELETE | `/api/v1/pages/:page_id` | deletePage | Delete page (owner) |
| POST | `/api/v1/pages/:page_id/join` | joinPage | Join page |
| DELETE | `/api/v1/pages/:page_id/leave` | leavePage | Leave page |
| POST | `/api/v1/pages/:page_id/moderators` | makeModerator | Add moderator |
| DELETE | `/api/v1/pages/:page_id/moderators` | removeModerator | Remove moderator |
| GET | `/api/v1/pages/:page_id/members` | seeMembersList | List members |
| DELETE | `/api/v1/pages/:page_id/members` | removeUser | Remove member |
| GET | `/api/v1/pages/:page_id/requests` | seePendingRequest | List join requests |
| POST | `/api/v1/pages/:page_id/request` | approvePendingRequest | Approve join request |
| POST | `/api/v1/users/signup` | SignupUser | Register new user |
| POST | `/api/v1/users/login` | loginUser | Authenticate |
| POST | `/api/v1/users/refreshToken` | getNewAccessToken | Refresh JWT |
| POST | `/api/v1/users/verify-email` | verifyEmailandLogin | Verify email |
| POST | `/api/v1/users/resend-email` | resendEmail | Resend verification |
| POST | `/api/v1/users/forgot-password` | forgotPassword | Request password reset |
| POST | `/api/v1/users/verify-reset-otp` | verifyResetOTP | Verify OTP |
| POST | `/api/v1/users/reset-password` | resetPassword | Reset password |
| POST | `/api/v1/users/follow/:user_id` | followUser | Follow user |
| DELETE | `/api/v1/users/unfollow/:user_id` | unfollowUser | Unfollow user |
| POST | `/api/v1/users/logout` | logoutUser | Logout current session (auth required) |
| POST | `/api/v1/users/logout-all` | logoutUserAllDevice | Logout all sessions (auth required) |
| GET | `/api/v1/users/currentuser` | getCurrentUser | Get current account (auth required) |
| PATCH | `/api/v1/users/update-username` | updateUsername | Update username (auth required) |
| PATCH | `/api/v1/users/change-password` | UpdatePassword | Change password (auth required) |
| GET | `/api/v1/notifications` | getNotification | Get user's notifications |
| PATCH | `/api/v1/notifications/:notification_id/read` | markRead | Mark one notification read |
| PATCH | `/api/v1/notifications/all/read-all` | markReadAll | Mark all read |

## Socket.IO Events (src/socket.js)

| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| Client → Server | `join-page` | pageId | Join a page room for real‑time updates |
| Server → Client | `socket-error` | error message |
| Client → Server | `leave-page` | pageId |
| Client → Server | `join-post` | postId |
| Client → Server | `leave-post` | postId |
| Client → Server | `join-user` | userId (must match own id) |
| Client → Server | `leave-user` | userId |
| Client → Server | `typing` | emitted via `broadcastTyping('typing')` with postId |
| Client → Server | `stop-typing` | emitted via `broadcastTyping('stop-typing')` |
| Server → Client | `typing` / `stop-typing` | username, profileImage, badge |

> **Note:** All routes marked *Unknown* status will be validated in subsequent phases.

## Current evidence and remaining work

- Worktree already contained prior changes across backend source; this continuation did not edit backend source.
- The user-approved database reseed completed previously: 35 users, 8 communities, 120 posts, 405 comments, 3 join requests, 46 notifications and 0 OTPs. No new data changes were made as part of this route inventory.
- The backend post-detail 500 was traced to an invalid aggregation pipeline stage in `src/controllers/post.controller.js` around line 411. Backend edit requires separate explicit approval.
- Older orphaned communities can fail because the populated owner is null and dereferenced in `src/controllers/page.controller.js` around line 783. No data was altered to mask this failure.
- Saved Posts was retested and selected the Saved Vault tab. Frontend lint/build passed after the notifications list-key adjustment.
- Full route-by-route and responsive testing remains outstanding. Do not mutate existing posts/users while conducting it; any new test post must be identified, listed, and deleted only after separately confirming its exact identity.
