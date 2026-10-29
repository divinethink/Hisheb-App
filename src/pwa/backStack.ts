// ফোনের ব্যাক বাটন ফিক্স (owner-request, ২০২৬-১০-২৫): আগে sheet/স্ক্রিন খুললে browser history-তে কিছু
// যোগ হতো না, তাই ব্যাক চাপলে সোজা অ্যাপ থেকে বেরিয়ে যেত। এখন প্রতিটা খোলা overlay (BottomSheet,
// FullScreenPage, non-home ট্যাব) এখানে একটা handler রেজিস্টার করে; ব্যাক চাপলে সবচেয়ে ওপরের handler
// (অর্থাৎ সর্বশেষ খোলা জিনিস) বন্ধ হয়। কিছু খোলা না থাকলে ব্যাক স্বাভাবিকভাবে অ্যাপ থেকে বের করে।
//
// কেন এই ডিজাইন: history-র "গভীরতা" (histDepth) সবসময় খোলা handler-এর সংখ্যার (stack.length) সমান রাখা হয়।
//  - খোলা: pushState; UI থেকে বন্ধ (Cancel/Save): history.go(-n) দিয়ে ফেরত (microtask-এ batch, যাতে
//    "screen → child screen" বদলে অকারণ history ওঠানামা না হয়)।
//  - ব্যাক-বাটন: popstate-এ ওপরের handler-কে close ডাকা; UI বদল শেষে stack-এর সাথে history মেলানো। বন্ধ হলে কিছু
//    লাগে না; বদলে গেলে (screen→parent screen) বা বন্ধ না হলে ("unsaved changes?") আগের forward entry-তে go(1)।
// UI/React-মুক্ত (শুধু window.history), তাই আলাদা টেস্টযোগ্য। React hook: hooks/useBackClose.ts।

interface Entry {
  close: () => void;
}

const stack: Entry[] = [];
let histDepth = 0; // আমাদের push করা entry browser history-তে এখন কয়টা (base-এর ওপরে)
let forwardTop = 0; // সামনে (forward) সবচেয়ে বেশি কত গভীরতার entry এখনও আছে — পুনঃস্থাপনে নতুন push না করে এটাই ব্যবহার
let busy = false; // নিজের go(±n) চলছে, popstate এলে সেটা "প্রোগ্রাম-করা" ধরতে হবে
let settling = false; // ব্যাক চাপার পর UI-র বদল (বন্ধ/বদলে-যাওয়া) শেষ হওয়ার অপেক্ষা
let scheduled = false;
let initialized = false;
let busyTimer: ReturnType<typeof setTimeout> | null = null;
let settleTimer: ReturnType<typeof setTimeout> | null = null;

// কেন নতুন push নয়: ব্যাক-বাটনের popstate-এর ভেতরে করা pushState-এ ইউজার-gesture থাকে না; Chrome Android
// সেই entry-কে "skippable" ধরে, ফলে পরের ব্যাকে একাধিক ধাপ লাফিয়ে অ্যাপ থেকে বেরিয়ে যেত (screen→child-screen
// থেকে ফেরার সময়)। তাই ফেরার পর গভীরতা পুনঃস্থাপন লাগলে আগের forward entry-তে history.go(1) করা হয়।
const SETTLE_MS = 10;

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

function clearSettle() {
  settling = false;
  if (settleTimer !== null) {
    clearTimeout(settleTimer);
    settleTimer = null;
  }
}

function go(delta: number) {
  busy = true;
  // popstate না এলে (অস্বাভাবিক, বা forward entry নেই) আটকে না থাকতে safety-timeout
  busyTimer = setTimeout(() => {
    busyTimer = null;
    if (!busy) return;
    busy = false;
    histDepth = depthOfState();
    forwardTop = histDepth;
    sync();
  }, 1000);
  window.history.go(delta);
}

function sync() {
  if (busy || settling) return;
  if (histDepth < stack.length) {
    if (forwardTop > histDepth) {
      go(1); // আগের forward entry-তে ফেরা (নতুন push নয়)
      return;
    }
    while (histDepth < stack.length) {
      histDepth += 1;
      window.history.pushState({ hsbDepth: histDepth }, '');
    }
    forwardTop = histDepth;
    return;
  }
  if (histDepth > stack.length) {
    const n = histDepth - stack.length;
    forwardTop = Math.max(forwardTop, histDepth);
    go(-n);
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
    // আমাদের নিজের go(±n)-এর ফল
    clearBusy();
    histDepth = landed;
    sync();
    return;
  }
  if (landed >= histDepth) {
    // forward navigation বা অজানা অবস্থা — শুধু মিলিয়ে নেওয়া
    histDepth = landed;
    forwardTop = Math.max(forwardTop, landed);
    sync();
    return;
  }
  // ইউজার ব্যাক চেপেছে: ওপরের handler-কে বন্ধ করতে বলা; UI বদল শেষ হলে (SETTLE_MS) stack-এর সাথে মেলানো —
  // বন্ধ হলে কিছুই লাগে না, বদলে গেলে/বন্ধ না হলে (confirm) forward entry-তে ফেরা
  forwardTop = Math.max(forwardTop, histDepth);
  histDepth = landed;
  const top = stack[stack.length - 1];
  clearSettle();
  settling = true;
  settleTimer = setTimeout(() => {
    settleTimer = null;
    settling = false;
    sync();
  }, SETTLE_MS);
  top?.close();
}

function init() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  // পেজ reload-এর পরেও আগের state-এর গভীরতা থেকে যেতে পারে — সেটা চুপচাপ base-এ নামিয়ে আনা
  histDepth = depthOfState();
  forwardTop = histDepth;
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
  forwardTop = 0;
  scheduled = false;
  initialized = false;
  clearBusy();
  clearSettle();
}
