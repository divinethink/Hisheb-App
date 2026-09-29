// Owner allowlist (Architecture Plan §৩ নিয়ম ৭)। এটা শুধু UX-স্তর ("Access restricted" দেখানো);
// আসল enforcement Firestore rules-এ (isOwner)। Pure — কোনো SDK import নেই।

export interface UserIdentity {
  email: string | null | undefined;
  emailVerified: boolean;
}

export function isAllowedUser(user: UserIdentity, ownerEmail: string): boolean {
  if (!user.email || !user.emailVerified) return false;
  return user.email.trim().toLowerCase() === ownerEmail.trim().toLowerCase();
}
