// Google Drive personal backup (GIS OAuth token client, drive.file scope) — data/
// layer, external-API access এখানেই isolated (Architecture Plan §০ পয়েন্ট ১)।
// DailyTask প্রজেক্টের backup.js-এর প্যাটার্ন থেকে reuse করা (Dev Rule ২) —
// single-user app বলে family/member merge-logic ছাড়া সরলীকৃত।

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_FILE_NAME = 'hisheb_drive_backup.json';
const DRIVE_FOLDER_NAME = 'Hisheb Backup';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_ID_CACHE_KEY = 'hisheb_drive_folder_id';
const FILE_ID_CACHE_KEY = 'hisheb_drive_file_id';

interface GisTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}
interface GisTokenClient {
  callback: (resp: GisTokenResponse) => void;
  error_callback?: (err: unknown) => void;
  requestAccessToken: (opts: { prompt: string }) => void;
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: GisTokenResponse) => void;
          }) => GisTokenClient;
        };
      };
    };
  }
}

let tokenClient: GisTokenClient | null = null;
let accessToken: string | null = null;
let tokenExpiresAt = 0;
let tokenRequestInFlight: Promise<string> | null = null;

/** GIS script (index.html-এ লোড হয়) ও client-id দুটোই থাকলে true — না থাকলে ফিচার নীরবে বন্ধ থাকে। */
export function isGoogleDriveConfigured(clientId: string | undefined): clientId is string {
  return !!clientId && typeof window !== 'undefined' && !!window.google?.accounts?.oauth2;
}

function ensureTokenClient(clientId: string): GisTokenClient {
  if (tokenClient) return tokenClient;
  if (!window.google) throw new Error('Google Identity Services লোড হয়নি।');
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: DRIVE_SCOPE,
    callback: () => {},
  });
  return tokenClient;
}

// প্রথমে silent (prompt: "") — আগে থেকে অনুমতি থাকলে popup ছাড়াই কাজ করে;
// ব্যর্থ হলে ক্লিক-হ্যান্ডলারের মধ্যেই consent popup।
function requestToken(clientId: string, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = ensureTokenClient(clientId);
    client.callback = (resp) => {
      if (resp.access_token) {
        accessToken = resp.access_token;
        tokenExpiresAt = Date.now() + (resp.expires_in ? resp.expires_in * 1000 : 3500 * 1000);
        resolve(accessToken);
      } else {
        reject(new Error(resp.error || 'drive-auth-failed'));
      }
    };
    client.error_callback = (err) => reject(err instanceof Error ? err : new Error('drive-auth-error'));
    try {
      client.requestAccessToken({ prompt });
    } catch (err) {
      reject(err as Error);
    }
  });
}

async function getAccessToken(clientId: string): Promise<string> {
  if (accessToken && Date.now() < tokenExpiresAt - 60_000) return accessToken;
  if (tokenRequestInFlight) return tokenRequestInFlight;
  tokenRequestInFlight = (async () => {
    try {
      return await requestToken(clientId, '');
    } catch {
      return await requestToken(clientId, 'consent');
    }
  })();
  try {
    return await tokenRequestInFlight;
  } finally {
    tokenRequestInFlight = null;
  }
}

async function driveFetch(clientId: string, url: string, options?: RequestInit, retried = false): Promise<Response> {
  const token = await getAccessToken(clientId);
  const res = await fetch(url, { ...options, headers: { ...(options?.headers ?? {}), Authorization: `Bearer ${token}` } });
  if (res.status === 401 && !retried) {
    accessToken = null;
    return driveFetch(clientId, url, options, true);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Drive API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res;
}

async function findOrCreateFolder(clientId: string): Promise<string> {
  const cached = localStorage.getItem(FOLDER_ID_CACHE_KEY);
  if (cached) {
    try {
      const res = await driveFetch(clientId, `${DRIVE_API_BASE}/files/${cached}?fields=id,trashed`);
      const meta = (await res.json()) as { trashed?: boolean };
      if (!meta.trashed) return cached;
    } catch {
      /* cache stale — নিচে re-find/create */
    }
    localStorage.removeItem(FOLDER_ID_CACHE_KEY);
  }
  const q = encodeURIComponent(`name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const listRes = await driveFetch(clientId, `${DRIVE_API_BASE}/files?q=${q}&fields=files(id)&spaces=drive&pageSize=1`);
  const listJson = (await listRes.json()) as { files?: { id: string }[] };
  if (listJson.files?.[0]) {
    localStorage.setItem(FOLDER_ID_CACHE_KEY, listJson.files[0].id);
    return listJson.files[0].id;
  }
  const createRes = await driveFetch(clientId, `${DRIVE_API_BASE}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  const createJson = (await createRes.json()) as { id: string };
  localStorage.setItem(FOLDER_ID_CACHE_KEY, createJson.id);
  return createJson.id;
}

async function findExistingFile(clientId: string): Promise<{ id: string } | null> {
  const cached = localStorage.getItem(FILE_ID_CACHE_KEY);
  if (cached) {
    try {
      const res = await driveFetch(clientId, `${DRIVE_API_BASE}/files/${cached}?fields=id,trashed`);
      const meta = (await res.json()) as { trashed?: boolean };
      if (!meta.trashed) return { id: cached };
    } catch {
      /* cache stale — নিচে নাম দিয়ে re-find */
    }
    localStorage.removeItem(FILE_ID_CACHE_KEY);
  }
  const q = encodeURIComponent(`name='${DRIVE_FILE_NAME}' and trashed=false`);
  const res = await driveFetch(clientId, `${DRIVE_API_BASE}/files?q=${q}&fields=files(id)&spaces=drive&pageSize=1`);
  const json = (await res.json()) as { files?: { id: string }[] };
  return json.files?.[0] ?? null;
}

/**
 * existingFile থাকলে PATCH (একই ফাইল আপডেট), না থাকলে নতুন ফাইল তৈরি —
 * সবসময় একটাই ফাইল, প্রতিবার নতুন জমা হয় না (Roadmap §৪.৮)।
 */
export async function uploadBackupToDrive(clientId: string, payload: unknown): Promise<void> {
  const existing = await findExistingFile(clientId);
  let folderId: string | null = null;
  if (!existing) {
    try {
      folderId = await findOrCreateFolder(clientId);
    } catch {
      /* ফোল্ডার তৈরি ব্যর্থ হলেও ব্যাকআপ Drive-এর রুটে হবে, আটকাবে না */
    }
  }
  const metadata = existing
    ? {}
    : { name: DRIVE_FILE_NAME, mimeType: 'application/json', ...(folderId ? { parents: [folderId] } : {}) };
  const boundary = 'hisheb_' + Math.random().toString(36).slice(2);
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(payload)}\r\n--${boundary}--`;
  const url = existing
    ? `${DRIVE_UPLOAD_BASE}/files/${existing.id}?uploadType=multipart&fields=id`
    : `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id`;
  const res = await driveFetch(clientId, url, {
    method: existing ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  const json = (await res.json()) as { id: string };
  localStorage.setItem(FILE_ID_CACHE_KEY, json.id);
}
