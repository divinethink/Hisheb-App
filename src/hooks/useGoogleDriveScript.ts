import { useEffect, useState } from 'react';
import { loadGoogleIdentity } from '../data/googleDrive';

/** Drive ব্যবহারকারী স্ক্রিন mount হলেই Google স্ক্রিপ্ট লোড শুরু; শেষ হলে (বা ব্যর্থ হলে) re-render, যাতে
 *  `isGoogleDriveConfigured()`/`driveNotReadyReason()` সঠিক মান দেয়। ক্লিকের আগেই লোড, তাই popup ব্লক হয় না। */
export function useGoogleDriveScript(): void {
  const [, force] = useState(0);
  useEffect(() => {
    let alive = true;
    const done = () => {
      if (alive) force((n) => n + 1);
    };
    loadGoogleIdentity().then(done, done);
    return () => {
      alive = false;
    };
  }, []);
}
