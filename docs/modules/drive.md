# Drive Module Specification

A file-sharing module allowing organisation members to upload, browse, and download files, with optional cross-organisation sharing via designated shared-root folders.

---

## Status

Draft — not yet implemented.

---

## Roles & Permissions

Two new permission roles are introduced:

| Role           | Capabilities                                                    |
| -------------- | --------------------------------------------------------------- |
| `drive-editor` | Upload files, upload new versions, create/rename/delete folders |
| (none added)   | Regular `member`: download/view files only — no mutations       |

Sharing relationship setup (host and guest sides) is restricted to org `owner` / `admin`.

The existing `owner` and `admin` roles inherit all `drive-editor` capabilities plus sharing management.

### Permission statements to add to `src/lib/permissions.ts`

```ts
driveFolder: ["view", "create", "update", "delete"],
driveFile:   ["view", "upload", "delete"],
driveShare:  ["manage"],   // setup/accept/revoke sharing relationships
```

Role assignments:

| Role           | `driveFolder`                | `driveFile`          | `driveShare` |
| -------------- | ---------------------------- | -------------------- | ------------ |
| `owner`        | view, create, update, delete | view, upload, delete | manage       |
| `admin`        | view, create, update, delete | view, upload, delete | manage       |
| `drive-editor` | view, create, update, delete | view, upload, delete | —            |
| `member`       | view                         | view                 | —            |

---

## Org Configuration

Drive config follows the existing key-value pattern: settings are defined in `src/lib/schemas/organization-settings.ts` and stored in the `OrganizationConfig` table (rows of `{ organizationId, key, value }`).

Add a `drive` entry to the `modules` section of `organizationSettingsSchema` and to the `moduleKeys` array:

```ts
// in organizationSettingsSchema → modules
drive: z.object({
    enabled:          z.boolean().default(false),
    maxFolderDepth:   z.number().int().min(1).max(20).default(5),
    maxFileSizeBytes: z.number().int().positive().default(104_857_600), // 100 MB
    storageLimitBytes: z.number().int().positive().nullable().default(null), // null = unlimited
}),
```

The drive index page displays current usage (sum of all live version blob sizes) vs. `storageLimitBytes`. Uploads are blocked server-side if adding the new file would exceed the limit.

---

## Data Model

### `DriveFolder`

```prisma
model DriveFolder {
  id             String   @id
  organizationId String
  parentId       String?
  name           String
  depth          Int      // stored for efficient depth-limit checks; root folders = 1
  createdAt      DateTime @default(now())
  createdById    String   // userId

  organization   Organization  @relation(fields: [organizationId], references: [id])
  parent         DriveFolder?  @relation("FolderChildren", fields: [parentId], references: [id])
  children       DriveFolder[] @relation("FolderChildren")
  files          DriveFile[]
  sharedRoots    DriveSharedRoot[]
}
```

### `DriveFile`

Represents a logical file. Actual binary content lives in Vercel Blob; each version has its own blob URL.

```prisma
model DriveFile {
  id                  String   @id
  organizationId      String   // owning org (important for inter-org uploads)
  folderId            String
  title               String
  description         String?
  copyrightHolder     String?
  createdAt           DateTime @default(now())
  createdById         String   // userId of initial uploader
  currentVersionId    String?  // points to the active DriveFileVersion

  organization        Organization      @relation(fields: [organizationId], references: [id])
  folder              DriveFolder       @relation(fields: [folderId], references: [id])
  versions            DriveFileVersion[]
  currentVersion      DriveFileVersion? @relation("CurrentVersion", fields: [currentVersionId], references: [id])
}
```

### `DriveFileVersion`

```prisma
model DriveFileVersion {
  id               String   @id
  fileId           String
  versionNumber    Int      // monotonically increasing per file
  blobUrl          String   // Vercel Blob URL
  blobKey          String   // Vercel Blob key (needed to delete from blob store)
  originalFilename String
  mimeType         String
  fileSizeBytes    BigInt
  uploadedAt       DateTime @default(now())
  uploadedById     String   // userId

  file             DriveFile @relation(fields: [fileId], references: [id])
}
```

### `DriveSharedRoot`

Represents an invitation from a host org to a guest org to access a specific folder.

```prisma
model DriveSharedRoot {
  id                   String              @id
  folderId             String              // the shared root folder (must belong to hostOrganizationId)
  hostOrganizationId   String
  guestOrganizationId  String
  status               DriveShareStatus    @default(PENDING)
  invitedById          String              // userId — must be owner/admin of host org
  invitedAt            DateTime            @default(now())
  respondedById        String?             // userId — must be owner/admin of guest org
  respondedAt          DateTime?

  folder               DriveFolder  @relation(fields: [folderId], references: [id])
  hostOrganization     Organization @relation("DriveSharedRootHost",  fields: [hostOrganizationId],  references: [id])
  guestOrganization    Organization @relation("DriveSharedRootGuest", fields: [guestOrganizationId], references: [id])
}

enum DriveShareStatus {
  PENDING
  ACCEPTED
  DECLINED
  REVOKED
}
```

---

## Inter-Organisation Sharing

### Concepts

- A **host org** designates any folder in its own drive as a **shared root**.
- The host org `owner`/`admin` sends an **invite** to a specific guest org.
- The guest org `owner`/`admin` can **accept** or **decline** the invite.
- Once accepted, the shared root folder (and its entire subtree) is visible to the guest org as a read-only mount point — accessible via the guest org's drive UI.

### Guest org capabilities within a shared root

| Actor                | Capability                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------- |
| Guest `member`       | Browse and download all files within the shared root subtree                                |
| Guest `drive-editor` | Create folders within the shared root; upload new files                                     |
| Guest `drive-editor` | Upload a new version of a file **only if** `DriveFile.organizationId` matches their own org |
| Guest `drive-editor` | Cannot rename/delete folders or files belonging to the host or another guest org            |

### Folder depth in shared roots

Folder depth limits use the **guest org's** `maxFolderDepth` config, counted relative to the shared root (i.e. the shared root itself counts as depth 1 from the guest's perspective).

### Copyright confirmation on upload to a shared root

When a guest org `drive-editor` initiates a file upload (or version upload) into a shared root or any of its subfolders, the upload dialog must display a copyright confirmation checkbox before the upload can proceed:

> "I confirm that I have the necessary rights or permissions to share this file with the host organisation."

The checkbox must be explicitly checked — it must not be pre-checked. The upload action remains disabled until it is checked. This confirmation is UI-only; no record of it is stored server-side.

### Revocation

A host org `owner`/`admin` can revoke a sharing relationship at any time. The shared root becomes inaccessible to the guest org immediately. Files uploaded by the guest org remain in the host org's folder — the host is responsible for any cleanup.

---

## tRPC Procedures

All procedures live in a new `driveRouter` registered as `drive` in `_app.ts`.

### Folder procedures

| Procedure                    | Auth                 | Description                                         |
| ---------------------------- | -------------------- | --------------------------------------------------- |
| `drive.folder.list`          | member               | List direct children of a folder (or root)          |
| `drive.folder.create`        | drive-editor         | Create a folder; enforces `maxFolderDepth`          |
| `drive.folder.rename`        | drive-editor (owner) | Rename a folder you have edit rights to             |
| `drive.folder.delete`        | drive-editor (owner) | Delete empty folder; errors if it contains files    |
| `drive.folder.setSharedRoot` | owner/admin          | Designate a folder as a shared root and send invite |

### File procedures

| Procedure                   | Auth                 | Description                                                       |
| --------------------------- | -------------------- | ----------------------------------------------------------------- |
| `drive.file.list`           | member               | List files in a folder                                            |
| `drive.file.create`         | drive-editor         | Create metadata record after client-side blob upload              |
| `drive.file.updateMeta`     | drive-editor (owner) | Update title, description, copyright holder                       |
| `drive.file.delete`         | drive-editor         | Delete any file owned by their org + all versions from blob store |
| `drive.file.uploadVersion`  | drive-editor         | Add a new version; prompts retention of old versions              |
| `drive.file.deleteVersion`  | drive-editor (owner) | Delete a specific older version from blob store                   |
| `drive.file.getDownloadUrl` | member               | Return a short-lived Vercel Blob download URL                     |

"drive-editor (owner)" means the acting user must have `drive-editor` permission **and** their org must own the resource (i.e. `DriveFile.organizationId` matches the acting user's org).

### Sharing procedures

| Procedure                  | Auth                | Description                                             |
| -------------------------- | ------------------- | ------------------------------------------------------- |
| `drive.share.invite`       | owner/admin         | Send sharing invite for a folder to a guest org         |
| `drive.share.accept`       | owner/admin (guest) | Accept a pending invite                                 |
| `drive.share.decline`      | owner/admin (guest) | Decline a pending invite                                |
| `drive.share.revoke`       | owner/admin (host)  | Revoke an accepted sharing relationship                 |
| `drive.share.listOutgoing` | owner/admin         | List sharing relationships this org has created         |
| `drive.share.listIncoming` | owner/admin         | List sharing invites/relationships received by this org |

### Config procedures

Drive config is read and written via the existing organisation settings tRPC procedures (no new `drive.config.*` procedures needed). The `modules.drive` key group is managed the same way as other module configs.

---

## Pages & Routes

New path helpers to add to `src/paths.ts` under `Paths.org(slug).drive`:

| Helper                                      | Path                                                     |
| ------------------------------------------- | -------------------------------------------------------- |
| `drive.index`                               | `/orgs/[slug]/drive`                                     |
| `drive.folder(folderId)`                    | `/orgs/[slug]/drive/folders/[folderId]`                  |
| `drive.sharedRoot(shareId)`                 | `/orgs/[slug]/drive/shared/[shareId]`                    |
| `drive.sharedRootFolder(shareId, folderId)` | `/orgs/[slug]/drive/shared/[shareId]/folders/[folderId]` |

### Key pages

**`/orgs/[slug]/drive`** — Drive root
Shows the org's own top-level folders plus any accepted incoming shared roots (displayed as a separate "Shared with us" section). `drive-editor` sees upload/create folder actions.

**`/orgs/[slug]/drive/folders/[folderId]`** — Folder view
Folder breadcrumb, list of subfolders and files. `drive-editor` sees upload/new folder/rename/delete actions. All members see download links.

**`/orgs/[slug]/drive/shared/[shareId]`** and **`…/folders/[folderId]`** — Shared root views
Same layout as own-folder views but scoped to the shared root. Permission checks enforce guest-org rules.

---

## File Upload Flow

Vercel Blob does not accept server-proxied uploads above a small size threshold. The recommended pattern is a **client-side direct upload**:

1. Client calls a server action / tRPC mutation to request a Vercel Blob upload token (`handleUpload` pattern).
2. Client uploads directly to Vercel Blob using the token.
3. On upload completion, client calls `drive.file.create` (or `drive.file.uploadVersion`) with the returned `blobUrl`, `blobKey`, size, and MIME type to persist metadata.

This keeps large files off the Next.js serverless function and avoids timeouts.

---

## Version Upload Flow

1. User selects "Upload new version" on a file.
2. UI shows a dialog: file picker + checkbox **"Delete previous version(s)"** (default: unchecked — keep all).
3. On confirm, client follows the same client-side upload flow as above.
4. `drive.file.uploadVersion` is called with the blob result and the retention choice.
   - If delete previous: the server deletes old blob(s) from Vercel Blob and removes `DriveFileVersion` records.
   - `DriveFile.currentVersionId` is updated to the new version.
   - `versionNumber` is incremented.

---

## Version Browsing UI

Each file has a **Versions** panel (e.g. a sheet or expandable section) accessible from the file row/detail view. It lists all retained `DriveFileVersion` records in reverse chronological order, showing version number, original filename, size, uploader, and upload date. From this panel:

- Any `member` can download any listed version.
- A `drive-editor` (org-owner of the file) can delete any non-current version.
- Promoting an old version to current is out of scope for now (re-upload is the intended path).

## Decisions

- `drive-editor` can delete any file owned by their org (i.e. `DriveFile.organizationId` matches their org) — not limited to files they personally uploaded.
- When a host revokes sharing, files uploaded by the guest org remain attributed to the guest org (`DriveFile.organizationId` unchanged) but are no longer accessible to the guest. The host org retains physical custody of the blobs and is responsible for any cleanup.
- Folder deletion is blocked if the folder contains any files or subfolders (no cascade delete).
