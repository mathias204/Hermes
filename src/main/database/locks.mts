import { open, unlink } from 'fs/promises';
import type { LockFileName } from './database-interfaces.mjs';
import { z } from 'zod';

export async function releaseLock(path: LockFileName) {
  try {
    //Deletes the lock
    await unlink(path);
  } catch (err) {
    //Something non-lock related went wrong.
    console.error('Error releasing lock:', err);
  }
}

export async function awaitLock(path: LockFileName) {
  let fileHandle;
  try {
    //checks if it can open a new file, using the writing inly flag.
    fileHandle = await open(path, 'wx');
  } catch (err) {
    //checks if err is of the correct type.
    const errorScheme = z.object({ code: z.string() });
    const e = errorScheme.parse(err);
    if (e.code === 'EEXIST') {
      //the lock is not acquired. The function is put to sleep and then called again.
      await sleep(50);
      await awaitLock(path);
    }
    //Something non-lock related went wrong.
    else console.error('Error acquiring lock:', err);
  } finally {
    if (fileHandle) {
      await fileHandle.close();
    }
  }
}

/**
 * Puts a function to sleep.
 * @param ms The amount of time the function is put to sleep in milliseconds.
 * @returns returns a void promise, necessary for the time-out.
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
