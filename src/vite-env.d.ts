/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// App Check debug token (শুধু localhost/Staging — Production env-এ কখনো না)
declare global {
  var FIREBASE_APPCHECK_DEBUG_TOKEN: boolean | string | undefined;
}
export {};
