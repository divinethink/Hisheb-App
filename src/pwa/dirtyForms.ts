// আন-সেভড ফর্ম ট্র্যাকার: কোনো ফর্ম dirty থাকলে SW আপডেটে auto-reload স্কিপ হয়।
// ফর্ম কম্পোনেন্ট মাউন্টে markDirty()/সেভে বা বাতিলে markClean() কল করবে (P1a থেকে)।
let dirtyCount = 0;

export function markDirty(): void {
  dirtyCount += 1;
}
export function markClean(): void {
  dirtyCount = Math.max(0, dirtyCount - 1);
}
export function hasDirtyForms(): boolean {
  return dirtyCount > 0;
}
