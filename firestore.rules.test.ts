/**
 * Firestore Security Rules Verification Suite ("Dirty Dozen" Payloads)
 * Verifies all 12 attack vectors defined in security_spec.md are rejected with PERMISSION_DENIED.
 */

export interface AuthContext {
  uid: string;
  email?: string;
  email_verified?: boolean;
}

export interface TestCase {
  id: number;
  name: string;
  auth: AuthContext | null;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED' | 'ALLOWED';
}

export const DIRTY_DOZEN_TESTS: TestCase[] = [
  {
    id: 1,
    name: 'Privilege Escalation / Self-Assigned Admin Role on Create',
    auth: { uid: 'user_123', email: 'user@example.com', email_verified: true },
    operation: 'create',
    path: '/accounts/hacker01',
    payload: {
      uid: 'user_123',
      username: 'hacker01',
      password: 'password123',
      displayName: 'Hacker',
      avatar: '',
      role: 'admin',
      status: 'active',
      maxDevices: 2,
      activeDeviceIds: ['dev_1'],
      activeDevicesMeta: '[]',
      expiresAt: 1999999999999,
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Identity Spoofing on Create (Mismatched UID)',
    auth: { uid: 'user_123', email: 'user@example.com', email_verified: true },
    operation: 'create',
    path: '/accounts/spoofeduser',
    payload: {
      uid: 'victim_uid_999',
      username: 'spoofeduser',
      password: 'password123',
      displayName: 'Spoofer',
      avatar: '',
      role: 'user',
      status: 'active',
      maxDevices: 2,
      activeDeviceIds: [],
      activeDevicesMeta: '[]',
      expiresAt: 1800000000000,
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow / Ghost Field Injection',
    auth: { uid: 'user_123', email: 'user@example.com', email_verified: true },
    operation: 'create',
    path: '/accounts/normaluser',
    payload: {
      uid: 'user_123',
      username: 'normaluser',
      password: 'password123',
      displayName: 'Normal User',
      avatar: '',
      role: 'user',
      status: 'active',
      maxDevices: 2,
      activeDeviceIds: [],
      activeDevicesMeta: '[]',
      expiresAt: 1800000000000,
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
      isSuperAdmin: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Unauthorized Expiration Extension by Regular User',
    auth: { uid: 'user_123', email: 'user@example.com', email_verified: true },
    operation: 'update',
    path: '/accounts/normaluser',
    payload: {
      expiresAt: 9999999999999,
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Unauthorized MaxDevices Bypass by Regular User',
    auth: { uid: 'user_123', email: 'user@example.com', email_verified: true },
    operation: 'update',
    path: '/accounts/normaluser',
    payload: {
      maxDevices: 99,
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Device Limit Overflow Attack (3 Devices on 2-Device Limit)',
    auth: { uid: 'user_123', email: 'user@example.com', email_verified: true },
    operation: 'update',
    path: '/accounts/normaluser',
    payload: {
      activeDeviceIds: ['dev_1', 'dev_2', 'dev_3'],
      activeDevicesMeta: '[]',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Immutable Field Mutation (Changing username)',
    auth: { uid: 'user_123', email: 'user@example.com', email_verified: true },
    operation: 'update',
    path: '/accounts/normaluser',
    payload: {
      username: 'new_username_hack',
      displayName: 'Updated Name',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Spoofed Client Timestamp on Update',
    auth: { uid: 'user_123', email: 'user@example.com', email_verified: true },
    operation: 'update',
    path: '/accounts/normaluser',
    payload: {
      displayName: 'New Name',
      updatedAt: '2099-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Resource Exhaustion / Oversized displayName String',
    auth: { uid: 'user_123', email: 'user@example.com', email_verified: true },
    operation: 'update',
    path: '/accounts/normaluser',
    payload: {
      displayName: 'A'.repeat(250),
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Unverified Admin Email Spoof Attack',
    auth: { uid: 'attacker', email: 'khoahoang9999@gmail.com', email_verified: false },
    operation: 'get',
    path: '/accounts/any_account',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Cross-Tenant PII / Password Theft via get',
    auth: { uid: 'user_A', email: 'usera@example.com', email_verified: true },
    operation: 'get',
    path: '/accounts/user_B',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Terminal / Locked Account Self-Unlock',
    auth: { uid: 'locked_user', email: 'locked@example.com', email_verified: true },
    operation: 'update',
    path: '/accounts/locked_user',
    payload: {
      status: 'active',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
];
