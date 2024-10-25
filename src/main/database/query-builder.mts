import type { UserEntry, DataEntry, LockFileName, MetaData } from './database-interfaces.mjs';
import { releaseLock, awaitLock } from './locks.mjs';
import { access, mkdir } from 'fs/promises';
import { Table } from './table.mjs';
import { existsSync, promises } from 'fs';
import { z } from 'zod';
/**
 * Creates a query of the database.
 *
 * @param table - The specific database table being queried.
 * @param database_path_folder - Optional variable, the path to the directory containing the database files.
 *                               It overrides the default folderpath.
 */
export class Query<Type extends DataEntry> {
  private readonly DATABASE_PATH: string;
  private readonly DATABASE_FOLDER_PATH: string;
  private readonly LOCK_PATH: LockFileName;
  private readonly INDEX;
  table: Table<Type>;
  filters: ((value: Type) => boolean)[] = [];

  constructor(table: Table<Type>, database_path_folder?: string) {
    this.table = table;
    if (database_path_folder) {
      this.DATABASE_PATH = database_path_folder + 'database-tests' + '-' + this.table.name + '.json';
      this.DATABASE_FOLDER_PATH = database_path_folder;
      this.LOCK_PATH = database_path_folder + 'lock-' + this.table.name + '.txt';
    } else {
      this.DATABASE_FOLDER_PATH = 'assets/databaseJSON/';
      this.DATABASE_PATH = 'assets/databaseJSON/' + 'database' + '-' + this.table.name + '.json';
      this.LOCK_PATH = 'assets/databaseJSON/' + 'lock-' + this.table.name + '.txt';
    }
    this.INDEX = this.table.hasIndex();
  }

  /**
   * Checks if the folder exists. If not it creates the correct folder.
   */
  async checkPathNew() {
    if (!existsSync(this.DATABASE_FOLDER_PATH)) {
      try {
        await mkdir(this.DATABASE_FOLDER_PATH);
      } catch (err) {
        //Checks if err is of the correct type.
        const errorScheme = z.object({ code: z.string() });
        const e = errorScheme.parse(err);
        if (e.code !== 'EEXIST') {
          throw err;
        }
      }
    }
  }

  /**
   * Checks if a 'primaries' file exists. If not it creates the correct file.
   *
   * @param path - The path that has to be checked.
   */
  async checkPrimariesNew(path: string) {
    try {
      await promises.access(path);
    } catch (err) {
      if (err === Error('ENOENT')) {
        try {
          await promises.writeFile(path, '[]');
        } catch (err) {
          if (err !== Error('EEXIST')) {
            throw err;
          }
        }
      }
    }
  }

  /**
   * Checks if a 'metadata file exists. If not it creates the correct file.
   *
   * @param path - The path that has to be checked.
   */
  async checkMetaDataNew(path: string) {
    try {
      await promises.access(path);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('ENOENT')) {
        try {
          const metadata: MetaData = { count: 0 };
          await promises.writeFile(path, JSON.stringify(metadata, null, 2));
        } catch (err) {
          if (err !== Error('EEXIST')) {
            throw err;
          }
        }
      }
    }
  }

  /**
   * Adds the given predicate to the filters.
   *
   * @param predicate - The condition on which to filter.
   * @returns The querry with the added filter.
   */
  filter(predicate: (entry: Type) => boolean): Query<Type> {
    this.filters.push(predicate);
    return this;
  }

  /**
   * Returns the results of the query.
   *
   * @param index_atribute - The value of the requested index atribute.
   * @returns the current entries of the query.
   */
  async results(index_atribute?: string): Promise<Type[]> {
    await this.checkPathNew();
    await awaitLock(this.LOCK_PATH);
    let results: Type[];
    if (index_atribute) {
      let index: string;
      if (this.table.name === 'messages') {
        index = index_atribute;
      } else if (this.table.name === 'users') {
        index = index_atribute.charAt(0);
        //index = index_atribute.split('@')[1]!;
      } else throw new Error('This attribute is not an index attribute.');
      const data_path = this.DATABASE_FOLDER_PATH + 'database' + '-' + this.table.name + '-INDEX-' + index + '.json';
      const lock_path: LockFileName =
        this.DATABASE_FOLDER_PATH + 'lock-' + this.table.name + '-INDEX-' + index + '.txt';
      await awaitLock(lock_path);
      results = await loadData<Type>(data_path);
      await releaseLock(lock_path);
    } else {
      results = await loadData<Type>(this.DATABASE_PATH);
    }
    for (const predicate of this.filters) {
      results = results.filter(predicate);
    }
    await releaseLock(this.LOCK_PATH);
    return results;
  }

  /**
   * Deletes the current entries of the query.
   * Removes friendships if the deleted entries are users.
   *
   * @returns The deleted entries.
   */
  private async deleteImplementation(data_path: string, index: boolean) {
    const primaries_path: string = this.DATABASE_FOLDER_PATH + 'primaries-' + this.table.name + '.json';
    const primaries_lock_path: LockFileName = this.DATABASE_FOLDER_PATH + 'primaries-lock-' + this.table.name + '.txt';

    const metadata_path = this.DATABASE_FOLDER_PATH + 'metadata-' + this.table.name + '.json';
    const metadata_lock_path: LockFileName = this.DATABASE_FOLDER_PATH + 'metadata-lock-' + this.table.name + '.txt';

    if (!index) {
      await this.checkPrimariesNew(primaries_path);

      await this.checkMetaDataNew(metadata_path);

      await awaitLock(primaries_lock_path);

      await awaitLock(metadata_lock_path);
    }
    let table_entries: Type[] = await loadData<Type>(data_path);

    let removed = Array.from(table_entries);

    for (const predicate of this.filters) {
      removed = removed.filter((entry) => predicate(entry)); //clone van maken
    }

    //removes friendships if the deleted item is a user.
    if (removed.length !== 0 && (removed[0] as UserEntry).email_ID !== undefined) {
      for (const entry of removed as UserEntry[]) {
        const selectFriends: (entry: UserEntry) => boolean = (friend) => entry.friends.includes(friend.email_ID);
        const friends = table_entries.filter((user) => selectFriends(user as UserEntry));
        const removeFriend: (user1: UserEntry) => void = (user1) => {
          const new_friends = del(user1.friends, entry.email_ID);
          user1.friends = new_friends;
        };
        table_entries.map((entry2) => {
          if (friends.includes(entry2)) {
            removeFriend(entry2 as UserEntry);
          }
        });
      }
    }

    table_entries = table_entries.filter((entry: Type) => {
      return !removed.includes(entry);
    });
    if (!index) {
      const primaries = table_entries.map((x) => this.table.getPrimaryKey(x));

      const writePrimaries = JSON.stringify(primaries, null, 2);

      await promises.writeFile(primaries_path, writePrimaries, { encoding: 'utf8' });

      const metadata: MetaData = { count: table_entries.length };

      const writeMetadata = JSON.stringify(metadata, null, 2);

      await promises.writeFile(metadata_path, writeMetadata, { encoding: 'utf8' });

      await releaseLock(primaries_lock_path);

      await releaseLock(metadata_lock_path);
    }
    await writeData(data_path, this.DATABASE_FOLDER_PATH, table_entries);

    return removed;
  }

  /**
   * Uses the delete implementation to remove the current entries, both in the main database, as well as the indexed ones if necessary.
   * Removes friendships if the deleted entries are users.
   *
   * @returns The deleted entries.
   */
  async delete(): Promise<Type[]> {
    await this.checkPathNew();
    await awaitLock(this.LOCK_PATH);
    const removed = await this.deleteImplementation(this.DATABASE_PATH, false);

    if (this.INDEX) {
      const indeces = Array.from(new Set(removed)).map((x) => this.table.getIndex(x));
      for (const index of indeces) {
        const data_path = this.DATABASE_FOLDER_PATH + 'database' + '-' + this.table.name + '-INDEX-' + index + '.json';
        const lock_path: LockFileName =
          this.DATABASE_FOLDER_PATH + 'lock-' + this.table.name + '-INDEX-' + index + '.txt';
        await awaitLock(lock_path);
        await this.deleteImplementation(data_path, true);
        await releaseLock(lock_path);
      }
    }
    await releaseLock(this.LOCK_PATH);
    return removed;
  }

  /**
   * Inserts an entry into a specific database table, based on its type.
   * Does this by appending the entry at the end of the database, without loading it entirely.
   *
   * @param entry - The entry that has to be added to the database.
   * @param data_path - Path to the database
   * @param lock_path - Path to the lock
   * @param check_up - Indication if the primary keys have to be checked.
   * @returns The original entry that was given as an input.
   */
  private async insertImplementation(
    entries: Type[],
    data_path: string,
    check_up: boolean,
    lock_path?: LockFileName,
  ): Promise<Type[]> {
    if (check_up) {
      const primaries_path: string = this.DATABASE_FOLDER_PATH + 'primaries-' + this.table.name + '.json';
      const primaries_lock_path: LockFileName =
        this.DATABASE_FOLDER_PATH + 'primaries-lock-' + this.table.name + '.txt';

      const metadata_path = this.DATABASE_FOLDER_PATH + 'metadata-' + this.table.name + '.json';
      const metadata_lock_path: LockFileName = this.DATABASE_FOLDER_PATH + 'metadata-lock-' + this.table.name + '.txt';

      await this.checkPrimariesNew(primaries_path);

      await this.checkMetaDataNew(metadata_path);

      await awaitLock(primaries_lock_path);

      await awaitLock(metadata_lock_path);

      const primaries: string[] = await new Promise((resolve) => {
        promises
          .readFile(primaries_path, 'utf8')
          .then((rawData) => resolve(JSON.parse(rawData) as string[]))
          .catch((_error) => resolve([] as string[]));
      });

      const metadata: MetaData = await loadMetaData(metadata_path);

      const added_primaries: string[] = entries.map((x) => this.table.getPrimaryKey(x));

      //Checks if the added entries all have different Primary ID's.
      for (const i of added_primaries) {
        let count = 0;
        added_primaries.map((x) => {
          if (x === i) {
            count += 1;
          }
        });
        if (count > 1) {
          if (lock_path) {
            await releaseLock(lock_path);
          }
          await releaseLock(primaries_lock_path);
          await releaseLock(metadata_lock_path);
          throw new Error('Entries have the same primary ID.');
        }
      }

      const intersection: string[] = primaries.filter((x) => added_primaries.includes(x));

      if (intersection.length > 0) {
        if (lock_path) {
          await releaseLock(lock_path);
        }
        await releaseLock(primaries_lock_path);
        await releaseLock(metadata_lock_path);
        throw new Error('Primary ID already exists.');
      }

      const new_primaries: string[] = primaries.concat(added_primaries);
      const writeBackPrimaries = JSON.stringify(new_primaries, null, 2);

      await promises.writeFile(primaries_path, writeBackPrimaries, { encoding: 'utf8' });

      metadata.count = metadata.count + entries.length;

      const writeBackMetadata = JSON.stringify(metadata, null, 2);

      await promises.writeFile(metadata_path, writeBackMetadata, { encoding: 'utf8' });

      await releaseLock(primaries_lock_path);

      await releaseLock(metadata_lock_path);
    }

    const entriesToWrite = JSON.stringify(entries, null, 2).slice(1, -1);

    if (!existsSync(data_path)) {
      try {
        await promises.appendFile(data_path, entriesToWrite);
      } catch (err) {
        if (err !== 'EEXIST') {
          throw err;
        }
      }
    } else {
      await promises.appendFile(data_path, ',\n' + entriesToWrite);
    }
    return entries;
  }

  /**
   * Uses the insertImplementation to insert a given entry both into the main as well as in the indexed database.
   * @param entry - the inserted entry.
   * @returns The original inserted entry.
   */
  async insert(...entries: Type[]): Promise<Type[]> {
    await this.checkPathNew();
    await awaitLock(this.LOCK_PATH);
    const res = await this.insertImplementation(entries, this.DATABASE_PATH, true, this.LOCK_PATH);

    if (this.INDEX) {
      const groupedEntries = this.groupListByIndex(entries);
      for (const specificEntries of groupedEntries) {
        let data_path: string;
        let lock_path: LockFileName;
        if (specificEntries[0]) {
          const index = this.table.getIndex(specificEntries[0]);
          data_path = this.DATABASE_FOLDER_PATH + 'database' + '-' + this.table.name + '-INDEX-' + index + '.json';
          lock_path = this.DATABASE_FOLDER_PATH + 'lock-' + this.table.name + '-INDEX-' + index + '.txt';
        } else throw new Error('Entry grouping went wrong.');
        await awaitLock(lock_path);

        await this.insertImplementation(specificEntries, data_path, false);
        await releaseLock(lock_path);
      }
    }
    await releaseLock(this.LOCK_PATH);
    return res;
  }

  /**
   * Updates the current entries.
   *
   * @param updater - The updater function that is applied.
   * @returns The updated entries.
   */
  async update(updater: (entry: Type) => void): Promise<Type[]> {
    //loading data
    await awaitLock(this.LOCK_PATH);
    const database_entries = await loadData<Type>(this.DATABASE_PATH);

    let table_entries: Type[] = Array.from(database_entries);

    //applying filters
    for (const predicate of this.filters) {
      table_entries = table_entries.filter((entry) => predicate(entry));
    }

    if (this.INDEX) {
      const original_table_indices = table_entries.map((x) => this.table.getIndex(x));
      const original_keys = table_entries.map((entry) => this.table.getPrimaryKey(entry));

      //applying updates
      table_entries.forEach(updater);

      //checking key has not changed
      for (let i = 0; i < table_entries.length; i++) {
        const entry = table_entries[i] as Type;
        if (original_keys[i] !== this.table.getPrimaryKey(entry)) {
          await releaseLock(this.LOCK_PATH);
          throw new Error('Updated the primary key of some elements.');
        }
      }

      const indeces = Array.from(new Set(table_entries.map((x) => this.table.getIndex(x))));
      for (const index of indeces) {
        const data_path = this.DATABASE_FOLDER_PATH + 'database' + '-' + this.table.name + '-INDEX-' + index + '.json';
        const lock_path: LockFileName =
          this.DATABASE_FOLDER_PATH + 'lock-' + this.table.name + '-INDEX-' + index + '.txt';

        await awaitLock(lock_path);
        const database_entries = await loadData<Type>(data_path);

        let table_entries: Type[] = Array.from(database_entries);

        for (const predicate of this.filters) {
          table_entries = table_entries.filter((entry) => predicate(entry));
        }

        table_entries.forEach(updater);

        await writeData(data_path, this.DATABASE_FOLDER_PATH, database_entries);
        await releaseLock(lock_path);
      }

      //Removing entries who's index has changed.
      //They are placed in the correct indexed file in the next for-loop.

      for (let i = 0; i < table_entries.length; i++) {
        const old_index: string = original_table_indices[i] as string;
        const new_index: string = this.table.getIndex(table_entries[i]!);
        if (old_index !== new_index) {
          //deleting the old entry.
          const data_path_old =
            this.DATABASE_FOLDER_PATH + 'database' + '-' + this.table.name + '-INDEX-' + old_index + '.json';
          const lock_path_old: LockFileName =
            this.DATABASE_FOLDER_PATH + 'lock-' + this.table.name + '-INDEX-' + old_index + '.txt';

          await awaitLock(lock_path_old);

          let old_entries: Type[] = await loadData(data_path_old);
          old_entries = old_entries.filter(
            (entry) => this.table.getPrimaryKey(entry) !== this.table.getPrimaryKey(table_entries[i]!),
          );

          await writeData(data_path_old, this.DATABASE_FOLDER_PATH, old_entries);

          await releaseLock(lock_path_old);

          //inserting the new entry.
          const data_path_new =
            this.DATABASE_FOLDER_PATH + 'database' + '-' + this.table.name + '-INDEX-' + new_index + '.json';
          const lock_path_new: LockFileName =
            this.DATABASE_FOLDER_PATH + 'lock-' + this.table.name + '-INDEX-' + new_index + '.txt';

          await awaitLock(lock_path_new);

          let entries: Type[] = await loadData(data_path_new);
          entries = entries.concat(table_entries[i]!);

          await writeData(data_path_new, this.DATABASE_FOLDER_PATH, entries);

          await releaseLock(lock_path_new);
        }
      }
    }

    const original_keys = table_entries.map((entry) => this.table.getPrimaryKey(entry));

    //applying updates
    table_entries.forEach(updater);

    //checking key has not changed
    for (let i = 0; i < table_entries.length; i++) {
      const entry = table_entries[i] as Type;

      if (original_keys[i] !== this.table.getPrimaryKey(entry)) {
        await releaseLock(this.LOCK_PATH);
        throw new Error('Updated the primary key of some elements.');
      }
    }

    //writing back
    await writeData(this.DATABASE_PATH, this.DATABASE_FOLDER_PATH, database_entries);
    await releaseLock(this.LOCK_PATH);

    return table_entries;
  }

  private groupListByIndex(entries: Type[]) {
    const res: Type[][] = [];

    const indices: Set<string> = new Set(entries.map((x) => this.table.getIndex(x)));
    for (const index of indices) {
      const specificEntries: Type[] = [];
      entries.map((x) => {
        if (this.table.getIndex(x) === index) {
          specificEntries.push(x);
        }
      });
      res.push(specificEntries);
    }
    return res;
  }
}

/**
 * Loads the database.
 *
 * @param DataPath - The pathway to the database.
 * @returns a Database format.
 */
export async function loadData<EntryType extends DataEntry>(dataPath: string): Promise<EntryType[]> {
  return new Promise((resolve) => {
    promises
      .readFile(dataPath, 'utf8')
      .then((rawData) => resolve(JSON.parse('[' + rawData + ']') as EntryType[]))
      .catch((_error) => resolve([] as EntryType[]));
  });
}

/**
 * Loads the metadata.
 *
 * @param dataPath - The pathway to the metadata.
 * @returns a MetaData format.
 */
export async function loadMetaData(dataPath: string): Promise<MetaData> {
  return new Promise((resolve) => {
    promises
      .readFile(dataPath, 'utf8')
      .then((rawData) => resolve(JSON.parse(rawData) as MetaData))
      .catch((_error) => resolve({} as MetaData));
  });
}

/**
 * Write the database.
 *
 * @param DataPath - The datapath of the directory.
 * @param databaseFolderPath - The path to the database folder.
 * @param data - The data to write to the directory.
 */
async function writeData(dataPath: string, databaseFolderPath: string, data: DataEntry[]) {
  const fileContent = JSON.stringify(data, null, 2).slice(1, -1);
  try {
    await access(databaseFolderPath);
  } catch {
    await mkdir(databaseFolderPath);
  } finally {
    await promises.writeFile(dataPath, fileContent, { encoding: 'utf8' });
  }
}

/**
 * Removes an entry from a list.
 *
 * @param list - The list to be mutated.
 * @param entry - The entry to be deleted.
 * @returns A copy of the original list, without the given entry.
 */
export function del(list: string[], entry: string): string[] {
  const index = list.findIndex((element) => element === entry);
  return list.slice(0, index).concat(list.slice(index + 1));
}
