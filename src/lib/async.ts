/** promise ms-এর মধ্যে শেষ না হলে 'pending' — অফলাইনে Firestore write সার্ভার-ack ছাড়া resolve হয় না,
 *  কিন্তু লোকাল ক্যাশে জমা থাকে; তখন UI আটকে না রেখে এগিয়ে যায়। rejection ঠিকই propagate করে। */
export async function settleOrPending<T>(p: Promise<T>, ms: number): Promise<'done' | 'pending'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pending = new Promise<'pending'>((res) => {
    timer = setTimeout(() => res('pending'), ms);
  });
  try {
    return await Promise.race([p.then(() => 'done' as const), pending]);
  } finally {
    clearTimeout(timer);
  }
}
