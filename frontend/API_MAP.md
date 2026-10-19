# Nexora Backend API & WebSocket Specification Map

This document contains the complete and authoritative API and WebSocket specification for the Nexora backend (`/api/v1`).
All endpoints, authentication rules, parameter requirements, payload schemas, response structures, and real-time Socket.io events are extracted directly from the frozen backend codebase (`src/app.js`, `src/routes`, `src/controllers`, `src/middleware`, `src/models`, and `src/socket.js`).

---

## 1. Global Architecture & Network Rules

- **Base URL**: `http://localhost:8000/api/v1` (or relative path `/api/v1` with Vite proxy)
- **CORS & Credentials**:
  - `cors({ origin: process.env.CORS_ORIGIN, credentials: true })`
  - Frontend requests MUST set `withCredentials: true` (or Axios `axios.defaults.withCredentials = true`) so that cookies (`AccessToken`, `RefreshToken`, `ResetToken`) are transmitted automatically.
- **Authentication Mechanism**:
  - JWT Access Token stored in HTTP-only cookie `AccessToken` or passed in HTTP Header `Authorization: Bearer <AccessToken>`.
  - JWT Refresh Token stored in HTTP-only cookie `RefreshToken`.
  - Password Reset Token stored in HTTP-only cookie `ResetToken`.
- **Standard Response Envelope (`ApiResponse.js`)**:
  All successful responses follow this shape:
  ```json
  {
    "statuscode": 200,
    "data": { ... },
    "message": "success message",
    "status": true
  }
  ```
- **Standard Error Envelope (`ApiError.js`)**:
  All error responses return:
  ```json
  {
    "statuscode": 400,
    "message": "error description",
    "error": [],
    "data": null,
    "success": null
  }
  ```
- **Rate Limiting (`src/middleware/RateLimiting.js`)**:
  - `authLimiter`: 5 requests per 60 seconds (window 1 min).
  - `writeLimiter`: 20 requests per 60 seconds.
  - `readLimiter`: 100 requests per 60 seconds.
  - `sensitiveLimiter`: 3 attempts per 15 minutes.

---

## 2. Authentication & User Endpoints (`/api/v1/users`)

### 2.1 Sign Up
- **Method**: `POST`
- **Path**: `/api/v1/users/signup`
- **Auth Needed**: None (Public)
- **Middleware**: `ratelimit.authLimiter()`, `upload.avatarUpload("profileImage")`
- **Content-Type**: `multipart/form-data`
- **Request Body**:
  | Field | Type | Required | Description |
  |---|---|---|---|
  | `username` | String | Yes | 4 to 20 characters, lowercase, unique |
  | `email` | String | Yes | Valid email address, unique |
  | `password` | String | Yes | Minimum 5 characters |
  | `profileImage` | File | Yes | Image (jpeg, jpg, png, webp, max 4MB) |
- **Behavior**: Saves registration data into temporary `OTP` collection (10 min expiry) and dispatches 6-digit OTP to user's email.
- **Response Shape (201 Created)**:
  ```json
  {
    "statuscode": 201,
    "data": "Verification code sent to your email",
    "message": "success",
    "status": true
  }
  ```

### 2.2 Verify Email & Initial Login
- **Method**: `POST`
- **Path**: `/api/v1/users/verify-email`
- **Auth Needed**: None (Public)
- **Middleware**: `ratelimit.authLimiter()`
- **Content-Type**: `application/json`
- **Request Body**:
  | Field | Type | Required | Description |
  |---|---|---|---|
  | `email` | String | Yes | Registered email |
  | `otp` / `OTP` | String | Yes | 6-digit OTP string |
- **Cookies Set**:
  - `AccessToken` (HttpOnly, Secure, SameSite=Strict)
  - `RefreshToken` (HttpOnly, Secure, SameSite=Strict)
- **Response Shape (201 Created)**:
  ```json
  {
    "statuscode": 201,
    "data": {
      "user": {
        "_id": "6712b7a9e102f90a1b8c1234",
        "username": "alexrivera",
        "email": "alex@example.com",
        "title": "Newcomer",
        "point": 0,
        "profileImage": "https://res.cloudinary.com/.../image.jpg",
        "followers": [],
        "following": [],
        "savedPost": [],
        "bio": "",
        "badges": [],
        "googleId": "",
        "createdAt": "2026-10-18T10:00:00.000Z",
        "updatedAt": "2026-10-18T10:00:00.000Z",
        "followersCount": 0,
        "followingCount": 0
      }
    },
    "message": "Email verified. Welcome to Nexora!",
    "status": true
  }
  ```

### 2.3 Resend Verification or Reset Code
- **Method**: `POST`
- **Path**: `/api/v1/users/resend-email`
- **Auth Needed**: None (Public)
- **Middleware**: `ratelimit.authLimiter()`
- **Content-Type**: `application/json`
- **Request Body**:
  | Field | Type | Required | Description |
  |---|---|---|---|
  | `email` | String | Yes | Registered email |
  | `type` | String | Yes | Either `"email_verify"` or `"password_reset"` |
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": { ... },
    "message": "Verification code sent to your email",
    "status": true
  }
  ```

### 2.4 Login User
- **Method**: `POST`
- **Path**: `/api/v1/users/login`
- **Auth Needed**: None (Public)
- **Middleware**: `ratelimit.authLimiter()`
- **Content-Type**: `application/json`
- **Request Body**:
  | Field | Type | Required | Description |
  |---|---|---|---|
  | `username` | String | Yes | Registered username |
  | `password` | String | Yes | Account password |
- **Cookies Set**:
  - `AccessToken` (HttpOnly, Secure, SameSite=Strict)
  - `RefreshToken` (HttpOnly, Secure, SameSite=Strict)
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": {
      "_id": "6712b7a9e102f90a1b8c1234",
      "username": "alexrivera",
      "email": "alex@example.com",
      "title": "Newcomer",
      "point": 0,
      "profileImage": "https://res.cloudinary.com/.../image.jpg",
      "followers": [],
      "following": [],
      "savedPost": [],
      "bio": "",
      "badges": [],
      "googleId": "",
      "createdAt": "2026-10-18T10:00:00.000Z",
      "updatedAt": "2026-10-18T10:00:00.000Z",
      "followersCount": 0,
      "followingCount": 0
    },
    "message": "User logged in successfully",
    "status": true
  }
  ```

### 2.5 Refresh Access Token
- **Method**: `POST`
- **Path**: `/api/v1/users/refreshToken`
- **Auth Needed**: Cookie `RefreshToken`
- **Middleware**: `ratelimit.authLimiter()`
- **Cookies Set**: `AccessToken`
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": {
      "_id": "...",
      "username": "...",
      "email": "...",
      "title": "...",
      "point": 0,
      "profileImage": "https://res.cloudinary.com/.../image.jpg",
      "followers": [],
      "following": []
    },
    "message": "Access token successfully refreshed",
    "status": true
  }
  ```

### 2.6 Forgot Password (Request Reset Code)
- **Method**: `POST`
- **Path**: `/api/v1/users/forgot-password`
- **Auth Needed**: None (Public)
- **Middleware**: `ratelimit.authLimiter()`
- **Content-Type**: `application/json`
- **Request Body**:
  | Field | Type | Required | Description |
  |---|---|---|---|
  | `email` | String | Yes | Account email |
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": {},
    "message": "If this email is registered, you will receive a reset code",
    "status": true
  }
  ```

### 2.7 Verify Password Reset OTP
- **Method**: `POST`
- **Path**: `/api/v1/users/verify-reset-otp`
- **Auth Needed**: None (Public)
- **Middleware**: `ratelimit.authLimiter()`
- **Content-Type**: `application/json`
- **Request Body**:
  | Field | Type | Required | Description |
  |---|---|---|---|
  | `email` | String | Yes | Account email |
  | `otp` | String | Yes | 6-digit OTP code |
- **Cookies Set**:
  - `ResetToken` (HttpOnly, Secure, SameSite=Strict)
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": null,
    "message": "OTP verified successfully. Please enter your new password",
    "status": true
  }
  ```

### 2.8 Reset Password (New Password Entry)
- **Method**: `POST`
- **Path**: `/api/v1/users/reset-password`
- **Auth Needed**: Cookie `ResetToken`
- **Middleware**: `ratelimit.authLimiter()`
- **Content-Type**: `application/json`
- **Request Body**:
  | Field | Type | Required | Description |
  |---|---|---|---|
  | `newpassword` | String | Yes | New password |
  | `confirmNewPassword` | String | Yes | Must match `newpassword` |
- **Cookies Cleared**: `ResetToken`
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": null,
    "message": "Password changed successfully",
    "status": true
  }
  ```

### 2.9 Get Current Authenticated User
- **Method**: `GET`
- **Path**: `/api/v1/users/currentuser`
- **Auth Needed**: Required (`jwtVerify`)
- **Middleware**: `ratelimit.authLimiter()`, `jwtVerify`
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": {
      "_id": "6712b7a9e102f90a1b8c1234",
      "username": "alexrivera",
      "email": "alex@example.com",
      "title": "Helper",
      "point": 650,
      "profileImage": "https://res.cloudinary.com/.../image.jpg",
      "followers": ["..."],
      "following": ["..."],
      "savedPost": ["..."],
      "bio": "CS Major & UI Designer",
      "badges": ["Top Contributor"],
      "followersCount": 12,
      "followingCount": 8,
      "createdAt": "2026-10-18T10:00:00.000Z",
      "updatedAt": "2026-10-18T10:00:00.000Z"
    },
    "message": "User information retrieved successfully",
    "status": true
  }
  ```

### 2.10 Logout (Current Device)
- **Method**: `POST`
- **Path**: `/api/v1/users/logout`
- **Auth Needed**: Required (`jwtVerify`) + Cookie `RefreshToken`
- **Middleware**: `ratelimit.authLimiter()`, `jwtVerify`
- **Cookies Cleared**: `AccessToken`, `RefreshToken`
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": "Logged out successfully",
    "message": "success",
    "status": true
  }
  ```

### 2.11 Logout All Devices
- **Method**: `POST`
- **Path**: `/api/v1/users/logout-all`
- **Auth Needed**: Required (`jwtVerify`) + Cookie `RefreshToken`
- **Cookies Cleared**: `AccessToken`, `RefreshToken`
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": "Logged out from all devices successfully",
    "message": "success",
    "status": true
  }
  ```

### 2.12 Update Username
- **Method**: `PATCH`
- **Path**: `/api/v1/users/update-username`
- **Auth Needed**: Required (`jwtVerify`)
- **Request Body**:
  | Field | Type | Required | Description |
  |---|---|---|---|
  | `username` | String | Yes | Unique new username |
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": null,
    "message": "Username updated successfully",
    "status": true
  }
  ```

### 2.13 Change Password
- **Method**: `PATCH`
- **Path**: `/api/v1/users/change-password`
- **Auth Needed**: Required (`jwtVerify`)
- **Request Body**:
  | Field | Type | Required | Description |
  |---|---|---|---|
  | `oldpassword` | String | Yes | Current password |
  | `newpassword` | String | Yes | New password |
  | `confirmpassword` | String | Yes | Must match `newpassword` |
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": null,
    "message": "Password updated successfully",
    "status": true
  }
  ```

### 2.14 Follow User
- **Method**: `POST`
- **Path**: `/api/v1/users/follow/:user_id`
- **Auth Needed**: Required (`jwtVerify`)
- **Params**: `user_id` (ObjectId of target user)
- **Side Effects**: Emits `followed-user` to room `user:${user_id}`, `following-user` to room `user:${current_user_id}`, triggers in-app notification to `user_id`.
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": {},
    "message": "Followed successfully",
    "status": true
  }
  ```

### 2.15 Unfollow User
- **Method**: `DELETE`
- **Path**: `/api/v1/users/unfollow/:user_id`
- **Auth Needed**: Required (`jwtVerify`)
- **Params**: `user_id` (ObjectId of target user)
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": {},
    "message": "Unfollowed successfully",
    "status": true
  }
  ```

---

## 3. Post Endpoints (`/api/v1/posts`)

### 3.1 Get Posts Feed (Global Home Feed)
- **Method**: `GET`
- **Path**: `/api/v1/posts/`
- **Auth Needed**: None (Public)
- **Query Parameters**:
  | Param | Type | Default | Description |
  |---|---|---|---|
  | `page` | Number | 1 | Pagination page number |
  | `limit` | Number | 10 | Items per page |
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": {
      "post": {
        "totalPost": [
          {
            "_id": "6712c019...",
            "title": "Tips for Preparing for Algorithms Exam",
            "description": "Here are 5 key graphs to know...",
            "topic": "Academic",
            "postImage": ["https://res.cloudinary.com/.../img1.jpg"],
            "postVideo": [],
            "upvoteCount": 14,
            "downvoteCount": 1,
            "ownerInfo": {
              "_id": "...",
              "username": "sarah_k",
              "profileImage": "https://res.cloudinary.com/.../sarah.jpg",
              "title": "Mentor",
              "badge": "Top Solver"
            },
            "createdAt": "2026-10-18T14:20:00.000Z",
            "updatedAt": "2026-10-18T14:20:00.000Z"
          }
        ],
        "totalCount": [{ "count": 42 }]
      },
      "pagination": {
        "total": 42,
        "page": 1,
        "limit": 10,
        "totalPages": 5,
        "hasNextPage": true
      }
    },
    "message": "Posts retrieved successfully",
    "status": true
  }
  ```

### 3.2 Search Posts (Text Index)
- **Method**: `GET`
- **Path**: `/api/v1/posts/search`
- **Auth Needed**: None (Public)
- **Query Parameters**:
  | Param | Type | Required | Description |
  |---|---|---|---|
  | `search` | String | Yes | Search query matching title or description |
  | `page` | Number | No (1) | Page number |
  | `limit` | Number | No (10) | Items per page |
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": {
      "posts": [
        {
          "_id": "...",
          "title": "React performance optimization guide",
          "description": "...",
          "topic": "Tech",
          "postImage": [],
          "postVideo": [],
          "owner": {
            "_id": "...",
            "username": "alex",
            "profileImage": "...",
            "title": "Helper"
          },
          "upvotes": [],
          "downvotes": [],
          "createdAt": "...",
          "updatedAt": "..."
        }
      ],
      "pagination": {
        "total": 12,
        "page": 1,
        "limit": 10,
        "totalPages": 2,
        "hasNextPage": true
      }
    },
    "message": "Posts fetched successfully",
    "status": true
  }
  ```

### 3.3 Get Posts by Topic
- **Method**: `GET`
- **Path**: `/api/v1/posts/topic/:topic`
- **Auth Needed**: None (Public)
- **Params**: `topic` (`"Academic"` | `"Career"` | `"Tech"` | `"Life"`)
- **Query Parameters**: `page` (default 1), `limit` (default 10)
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": {
      "posts": [
        {
          "_id": "...",
          "title": "...",
          "topic": "Tech",
          "postImage": [...],
          "postVideo": [...],
          "upvotesCount": 5,
          "downvotesCount": 0,
          "createdAt": "...",
          "updatedAt": "..."
        }
      ],
      "paginations": {
        "total": 8,
        "page": 1,
        "limit": 10,
        "totalPages": 1,
        "hasNextPage": false
      }
    },
    "message": "Posts retrieved successfully",
    "status": true
  }
  ```

### 3.4 Get User Posts
- **Method**: `GET`
- **Path**: `/api/v1/posts/user/:username`
- **Auth Needed**: None (Public)
- **Params**: `username` (string)
- **Query Parameters**: `page` (default 1), `limit` (default 10)
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": {
      "posts": [...],
      "owner": {
        "_id": "...",
        "username": "alexrivera",
        "profileImage": "...",
        "title": "Helper",
        "badge": "Top Helper"
      },
      "pagination": {
        "total": 15,
        "page": 1,
        "limit": 10,
        "totalPages": 2,
        "hasNextPage": true
      }
    },
    "message": "Posts retrieved successfully",
    "status": true
  }
  ```

### 3.5 Get Saved Posts of Current User
- **Method**: `GET`
- **Path**: `/api/v1/posts/saved`
- **Auth Needed**: Required (`jwtVerify`)
- **Query Parameters**: `page` (default 1), `limit` (default 10)
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": {
      "savedPost": [
        {
          "posts": [
            {
              "_id": "...",
              "title": "...",
              "description": "...",
              "postImage": [...],
              "upvoteCount": 10,
              "downvoteCount": 0,
              "ownerInfo": {
                "_id": "...",
                "username": "...",
                "profileImage": "...",
                "title": "...",
                "badge": "..."
              }
            }
          ],
          "totalCount": [{ "count": 3 }]
        }
      ],
      "page": 1,
      "limit": 10
    },
    "message": "Saved posts retrieved successfully",
    "status": true
  }
  ```

### 3.6 Get Posts of a Particular Page
- **Method**: `GET`
- **Path**: `/api/v1/posts/page/:pageid`
- **Auth Needed**: Required (`jwtVerify`). If page is private, user must be member, moderator, or owner.
- **Params**: `pageid` (ObjectId)
- **Query Parameters**: `page` (default 1), `limit` (default 10)
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": {
      "posts": [
        {
          "_id": "...",
          "title": "...",
          "description": "...",
          "topic": "Academic",
          "postImage": [...],
          "postVideo": [...],
          "pages": ["pageId"],
          "owner": {
            "_id": "...",
            "username": "...",
            "profileImage": "...",
            "title": "...",
            "badge": "..."
          },
          "createdAt": "...",
          "updatedAt": "..."
        }
      ],
      "pagination": {
        "total": 8,
        "page": 1,
        "limit": 10,
        "totalPages": 1,
        "hasNextPage": false
      }
    },
    "message": "Page posts retrieved successfully",
    "status": true
  }
  ```

### 3.7 Create Post
- **Method**: `POST`
- **Path**: `/api/v1/posts/`
- **Auth Needed**: Required (`jwtVerify`)
- **Content-Type**: `multipart/form-data`
- **Request Body**:
  | Field | Type | Required | Description |
  |---|---|---|---|
  | `title` | String | Yes | Post title (max 150 chars) |
  | `topic` | String | Yes | `"Academic"` \| `"Career"` \| `"Tech"` \| `"Life"` |
  | `description` | String | No | Post body / content (max 500 chars) |
  | `pages` | Array/String | No | Page IDs to publish to |
  | `PostImages` | Files | No | Up to 3 images (jpg, png, webp) |
  | `PostVideos` | Files | No | Up to 1 video (mp4, webm, quicktime) |
- **Real-Time Event**: Emits `post-created` to rooms `page:${page_id}` for all attached pages.
- **Response Shape (201 Created)**:
  ```json
  {
    "statuscode": 201,
    "data": {
      "_id": "...",
      "owner": "userId",
      "title": "...",
      "topic": "Tech",
      "description": "...",
      "pages": ["pageId"],
      "postImage": ["https://res.cloudinary.com/..."],
      "postVideo": [],
      "upvotes": [],
      "downvotes": [],
      "createdAt": "...",
      "updatedAt": "..."
    },
    "message": "Post created successfully",
    "status": true
  }
  ```

### 3.8 Get Post by ID
- **Method**: `GET`
- **Path**: `/api/v1/posts/:post_id`
- **Auth Needed**: Required (`jwtVerify`)
- **Params**: `post_id` (ObjectId)
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": [
      {
        "_id": "6712...",
        "title": "...",
        "description": "...",
        "topic": "Academic",
        "postImage": [...],
        "postVideo": [...],
        "ownerInfo": {
          "_id": "...",
          "username": "...",
          "profileImage": "...",
          "title": "...",
          "badge": "..."
        },
        "upvoteCount": 12,
        "downvoteCount": 1,
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "message": "Post data retrieved successfully",
    "status": true
  }
  ```

### 3.9 Vote on Post (Upvote / Downvote)
- **Method**: `POST`
- **Path**: `/api/v1/posts/:post_id/vote`
- **Auth Needed**: Required (`jwtVerify`)
- **Params**: `post_id` (ObjectId)
- **Content-Type**: `application/json`
- **Request Body**:
  | Field | Type | Required | Description |
  |---|---|---|---|
  | `type` | String | Yes | Either `"upvote"` or `"downvote"` |
- **Real-Time Event**: Emits `reacted-post` to room `post:${post_id}` and each attached `page:${page_id}`.
- **Notification**: Creates notification of type `post_upvote` or `post_downvote`.
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": null,
    "message": "Successfully reacted to post",
    "status": true
  }
  ```

### 3.10 Save Post
- **Method**: `POST`
- **Path**: `/api/v1/posts/:post_id/save`
- **Auth Needed**: Required (`jwtVerify`)
- **Params**: `post_id` (ObjectId)
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": { /* Updated User model */ },
    "message": "Post saved successfully",
    "status": true
  }
  ```

### 3.11 Unsave Post
- **Method**: `DELETE`
- **Path**: `/api/v1/posts/:post_id/save`
- **Auth Needed**: Required (`jwtVerify`)
- **Params**: `post_id` (ObjectId)
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": { /* Updated User model */ },
    "message": "Post unsaved successfully",
    "status": true
  }
  ```

### 3.12 Update Post
- **Method**: `PATCH`
- **Path**: `/api/v1/posts/:post_id`
- **Auth Needed**: Required (`jwtVerify`, `isPostOwner`)
- **Params**: `post_id` (ObjectId)
- **Content-Type**: `multipart/form-data`
- **Request Body**:
  | Field | Type | Required | Description |
  |---|---|---|---|
  | `title` | String | No | New title |
  | `topic` | String | No | New topic |
  | `description` | String | No | New description |
  | `removeImages` | Array/String | No | Cloudinary public IDs of images to delete |
  | `removeVideos` | Array/String | No | Cloudinary public IDs of videos to delete |
  | `addImages` | Files | No | New image files to add (up to 3 total) |
  | `addVideos` | Files | No | New video files to add (up to 2 total) |
- **Real-Time Event**: Emits `updated-post` to room `post:${post_id}` and all `page:${page_id}`.
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": { /* updated post with optimized image URLs */ },
    "message": "Post updated successfully",
    "status": true
  }
  ```

### 3.13 Delete Post
- **Method**: `DELETE`
- **Path**: `/api/v1/posts/:post_id`
- **Auth Needed**: Required (`jwtVerify`, `isPostOwner`)
- **Params**: `post_id` (ObjectId)
- **Real-Time Event**: Emits `post-deleted` with `deletedPost` to room `post:${post_id}` and `page:${page_id}`.
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": null,
    "message": "Post deleted successfully",
    "status": true
  }
  ```

### 3.14 Add Existing Post to Page(s)
- **Method**: `POST`
- **Path**: `/api/v1/posts/add/pages/:post_id`
- **Auth Needed**: Required (`jwtVerify`, `isPageOrPostOwner`)
- **Params**: `post_id` (ObjectId)
- **Request Body**: `{ "pages": ["pageId1", "pageId2"] }`
- **Real-Time Event**: Emits `addPost-to-page` to each `page:${page_id}`.
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": "Post successfully added to pages",
    "message": "success",
    "status": true
  }
  ```

### 3.15 Remove Existing Post from Page(s)
- **Method**: `DELETE`
- **Path**: `/api/v1/posts/remove/pages/:post_id`
- **Auth Needed**: Required (`jwtVerify`, `isPageOrPostOwner`)
- **Params**: `post_id` (ObjectId)
- **Request Body**: `{ "pages": ["pageId1"] }`
- **Real-Time Event**: Emits `removePost-from-page` to each `page:${page_id}`.
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": null,
    "message": "Post successfully removed from pages",
    "status": true
  }
  ```

---

## 4. Community Page Endpoints (`/api/v1/pages`)

### 4.1 Get Pages List (Explore Pages)
- **Method**: `GET`
- **Path**: `/api/v1/pages/`
- **Auth Needed**: Optional (`verifyOptional`)
- **Query Parameters**:
  | Param | Type | Default | Description |
  |---|---|---|---|
  | `page` | Number | 1 | Page number |
  | `limit` | Number | 10 | Items per page |
  | `search` | String | - | Text query for page name/description |
  | `topic` / `title` | String | - | Filter by category tag |
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": {
      "pages": [
        {
          "_id": "6712...",
          "pageName": "Algorithm Masters",
          "pageDescription": "A community dedicated to data structures, graph algorithms and contest prep.",
          "title": ["Computer Science", "Algorithms"],
          "type": "open",
          "pageProfileImage": "https://res.cloudinary.com/.../algo.jpg",
          "membersCount": 128,
          "owner": {
            "_id": "...",
            "username": "prof_turing",
            "profileImage": "https://res.cloudinary.com/.../turing.jpg"
          }
        }
      ],
      "pagination": {
        "total": 14,
        "page": 1,
        "limit": 10,
        "totalPages": 2,
        "hasNextPage": true
      }
    },
    "message": "Pages retrieved successfully",
    "status": true
  }
  ```

### 4.2 Create Community Page
- **Method**: `POST`
- **Path**: `/api/v1/pages/`
- **Auth Needed**: Required (`jwtVerify`)
- **Content-Type**: `multipart/form-data`
- **Request Body**:
  | Field | Type | Required | Description |
  |---|---|---|---|
  | `pageName` | String | Yes | Unique name |
  | `pageDescription` | String | Yes | 40 to 300 words |
  | `title` | String/Array | Yes | Tags / categories (e.g., `["CS", "Prep"]`) |
  | `type` | String | No | `"open"` (default) or `"private"` |
  | `pageProfileImage` | File | Yes | Community avatar image (jpeg, png, webp) |
- **Response Shape (201 Created)**:
  ```json
  {
    "statuscode": 201,
    "data": {
      "_id": "...",
      "pageName": "...",
      "pageDescription": "...",
      "title": ["..."],
      "type": "open",
      "pageProfileImage": "https://res.cloudinary.com/...",
      "owner": "userId",
      "moderators": ["userId"],
      "members": ["userId"],
      "createdAt": "...",
      "updatedAt": "..."
    },
    "message": "page is created successfully",
    "status": true
  }
  ```

### 4.3 Get Particular Page Details
- **Method**: `GET`
- **Path**: `/api/v1/pages/:page_id`
- **Auth Needed**: Optional (`verifyOptional`, `loadingPage`)
- **Params**: `page_id` (ObjectId)
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "message": "Page retrieved successfully",
    "data": {
      "_id": "6712...",
      "pageName": "Design Systems Club",
      "pageDescription": "Discussing UI/UX, tokens, and frontend craftsmanship in modern tech.",
      "title": ["Design", "Figma"],
      "pageProfileImage": "https://res.cloudinary.com/.../design.jpg",
      "type": "open",
      "membersCount": 45,
      "moderatorsCount": 2,
      "createdAt": "2026-10-18T10:00:00.000Z",
      "updatedAt": "2026-10-18T10:00:00.000Z",
      "owner": {
        "_id": "...",
        "username": "alex",
        "email": "alex@example.com",
        "profileImage": "..."
      },
      "moderators": [
        { "_id": "...", "username": "...", "profileImage": "..." }
      ],
      "members": [
        { "_id": "...", "username": "...", "profileImage": "..." }
      ],
      "userRole": "owner" | "moderator" | "member" | "viewer" | "guest",
      "canEditPage": true,
      "canDeletePage": true,
      "canApproveModerators": true,
      "canManageMembers": true
    },
    "status": true
  }
  ```

### 4.4 Update Page Info
- **Method**: `PATCH`
- **Path**: `/api/v1/pages/:page_id`
- **Auth Needed**: Required (`jwtVerify`, `loadingPage`, `isPageOwner`)
- **Params**: `page_id` (ObjectId)
- **Content-Type**: `multipart/form-data`
- **Request Body**:
  | Field | Type | Required | Description |
  |---|---|---|---|
  | `pageName` | String | No | Unique page name |
  | `pageDescription` | String | No | 40-300 words |
  | `title` | String/Array | No | Appends to page tags |
  | `type` | String | No | `"open"` or `"private"` |
  | `newPageImage` | File | No | New banner/avatar image |
- **Real-Time Event**: Emits `updated-page` to room `page:${page_id}`.
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": { /* updated page data */ },
    "message": "Page updated successfully",
    "status": true
  }
  ```

### 4.5 Delete Page
- **Method**: `DELETE`
- **Path**: `/api/v1/pages/:page_id`
- **Auth Needed**: Required (`jwtVerify`, `loadingPage`, `isPageOwner`)
- **Params**: `page_id` (ObjectId)
- **Real-Time Event**: Emits `deleted-page` with `page_id` to room `page:${page_id}`.
- **Notifications**: Dispatches `page_deleted` to all former members.
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": null,
    "message": "Page deleted successfully",
    "status": true
  }
  ```

### 4.6 Join Page or Request to Join
- **Method**: `POST`
- **Path**: `/api/v1/pages/:page_id/join`
- **Auth Needed**: Required (`jwtVerify`)
- **Params**: `page_id` (ObjectId)
- **Content-Type**: `application/json`
- **Request Body**:
  | Field | Type | Required | Description |
  |---|---|---|---|
  | `message` | String | No | Application note (max 200 chars for private pages) |
- **Open Page Behavior**:
  - Adds user directly to members.
  - Emits `joined-page` with `user_id` to `page:${page_id}`.
  - Notifies owner (`page_join`).
  - Response: 200 OK (`"Successfully joined the page"`).
- **Private Page Behavior**:
  - Creates pending `JoinRequest`.
  - Notifies owner (`join_request`).
  - Response: 201 Created (`"Join request sent successfully"`).

### 4.7 Leave Page
- **Method**: `DELETE`
- **Path**: `/api/v1/pages/:page_id/leave`
- **Auth Needed**: Required (`jwtVerify`, `loadingPage`, `isPageMember`)
- **Params**: `page_id` (ObjectId)
- **Request Body**:
  | Field | Type | Required | Description |
  |---|---|---|---|
  | `newOwner` | ObjectId | Only if owner | Required if the user leaving is the page owner |
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": "Successfully left the page",
    "message": "success",
    "status": true
  }
  ```

### 4.8 View Page Members List
- **Method**: `GET`
- **Path**: `/api/v1/pages/:page_id/members`
- **Auth Needed**: Required (`jwtVerify`, `loadingPage`, `isPageMember`)
- **Params**: `page_id` (ObjectId)
- **Query Parameters**: `page` (default 1), `limit` (default 10)
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": {
      "membeList": {
        "_id": "...",
        "pageName": "...",
        "owner": "...",
        "pageProfileImage": "...",
        "members": [
          {
            "_id": "...",
            "username": "...",
            "profileImage": "...",
            "title": "Helper",
            "badge": "Top Mentor"
          }
        ]
      },
      "pagination": {
        "total": 45,
        "page": 1,
        "limit": 10,
        "totalPages": 5,
        "hasNextPage": true
      }
    },
    "message": "Member list retrieved successfully",
    "status": true
  }
  ```

### 4.9 Remove Member(s) from Page
- **Method**: `DELETE`
- **Path**: `/api/v1/pages/:page_id/members`
- **Auth Needed**: Required (`jwtVerify`, `loadingPage`, `isPageModeratorOrOwner`, `checkMembership`)
- **Params**: `page_id` (ObjectId)
- **Content-Type**: `application/json`
- **Request Body**: `{ "users": ["userId1", "userId2"] }`
- **Real-Time Event**: Emits `removeuser-page` with `page_id` to room `page:${page_id}`.
- **Notifications**: Sends `page_removed` notification to all removed users.
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": {},
    "message": "Users removed from the page successfully",
    "status": true
  }
  ```

### 4.10 Appoint Moderator(s)
- **Method**: `POST`
- **Path**: `/api/v1/pages/:page_id/moderators`
- **Auth Needed**: Required (`jwtVerify`, `loadingPage`, `isPageOwner`, `checkMembership`)
- **Params**: `page_id` (ObjectId)
- **Request Body**: `{ "users": ["userId1"] }` (Must already be members)
- **Notifications**: Sends `mod_appointed` notification to users.
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": "Users successfully added as moderators",
    "message": "success",
    "status": true
  }
  ```

### 4.11 Remove Moderator(s)
- **Method**: `DELETE`
- **Path**: `/api/v1/pages/:page_id/moderators`
- **Auth Needed**: Required (`jwtVerify`, `loadingPage`, `isPageOwner`, `checkMembership`)
- **Params**: `page_id` (ObjectId)
- **Request Body**: `{ "users": ["userId1"] }` (Cannot remove owner)
- **Real-Time Event**: Emits `madeModerator-page` to room `page:${page_id}`.
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": "Users removed from moderators successfully",
    "message": "success",
    "status": true
  }
  ```

### 4.12 View Pending Join Requests
- **Method**: `GET`
- **Path**: `/api/v1/pages/:page_id/requests`
- **Auth Needed**: Required (`jwtVerify`, `loadingPage`, `isPageModeratorOrOwner`)
- **Params**: `page_id` (ObjectId)
- **Query Parameters**: `page` (default 1), `limit` (default 10)
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": {
      "pendingRequest": [
        {
          "_id": "...",
          "page": "...",
          "status": "pending",
          "message": "Looking to contribute to discussions!",
          "requestedBy": {
            "_id": "...",
            "username": "john_doe",
            "title": "Newcomer",
            "badge": "Enthusiast",
            "profileImage": "..."
          },
          "createdAt": "..."
        }
      ],
      "pagination": {
        "total": 3,
        "page": 1,
        "limit": 10,
        "totalPages": 1,
        "hasNextPage": false
      }
    },
    "message": "Pending requests fetched successfully",
    "status": true
  }
  ```

### 4.13 Approve / Reject Join Request
- **Method**: `POST`
- **Path**: `/api/v1/pages/:page_id/request`
- **Auth Needed**: Required (`jwtVerify`, `loadingPage`, `isPageModeratorOrOwner`)
- **Params**: `page_id` (ObjectId)
- **Content-Type**: `application/json`
- **Request Body**:
  | Field | Type | Required | Description |
  |---|---|---|---|
  | `requestedBy` | ObjectId | Yes | User ID of applicant |
  | `status` | String | Yes | `"approved"` or `"reject"` |
- **Real-Time Event**: Emits `responseJoin-page` with `{ pageid, requestedBy, status }` to room `page:${page_id}`.
- **Notifications**: Sends `request_approved` or `request_rejected` to `requestedBy`.
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": "Request processed successfully",
    "message": "success",
    "status": true
  }
  ```

---

## 5. Comment Endpoints (`/api/v1/comments`)

### 5.1 Get Comments of a Post (Nested & Sorted)
- **Method**: `GET`
- **Path**: `/api/v1/comments/post/:post_id`
- **Auth Needed**: None (Public)
- **Params**: `post_id` (ObjectId)
- **Query Parameters**:
  | Param | Type | Default | Description |
  |---|---|---|---|
  | `parentComment` | ObjectId/null | null | null for top-level comments; Comment ID for replies |
  | `sort` | String | "top" | `"top"` (highest upvotes) or `"latest"` (newest) |
  | `page` | Number | 1 | Pagination page number |
  | `limit` | Number | 10 | Comments per page |
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": {
      "comments": [
        {
          "_id": "6712d...",
          "post": "6712c...",
          "parentComment": null,
          "body": "This explanation of BFS traversal was super helpful!",
          "upvotes": ["userId1", "userId2"],
          "status": "helpful",
          "upvotesCount": 2,
          "replyCount": 1,
          "hasChildren": true,
          "statusPriority": 1,
          "author": {
            "_id": "...",
            "username": "code_ninja",
            "avatar": "https://res.cloudinary.com/...",
            "title": "Helper"
          },
          "createdAt": "2026-10-18T16:00:00.000Z",
          "updatedAt": "2026-10-18T16:00:00.000Z"
        }
      ],
      "pagination": {
        "total": 5,
        "page": 1,
        "limit": 10,
        "hasNextPage": false
      }
    },
    "message": "Comments fetched",
    "status": true
  }
  ```

### 5.2 Create Comment or Reply
- **Method**: `POST`
- **Path**: `/api/v1/comments/post/:post_id`
- **Auth Needed**: Required (`jwtVerify`)
- **Params**: `post_id` (ObjectId)
- **Content-Type**: `application/json`
- **Request Body**:
  | Field | Type | Required | Description |
  |---|---|---|---|
  | `body` | String | Yes | Comment content (max 1000 chars) |
  | `parentComment` | ObjectId | No | Parent comment ID if replying; omit or null if top-level |
- **Real-Time Event**: Emits `new-comment` with populated comment object to room `post:${post_id}`.
- **Notifications**:
  - Post Owner: type `"comment"`
  - Parent Comment Author (if reply): type `"reply"`
- **Response Shape (201 Created)**:
  ```json
  {
    "statuscode": 201,
    "data": {
      "_id": "...",
      "author": "userId",
      "parentComment": null,
      "body": "...",
      "post": "postId",
      "upvotes": [],
      "status": "none",
      "createdAt": "...",
      "updatedAt": "..."
    },
    "message": "comment created succcessfully",
    "status": true
  }
  ```

### 5.3 Edit Comment
- **Method**: `PATCH`
- **Path**: `/api/v1/comments/:comment_id`
- **Auth Needed**: Required (`jwtVerify`, `isCommentOwner`)
- **Params**: `comment_id` (ObjectId)
- **Content-Type**: `application/json`
- **Request Body**: `{ "body": "Updated comment content" }`
- **Real-Time Event**: Emits `comment-updated` with `{ body, comment_id }` to room `post:${post_id}`.
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": {},
    "message": "comment updated soccessfully",
    "status": true
  }
  ```

### 5.4 Delete Comment (and Cascading Replies)
- **Method**: `DELETE`
- **Path**: `/api/v1/comments/:comment_id`
- **Auth Needed**: Required (`jwtVerify`, `isCommentOwner`)
- **Params**: `comment_id` (ObjectId)
- **Real-Time Event**: Emits `comment-deleted` with `deletedCommentInfo` array to room `post:${post_id}`.
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": {},
    "message": "comment deleted",
    "status": true
  }
  ```

### 5.5 Upvote Comment (Toggle)
- **Method**: `POST`
- **Path**: `/api/v1/comments/:comment_id/upvote`
- **Auth Needed**: Required (`jwtVerify`)
- **Params**: `comment_id` (ObjectId)
- **Behavior**: Toggles upvote on/off. If upvoting, notifies comment author (`comment_upvote`) and awards +10 XP.
- **Real-Time Event**: Emits `comment-vote-update` with `{ commentId, upvotesCount, userUpvoted }` to room `post:${post_id}`.
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": {
      "upvotesCount": 3,
      "userUpvoted": true
    },
    "message": "Comment vote recorded",
    "status": true
  }
  ```

### 5.6 Set Comment Status (Pin or Mark Helpful)
- **Method**: `POST`
- **Path**: `/api/v1/comments/:post_id/:comment_id/status`
- **Auth Needed**: Required (`jwtVerify`, `isPostOwner`)
- **Params**: `post_id` (ObjectId), `comment_id` (ObjectId)
- **Content-Type**: `application/json`
- **Request Body**:
  | Field | Type | Required | Description |
  |---|---|---|---|
  | `status` | String | Yes | `"pinned"` \| `"helpful"` \| `"none"` |
- **Real-Time Event**: Emits `comment-status` with `{ id: comment_id, status }` to room `post:${post_id}`.
- **Notifications**: Sends notification of type `"pinned"` or `"helpful"` to comment author.
- **Response Shape (201 Created)**:
  ```json
  {
    "statuscode": 201,
    "data": {},
    "message": "status changed successfully",
    "status": true
  }
  ```

---

## 6. Notification Endpoints (`/api/v1/notifications`)

### 6.1 Get Unread Notifications
- **Method**: `GET`
- **Path**: `/api/v1/notifications/`
- **Auth Needed**: Required (`jwtVerify`)
- **Query Parameters**:
  | Param | Type | Default | Description |
  |---|---|---|---|
  | `pages` | Number | 1 | Page number (note parameter name is `pages`) |
  | `limit` | Number | 10 | Items per page (max 100) |
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": {
      "notifications": [
        {
          "notifications": [
            {
              "_id": "6712e...",
              "recipient": "userId",
              "type": "comment" | "reply" | "post_upvote" | "post_downvote" | "comment_upvote" | "helpful" | "follow" | "page_join" | "page_removed" | "page_deleted" | "mod_appointed" | "mod_removed" | "request_approved" | "request_rejected" | "join_request" | "pinned",
              "isRead": false,
              "message": "alexrivera upvoted your post",
              "post": "postId",
              "comment": "commentId",
              "page": "pageId",
              "sender": {
                "_id": "...",
                "username": "alexrivera",
                "profileImage": "..."
              },
              "createdAt": "2026-10-18T18:00:00.000Z",
              "updatedAt": "2026-10-18T18:00:00.000Z"
            }
          ],
          "totalCount": [{ "count": 4 }]
        }
      ],
      "pagination": {
        "total": 4,
        "pages": 1,
        "limit": 10,
        "totalPages": 1,
        "hasNextPage": false
      }
    },
    "message": "notifications has been fetched successfully",
    "status": true
  }
  ```

### 6.2 Mark Single Notification as Read
- **Method**: `GET`
- **Path**: `/api/v1/notifications/:notification_id/read`
- **Auth Needed**: Required (`jwtVerify`)
- **Params**: `notification_id` (ObjectId)
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": {},
    "message": "marked read successfully",
    "status": true
  }
  ```

### 6.3 Mark All Notifications as Read
- **Method**: `GET`
- **Path**: `/api/v1/notifications/all/read-all`
- **Auth Needed**: Required (`jwtVerify`)
- **Response Shape (200 OK)**:
  ```json
  {
    "statuscode": 200,
    "data": {},
    "message": "marked read successfully",
    "status": true
  }
  ```

---

## 7. Socket.IO Real-Time Architecture (`src/socket.js`)

### 7.1 Connection Handshake & Authentication
- **Endpoint**: Socket.IO connection to server (`ws://localhost:8000` or via `/socket.io/` proxy).
- **Authentication**:
  Client passes JWT token using any of the three supported mechanisms:
  ```js
  import { io } from "socket.io-client";
  const socket = io("http://localhost:8000", {
    auth: { token: accessToken },
    withCredentials: true
  });
  ```
- **Connection Lifecycle**:
  - The server tracks active socket IDs per user in an internal map `onlineUser`.
  - Disconnect cleanly frees socket IDs and user status.

### 7.2 Client-to-Server Events (Emitted by Frontend)

| Event Name | Payload | Room Joined / Description |
|---|---|---|
| `join-page` | `page_id` (string) | Subscribes socket to room `page:${page_id}` for page post updates and events |
| `leave-page` | `page_id` (string) | Leaves room `page:${page_id}` |
| `join-post` | `post_id` (string) | Subscribes socket to room `post:${post_id}` for live comments, reactions, and typing indicators |
| `leave-post` | `post_id` (string) | Leaves room `post:${post_id}` |
| `join-user` | `user_id` (string) | Subscribes socket to room `user:${user_id}` for follow/follower counts and direct updates |
| `leave-user` | `user_id` (string) | Leaves room `user:${user_id}` |
| `typing` | `post_id` (string) | Broadcasts typing indicator to everyone in `post:${post_id}` |
| `stop-typing` | `post_id` (string) | Broadcasts stop typing event to everyone in `post:${post_id}` |

### 7.3 Server-to-Client Events (Listened by Frontend)

| Event Name | Room / Destination | Payload Shape | Description |
|---|---|---|---|
| `notification` | Direct to User | Notification Object | New real-time notification (push directly into bell badge / toast) |
| `post-created` | `page:${page_id}` | Post Object | New post created in the community page |
| `post-deleted` | `post:${post_id}`, `page:${page_id}` | Post Object | Post was deleted |
| `updated-post` | `post:${post_id}`, `page:${page_id}` | Post Object | Post title, description, or media was updated |
| `addPost-to-page` | `page:${page_id}` | Post Object | Existing post was added to this page |
| `removePost-from-page` | `page:${page_id}` | Post Object | Existing post was detached from this page |
| `reacted-post` | `post:${post_id}`, `page:${page_id}` | Post Object with updated upvotes/downvotes | Vote count change |
| `new-comment` | `post:${post_id}` | Comment Object (populated with author) | New comment added to post in real-time |
| `comment-updated` | `post:${post_id}` | `{ body: string, comment_id: string }` | Existing comment text updated |
| `comment-deleted` | `post:${post_id}` | `[ { id, body } ]` | Comment and all nested replies removed |
| `comment-vote-update` | `post:${post_id}` | `{ commentId, upvotesCount, userUpvoted }` | Comment upvote tally changed |
| `comment-status` | `post:${post_id}` | `{ id: string, status: "pinned" \| "helpful" }` | Comment status changed |
| `typing` | `post:${post_id}` | `{ username, profileImage, badge }` | Someone is typing in the comment box |
| `stop-typing` | `post:${post_id}` | `{ username, profileImage, badge }` | Someone stopped typing |
| `deleted-page` | `page:${page_id}` | Page ID | Community page was deleted |
| `madeModerator-page` | `page:${page_id}` | Page Object | Moderator roster updated |
| `removeuser-page` | `page:${page_id}` | Page ID | Member removed from community |
| `joined-page` | `page:${page_id}` | User ID | New member joined open page |
| `responseJoin-page` | `page:${page_id}` | `{ pageid, requestedBy, status }` | Join request approved or rejected |
| `updated-page` | `page:${page_id}` | Page Object | Community name, description, or banner updated |
| `followed-user` | `user:${user_id}` | User Object | Follower count / followers list updated |
| `following-user` | `user:${req.user._id}` | User Object | Following list updated |

---

## 8. Summary of Data Adapters & Frontend Considerations

1. **Profile Images & Cloudinary URLs**:
   The backend stores Cloudinary `public_id` internally and runs `getOptimizedImage()` or `getOptimizedVideo()` before returning to client. If an image is an empty string, fallback to a handsome UI placeholder avatar.
2. **User XP & Ranks**:
   - 0 - 100 XP: `"Newcomer"`
   - 101 - 500 XP: `"Contributor"`
   - 501 - 1500 XP: `"Helper"`
   - 1501 - 4999 XP: `"Mentor"`
   - 5000+ XP: `"Legend"`
3. **Pagination Parameter Inconsistencies**:
   - Notifications endpoint expects `pages` (plural query param: `?pages=1&limit=10`), while posts and pages expect `page` (`?page=1&limit=10`).
4. **Form EncTypes**:
   - `signup`, `createPost`, `updatePost`, `createPage`, and `updatePageinfo` MUST use `FormData` (`multipart/form-data`).
   - All other POST / PATCH endpoints use `application/json`.
