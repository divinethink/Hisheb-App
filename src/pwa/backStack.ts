// ফোনের ব্যাক বাটন ফিক্স (owner-request, ২০২৬-১০-২৫): আগে sheet/স্ক্রিন খুললে browser history-তে কিছু
// যোগ হতো না, তাই ব্যাক চাপলে সোজা অ্যাপ থেকে বেরিয়ে যেত। এখন প্রতিটা খোলা overlay (BottomSheet,
// FullScreenPage, non-home ট্যাব) এখানে একটা handler রেজিস্টার করে; ব্যাক চাপলে সবচেয়ে ওপরের handler
// (অর্থাৎ সর্বশেষ খোলা জিনিস) বন্ধ হয়। কিছু খোলা না থাকলে ব্যাক স্বাভাবিকভাবে অ্যাপ থেকে বের করে।
//
// কেন এই ডিজাইন: history-র "গভীরতা" (histDepth) সবসময় খোলা handler-এর সংখ্যার (stack.length) সমান রাখা হয়।
//  - খোলা: pushState; UI থেকে বন্ধ (Cancel/Save): history.go(-n) দিয়ে ফেরত (microtask-এ batch, যাতে
//    "screen → child screen" বদলে অকারণ history ওঠানামা না হয়)।
//  - ব্যাক-বাটন: popstate-এ আগে গভীরতা পুনঃস্থাপন (re-push), তারপর ওপরের handler-কে close ডাকা। handler
//    বন্ধ না করলেও (যেমন "unsaved changes?" confirm) stack/history মিলে থাকে — কোনো অনুমান-নির্ভর timing নেই।
// UI/React-মুক্ত (শুধু window.history), তাই আলাদা টেস্টযোগ্য। React hook: hooks/useBackClose.ts।

interface Entry {
  close: () => void;
}

const stack: Entry[] = [];
let histDepth = 0; // আমাদের push করা entry browser history-তে এখন কয়টা (base-এর ওপরে)
let busy = false; // নিজের go(-n) চলছে, popstate এলে সেটা "প্রোগ্রাম-করা" ধরতে হবে
let scheduled = false;
let initialized = false;
let busyTimer: ReturnType<typeof setTimeout> | null = null;

function depthOfState(): number {
  const s = window.history.state as { hsbDepth?: unknown } | null;
  return s && typeof s.hsbDepth === 'number' ? s.hsbDepth : 0;
}

function clearBusy() {
  busy = false;
  if (busyTimer !== null) {
    clearTimeout(busyTimer);
    busyTimer = null;
  }
}

function sync() {
  if (busy) return;
  while (histDepth < stack.length) {
    histDepth += 1;
    window.history.pushState({ hsbDepth: histDepth }, '');
  }
  if (histDepth > stack.length) {
    const n = histDepth - stack.length;
    busy = true;
    // popstate না এলে (অস্বাভাবিক) আটকে না থাকতে safety-timeout
    busyTimer = setTimeout(() => {
      busyTimer = null;
      if (!busy) return;
      busy = false;
      histDepth = depthOfState();
      sync();
    }, 1000);
    window.history.go(-n);
  }
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    sync();
  });
}

function onPopState() {
  const landed = depthOfState();
  if (busy) {
    // আমাদের নিজের go(-n)-এর ফল
    clearBusy();
    histDepth = landed;
    sync();
    return;
  }
  if (landed >= histDepth) {
    // forward navigation বা অজানা অবস্থা — শুধু মিলিয়ে নেওয়া
    histDepth = landed;
    sync();
    return;
  }
  // ইউজার ব্যাক চেপেছে: গভীরতা পুনঃস্থাপন করে ওপরের handler-কে বন্ধ করতে বলা
  histDepth = landed;
  const top = stack[stack.length - 1];
  sync();
  top?.close();
}

function init() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  // পেজ reload-এর পরেও আগের state-এর গভীরতা থেকে যেতে পারে — সেটা চুপচাপ base-এ নামিয়ে আনা
  histDepth = depthOfState();
  window.addEventListener('popstate', onPopState);
}

/** একটা "ব্যাক-এ বন্ধ হয়" handler রেজিস্টার করে; ফেরত দেওয়া ফাংশন (cleanup) UI থেকে বন্ধ হলে ডাকতে হবে। */
export function pushBackHandler(close: () => void): () => void {
  init();
  const entry: Entry = { close };
  stack.push(entry);
  schedule();
  return () => {
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    schedule();
  };
}

/** শুধু টেস্টের জন্য — অবস্থা পুরো রিসেট। */
export function __resetBackStackForTests(): void {
  if (typeof window !== 'undefined') window.removeEventListener('popstate', onPopState);
  stack.length = 0;
  histDepth = 0;
  scheduled = false;
  initialized = false;
  clearBusy();
}
