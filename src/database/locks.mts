import { open, unlink } from 'fs/promises';
import { z } from 'zod';

const writelockPath = 'src/database/lock';

export async function releaseLock() {
  try {
    //Deletes the lock
    await unlink(writelockPath);
  } catch (err) {
    //Something non-lock related went wrong.
    console.error('Error acquiring lock:', err);
  }
}

export async function awaitLock() {
  let fileHandle;
  try {
    //checks if it can open a new file, using the writing inly flag.
    fileHandle = await open(writelockPath, 'wx');
  } catch (err) {
    //checks if err is of the correct type.
    const errorScheme = z.object({ code: z.string() });
    const e = errorScheme.parse(err);
    if (e.code === 'EEXIST') {
      //the lock is not acquired. The function is put to sleep and then called again.
      await sleep(50);
      await awaitLock();
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
