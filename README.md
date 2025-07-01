# 📝 Real-Time Collaborative Text Editor – Architecture & Design

This document describes the **architecture**, **data model**, and **flow** for building a real-time collaborative text editor using **React (Quill)**, **NestJS**, **WebSockets**, and **MongoDB** with **Yjs** for conflict-free CRDT-based syncing.

---

## 🏗️ Project Overview

* **Frontend**: React with [Quill.js](https://quilljs.com/) as the rich text editor.
* **Backend**: NestJS Gateway using `@nestjs/websockets` for bi-directional sync.
* **Real-Time Engine**: [Yjs](https://github.com/yjs/yjs) – a CRDT (Conflict-Free Replicated Data Type) library for collaborative editing.
* **Database**: MongoDB – storing documents, updates, and snapshots.
* **Transport Layer**: WebSocket (via Socket.IO or native WebSocket).

---

## 📂 MongoDB Collections

### 1. `documents`

* Stores the **latest full version** of each document (CRDT state).
* Fields:

  | Field       | Type                | Description                            |
  | ----------- | ------------------- | -------------------------------------- |
  | `_id`       | ObjectId            | Document ID                            |
  | `title`     | String              | Document name/title                    |
  | `ownerId`   | ObjectId            | User who created it                    |
  | `yjsState`  | Buffer (compressed) | Serialized Yjs document (entire state) |
  | `version`   | Number              | Latest update version applied          |
  | `updatedAt` | Date                | Last updated timestamp                 |

### 2. `updates`

* Stores each **incremental Yjs update** (small patch of changes).
* Used for:

  * Real-time broadcasting
  * Replaying after snapshots
* Fields:

  | Field    | Type     | Description                       |
  | -------- | -------- | --------------------------------- |
  | `_id`    | ObjectId | Update ID                         |
  | `docId`  | ObjectId | Document ID                       |
  | `seq`    | Number   | Sequence number (version)         |
  | `update` | Buffer   | Binary patch from Yjs             |
  | `origin` | String   | Client/session ID that created it |
  | `ts`     | Date     | Timestamp of update               |

### 3. `snapshots`

* Periodic full **checkpoint of the document**.
* Used to reduce the replay time of `updates`.
* Fields:

  | Field       | Type     | Description                       |
  | ----------- | -------- | --------------------------------- |
  | `_id`       | ObjectId | Snapshot ID                       |
  | `docId`     | ObjectId | Document ID                       |
  | `version`   | Number   | Matches `seq` at time of snapshot |
  | `snapshot`  | Buffer   | Compressed Yjs state              |
  | `createdAt` | Date     | When snapshot was taken           |

---

## ⚙️ Real-Time Flow

### 🔁 On User Join (`/editor/:id`)

1. Client connects via WebSocket (`join_document`).
2. Server fetches from:

   * `documents` if available
   * Else: latest `snapshots` + `updates` after snapshot
3. Server sends full state to the client.
4. Client hydrates Yjs + Quill.

### ⌨️ On Typing

1. Quill emits delta → Yjs creates a CRDT update.
2. Client sends `content_update` to server.
3. Server:

   * Applies update to in-memory Yjs state.
   * Saves it to `updates`.
   * Broadcasts to other connected clients.

### 💾 On Interval (e.g., every 50 updates or 10s)

1. Server serializes in-memory Yjs doc.
2. Overwrites `documents.yjsState` (upsert).
3. Inserts a new row in `snapshots`.
4. Deletes old `updates` where `seq ≤ snapshot.version`.

---

## 🗓️ Timeline

```text
Time  Δ                               Action              Collection Affected
----  ------------------------------  ------------------  -------------------
 t0   User opens /editor/abc          Load latest state   documents / snapshots / updates
 t1   u1 .. u50 (typing)              Append patches      updates
 t1'  Snapshot at version 50          Save checkpoint     snapshot + documents
       → prune u1‑u50                 Delete              updates
 t2   u51 .. u100                     Append patches      updates
 t2'  Snapshot at version 100         Save checkpoint     snapshot + documents
       → prune u51‑u100               Delete              updates
```

---

## 🧠 Summary

| Component   | Purpose                                                      |
| ----------- | ------------------------------------------------------------ |
| `documents` | Single source of current truth – fastest to load             |
| `updates`   | Real-time patch stream, short-lived – cleared after snapshot |
| `snapshots` | Backup/versioning, aids fast recovery & pruning              |

### 🔁 Keep system lean:

* Save snapshot every \~50 updates or 10s.
* Clear old `updates` once snapshot is taken.
* Optionally clean older `snapshots` with a TTL or cron job.

---

## ✅ Benefits

* Real-time typing sync (multiple users)
* Conflict-free collaborative editing (via Yjs)
* Scalable MongoDB-based history system
* Fast load, auto-save, undo-friendly


