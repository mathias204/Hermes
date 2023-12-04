import { promises } from 'fs';
import { access, mkdir } from 'fs/promises';
import type { UserEntry, DataEntry } from './database-interfaces.mjs';
import { Table } from './table.mjs';
import { releaseLock, awaitLock } from './locks.mjs';
import * as prettier from 'prettier';

/**
 * Creates a query of the database.
 * @param table The specific database table being queried.
 * @param database_path_folder Optional variable, the path to the directory containing the database files. It overrides the default folderpath.
 */
export class Query<Type extends DataEntry> {
  private readonly DATABASE_PATH: string;
  private readonly DATABASE_FOLDER_PATH: string;
  table: Table<Type>;
  filters: ((value: Type) => boolean)[] = [];

  constructor(table: Table<Type>, database_path_folder?: string) {
    this.table = table;
    if (database_path_folder) {
      this.DATABASE_PATH = database_path_folder + 'database-tests' + '-' + this.table.name + '.json';
      this.DATABASE_FOLDER_PATH = database_path_folder;
    } else {
      this.DATABASE_FOLDER_PATH = 'assets/databaseJSON/';
      this.DATABASE_PATH = 'assets/databaseJSON/' + 'database' + '-' + this.table.name + '.json';
    }
  }

  /**
   * Adds the given predicate to the filters.
   * @param predicate The condition on which to filter.
   * @returns The querry with the added filter.
   */
  filter(predicate: (entry: Type) => boolean): Query<Type> {
    this.filters.push(predicate);
    return this;
  }

  /**
   * Returns the results of the query.
   * @returns the current entries of the query.
   */
  async results(): Promise<Type[]> {
    await awaitLock();
    let results: Type[] = await loadData<Type>(this.DATABASE_PATH);

    for (const predicate of this.filters) {
      results = results.filter(predicate);
    }
    await releaseLock();
    return results;
  }

  /**
   * Deletes the current entries of the query.
   * Removes friendships if the deleted entries are users.
   * @returns The deleted entries.
   */
  async delete(): Promise<Type[]> {
    await awaitLock();

    let table_entries: Type[] = await loadData<Type>(this.DATABASE_PATH);

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

    await writeData(this.DATABASE_PATH, this.DATABASE_FOLDER_PATH, table_entries);
    await releaseLock();

    return removed;
  }

  /**
   * Inserts an entry into a specific database table, based on its type.
   * @param entry The entry that has to be added to the database.
   * @returns The original entry that was given as an input.
   */
  async insert(entry: Type): Promise<Type> {
    await awaitLock();
    const database_entries = await loadData<Type>(this.DATABASE_PATH);

    const key = this.table.getPrimaryKey(entry);
    if (database_entries.some((entry: Type) => this.table.getPrimaryKey(entry) === key)) {
      await releaseLock();
      throw new Error('Primary ID already exists.');
    }

    database_entries.push(entry);

    await writeData(this.DATABASE_PATH, this.DATABASE_FOLDER_PATH, database_entries);
    await releaseLock();

    return entry;
  }

  /**
   * Updates the current entries.
   * @param updater The updater function that is applied.
   * @returns The updated entries.
   */
  async update(updater: (entry: Type) => void): Promise<Type[]> {
    //loading data
    await awaitLock();
    const database_entries = await loadData<Type>(this.DATABASE_PATH);

    let table_entries: Type[] = Array.from(database_entries);

    //applying filters
    for (const predicate of this.filters) {
      table_entries = table_entries.filter((entry) => predicate(entry));
    }

    const original_keys = table_entries.map((entry) => this.table.getPrimaryKey(entry));

    //applying updates
    table_entries.forEach(updater);

    //checking key has not changed
    for (let i = 0; i < table_entries.length; i++) {
      const entry = table_entries[i] as Type;
      if (original_keys[i] !== this.table.getPrimaryKey(entry)) {
        await releaseLock();
        throw new Error('Updated the primary key of some elements.');
      }
    }

    //writing back
    await writeData(this.DATABASE_PATH, this.DATABASE_FOLDER_PATH, database_entries);
    await releaseLock();

    return table_entries;
  }
}

/**
 * Loads the database.
 * @param DataPath The pathway to the database.
 * @returns a Database format.
 */
async function loadData<EntryType extends DataEntry>(dataPath: string): Promise<EntryType[]> {
  return new Promise((resolve) => {
    promises
      .readFile(dataPath, 'utf8')
      .then((rawData) => resolve(JSON.parse(rawData) as EntryType[]))
      .catch((_error) => resolve([] as EntryType[]));
  });
}

/**
 * Write the database.
 * @param DataPath The datapath of the directory.
 * @param databaseFolderPath The path to the database folder.
 * @param data The data to write to the directory.
 */
async function writeData(dataPath: string, databaseFolderPath: string, data: DataEntry[]) {
  const fileContent = await prettier.format(JSON.stringify(data, undefined, 2), {
    parser: 'json',
  });
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
 * @param list The list to be mutated.
 * @param entry The entry to be deleted.
 * @returns A copy of the original list, without the given entry.
 */
export function del(list: string[], entry: string): string[] {
  const index = list.findIndex((element) => element === entry);
  return list.slice(0, index).concat(list.slice(index + 1));
}
