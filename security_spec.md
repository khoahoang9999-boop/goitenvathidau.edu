# Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Authentication & Verification Invariant**: Every read and write operation to `/accounts/{accountId}` and `/admins/{adminUid}` requires an authenticated user (`request.auth != null`) with a verified email (`request.auth.token.email_verified == true`), or the bootstrapped admin (`khoahoang9999@gmail.com` with `email_verified == true`).
2. **Identity & Ownership Invariant**: On self-registration (`create` on `/accounts/{accountId}` by a non-admin), `incoming().uid == request.auth.uid`, `incoming().role == 'user'`, `incoming().status == 'active'`, and `incoming().maxDevices == 2`. A regular user can never self-assign `role: 'admin'`.
3. **Admin Supremacy & Bootstrap Invariant**: Admin status (`isAdmin()`) is granted only if the user's verified email is `khoahoang9999@gmail.com` OR an admin record exists at `/admins/$(request.auth.uid)`. Only admins can create/modify/delete `/admins/{adminUid}` or manage arbitrary `/accounts/{accountId}` documents (such as extending `expiresAt`, changing `maxDevices`, locking accounts, or viewing all accounts).
4. **Device Limit Invariant**: `activeDeviceIds` must be a list of at most 5 items (`activeDeviceIds.size() <= 5`) and during user session updates, `activeDeviceIds.size() <= existing().maxDevices`.
5. **Immutability Invariant**: For non-admin updates on `/accounts/{accountId}`, `uid`, `username`, `role`, `status`, `maxDevices`, `expiresAt`, and `createdAt` are strictly immutable (`incoming().field == existing().field`).
6. **Temporal Integrity Invariant**: On `create`, `createdAt == request.time` and `updatedAt == request.time`. On `update`, `updatedAt == request.time` and `createdAt == existing().createdAt`.
7. **Strict Schema & Volumetric Invariant**: No shadow fields are allowed (`hasAll` and `hasOnly` enforced). String lengths and regex patterns (`isValidId`) are strictly enforced on all path IDs and string properties.
8. **PII & Credential Isolation Invariant**: Reading an `/accounts/{accountId}` document is strictly restricted to the owner (`resource.data.uid == request.auth.uid`) or an admin (`isAdmin()`). No blanket `isSignedIn()` reads or lists are permitted.

---

## 2. The "Dirty Dozen" Payloads

1. **Payload 1 (Privilege Escalation / Self-Assigned Admin Role)**:
   ```json
   {
     "uid": "user_123",
     "username": "hacker01",
     "password": "password123",
     "displayName": "Hacker",
     "avatar": "",
     "role": "admin",
     "status": "active",
     "maxDevices": 2,
     "activeDeviceIds": ["dev_1"],
     "activeDevicesMeta": "[]",
     "expiresAt": 1999999999999,
     "createdAt": "SERVER_TIMESTAMP",
     "updatedAt": "SERVER_TIMESTAMP"
   }
   ```
2. **Payload 2 (Identity Spoofing on Create)**:
   ```json
   {
     "uid": "victim_uid_999",
     "username": "spoofeduser",
     "password": "password123",
     "displayName": "Spoofer",
     "avatar": "",
     "role": "user",
     "status": "active",
     "maxDevices": 2,
     "activeDeviceIds": [],
     "activeDevicesMeta": "[]",
     "expiresAt": 1800000000000,
     "createdAt": "SERVER_TIMESTAMP",
     "updatedAt": "SERVER_TIMESTAMP"
   }
   ```
3. **Payload 3 (Shadow / Ghost Field Injection)**:
   ```json
   {
     "uid": "user_123",
     "username": "normaluser",
     "password": "password123",
     "displayName": "Normal User",
     "avatar": "",
     "role": "user",
     "status": "active",
     "maxDevices": 2,
     "activeDeviceIds": [],
     "activeDevicesMeta": "[]",
     "expiresAt": 1800000000000,
     "createdAt": "SERVER_TIMESTAMP",
     "updatedAt": "SERVER_TIMESTAMP",
     "isSuperAdmin": true
   }
   ```
4. **Payload 4 (Unauthorized Expiration Extension by Regular User)**:
   ```json
   {
     "expiresAt": 9999999999999,
     "updatedAt": "SERVER_TIMESTAMP"
   }
   ```
5. **Payload 5 (Unauthorized MaxDevices Bypass by Regular User)**:
   ```json
   {
     "maxDevices": 99,
     "updatedAt": "SERVER_TIMESTAMP"
   }
   ```
6. **Payload 6 (Device Limit Overflow Attack - 3 Devices on 2-Device Limit)**:
   ```json
   {
     "activeDeviceIds": ["dev_1", "dev_2", "dev_3"],
     "activeDevicesMeta": "[{\"id\":\"dev_1\"},{\"id\":\"dev_2\"},{\"id\":\"dev_3\"}]",
     "updatedAt": "SERVER_TIMESTAMP"
   }
   ```
7. **Payload 7 (Immutable Field Mutation - Changing `createdAt` or `username`)**:
   ```json
   {
     "username": "new_username_hack",
     "displayName": "Updated Name",
     "updatedAt": "SERVER_TIMESTAMP"
   }
   ```
8. **Payload 8 (Spoofed Client Timestamp on Update)**:
   ```json
   {
     "displayName": "New Name",
     "updatedAt": "2099-01-01T00:00:00Z"
   }
   ```
9. **Payload 9 (Resource Exhaustion / 1MB String Poisoning in `displayName`)**:
   ```json
   {
     "displayName": "A_STRING_EXCEEDING_100_CHARACTERS_LIMIT_BY_FAR_TO_POISON_STORAGE_AND_UI_RENDERING_BUFFERS_12345678901234567890",
     "updatedAt": "SERVER_TIMESTAMP"
   }
   ```
10. **Payload 10 (Unverified Admin Email Spoof Attack)**:
    Auth context with `{ uid: 'attacker', email: 'khoahoang9999@gmail.com', email_verified: false }` attempting to read or write `/accounts/any_account`.
11. **Payload 11 (Cross-Tenant PII / Password Theft via `get` or `list`)**:
    Authenticated user `user_A` attempting `get(/accounts/user_B)` where `resource.data.uid == 'user_B'`.
12. **Payload 12 (Terminal / Locked Account Self-Unlock)**:
    Locked user (`existing().status == 'locked'`) attempting to update their own profile or unlock `status: 'active'`.

---

## 3. Test Runner Reference

See `firestore.rules.test.ts` in the project root for the complete test suite verifying all 12 Dirty Dozen payloads return `PERMISSION_DENIED`.
