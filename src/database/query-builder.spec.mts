import { it, expect, describe } from 'vitest';
import { Query } from './query-builder.mjs';
import { Table } from './table.mjs';
import type { ChannelEntry, MessageEntry, UserEntry } from './database-interfaces.mjs';
import { makeFriends } from './queries.mjs';
import { access, rmdir } from 'fs/promises';

const dataPathTest = 'assets/database-query-builder-testJSON/';

const date_time_iso = '2023-11-06T18:26:45.126Z';
const date_time2_iso = '2024-11-06T12:12:35.126Z';

const test_message1: MessageEntry = {
  message_ID: 'one',
  sender_ID: 'jonas.couwberghs@student.kuleuven.be',
  channel_ID: '1',
  sent_at_utc_timestamp: date_time_iso,
  message: 'Hello world',
};
const test_message2: MessageEntry = {
  message_ID: 'two',
  sender_ID: 'pieter.vanderschueren1@student.kuleuven.be',
  channel_ID: '1',
  sent_at_utc_timestamp: date_time_iso,
  message: 'Goodbye world',
};
const test_message_to_insert: MessageEntry = {
  message_ID: 'three',
  sender_ID: 'pieter.vanderschueren1@student.kuleuven.be',
  channel_ID: '2',
  sent_at_utc_timestamp: date_time_iso,
  message: 'Test test',
};
const test_message_sameID: MessageEntry = {
  message_ID: 'one',
  sender_ID: 'jonas.couwberghs@student.kuleuven.be',
  channel_ID: '2',
  sent_at_utc_timestamp: date_time_iso,
  message: 'I have an ID that is already in database',
};
const test_channel1: ChannelEntry = {
  channel_ID: '1',
  name: 'Database',
};
const test_channel2: ChannelEntry = {
  channel_ID: '2',
  name: 'Server',
};
const test_user1: UserEntry = {
  email_ID: 'jonas.couwberghs@student.kuleuven.be',
  user_name: 'Jonas',
  last_seen_utc_timestamp: date_time_iso,
  hashed_pass: '99ac8bf4bf76806c',
  channels: ['1', '2'],
  self_destruct_at_utc_timestamp: date_time2_iso,
  friends: ['pieter.vanderschueren1@student.kuleuven.be'],
  destroy_warning: false,
};
const test_user1_no_friends: UserEntry = {
  email_ID: 'jonas.couwberghs@student.kuleuven.be',
  user_name: 'Jonas',
  last_seen_utc_timestamp: date_time_iso,
  hashed_pass: '99ac8bf4bf76806c',
  channels: ['1', '2'],
  self_destruct_at_utc_timestamp: date_time2_iso,
  friends: [],
  destroy_warning: false,
};
const test_user2: UserEntry = {
  email_ID: 'pieter.vanderschueren1@student.kuleuven.be',
  user_name: 'Pieter',
  last_seen_utc_timestamp: date_time_iso,
  hashed_pass: 'a9ab1kipcornbdb3',
  channels: ['1'],
  self_destruct_at_utc_timestamp: date_time2_iso,
  friends: ['jonas.couwberghs@student.kuleuven.be'],
  destroy_warning: false,
};

describe('Query builder tests on data from a test database', () => {
  it('Retrieves messages from a specific user', async () => {
    const res = await new Query(Table.MESSAGES, dataPathTest)
      .filter(({ sender_ID }) => sender_ID === 'jonas.couwberghs@student.kuleuven.be')
      .results();
    expect(res).toEqual([test_message1]);
  });
  it('Retrieves messages from a given channel', async () => {
    const res = await new Query(Table.MESSAGES, dataPathTest).filter(({ channel_ID }) => channel_ID === '1').results();
    expect(res).toEqual([test_message1, test_message2]);
  });
  it('Extracts all channels', async () => {
    const res = await new Query(Table.CHANNELS, dataPathTest).results();
    expect(res).toEqual([test_channel1, test_channel2]);
  });
  it('Retrieves all users', async () => {
    const res = await new Query(Table.USERS, dataPathTest).results();
    return res.includes(test_user1 && test_user2);
  });
  it('Validates the absence of messages from a non-existent user', async () => {
    const res = await new Query(Table.MESSAGES, dataPathTest)
      .filter(({ sender_ID }) => sender_ID === 'Jibberish')
      .results();
    expect(res).toEqual([]);
  });
  it('Verifies successful inserion of a new message', async () => {
    await new Query(Table.MESSAGES, dataPathTest).insert(test_message_to_insert);
    const res = await new Query(Table.MESSAGES, dataPathTest)
      .filter(({ message_ID }) => message_ID === 'three')
      .results();
    expect(res).toEqual([test_message_to_insert]);
    await new Query(Table.MESSAGES, dataPathTest).filter(({ message_ID }) => message_ID === 'three').delete();
  });
  it('Validates proper deletion of a message', async () => {
    const res1 = await new Query(Table.MESSAGES, dataPathTest)
      .filter(({ message_ID }) => message_ID === 'two')
      .delete();
    const res2 = await new Query(Table.MESSAGES, dataPathTest)
      .filter(({ message_ID }) => message_ID === 'two')
      .results();
    expect(res1).toEqual([test_message2]);
    expect(res2).toEqual([]);
    await new Query(Table.MESSAGES, dataPathTest).insert(test_message2);
  });
  it('Ensures graceful handling of deleting a non-existent message', async () => {
    const res = await new Query(Table.MESSAGES, dataPathTest)
      .filter(({ message_ID }) => message_ID === 'three')
      .delete();
    expect(res).toEqual([]);
  });
  it('Validates error handling for insterting a message with a non-unique ID', async () => {
    await expect(() => new Query(Table.MESSAGES, dataPathTest).insert(test_message_sameID)).rejects.toThrowError(
      'Primary ID already exists.',
    );
  });
  it('Tests and validates the update operation for a message', async () => {
    await new Query(Table.MESSAGES, dataPathTest).insert(test_message_to_insert);
    const res2 = await new Query(Table.MESSAGES, dataPathTest)
      .filter(({ message_ID }) => message_ID === 'three')
      .update((entry) => (entry.message = 'The message is changed'));
    const res3 = await new Query(Table.MESSAGES, dataPathTest)
      .filter(({ message_ID }) => message_ID === 'three')
      .results();
    expect(res2[0]?.message).toEqual('The message is changed');
    expect(res3[0]?.message).toEqual('The message is changed');
    await new Query(Table.MESSAGES, dataPathTest).filter(({ message_ID }) => message_ID === 'three').delete();
  });
  it("Ensures robustness in handling attempts to modify a message's ID", async () => {
    await expect(() =>
      new Query(Table.MESSAGES, dataPathTest)
        .filter(({ message_ID }) => message_ID === 'one')
        .update((entry) => (entry.message_ID = 'four')),
    ).rejects.toThrowError('Updated the primary key of some elements.');
  });
  it('Validates batch update of messages for consistency', async () => {
    await new Query(Table.MESSAGES, dataPathTest)
      .filter(({ channel_ID }) => channel_ID === '1')
      .update((entry) => (entry.message = 'Two messages has been changed'));
    const res3 = await new Query(Table.MESSAGES, dataPathTest).filter(({ channel_ID }) => channel_ID === '1').results();
    expect(res3[0]?.message).toEqual('Two messages has been changed');
    await new Query(Table.MESSAGES, dataPathTest)
      .filter(({ message_ID }) => message_ID === 'one')
      .update((entry) => (entry.message = 'Hello world'));
    await new Query(Table.MESSAGES, dataPathTest)
      .filter(({ message_ID }) => message_ID === 'two')
      .update((entry) => (entry.message = 'Goodbye world'));
  });
  it('Verifies proper handling of attemted modification of all channeld IDs', async () => {
    await expect(() =>
      new Query(Table.CHANNELS, dataPathTest).update((entry) => (entry.channel_ID = '4')),
    ).rejects.toThrowError('Updated the primary key of some elements.');
  });
  it('Test and validates the update operation for a channel name', async () => {
    const res2 = await new Query(Table.CHANNELS, dataPathTest)
      .filter(({ channel_ID }) => channel_ID === '1')
      .update((entry) => (entry.name = 'The channel name is changed'));
    const res3 = await new Query(Table.CHANNELS, dataPathTest).filter(({ channel_ID }) => channel_ID === '1').results();
    expect(res2[0]?.name).toEqual('The channel name is changed');
    expect(res3[0]?.name).toEqual('The channel name is changed');
    await new Query(Table.CHANNELS, dataPathTest)
      .filter(({ channel_ID }) => channel_ID === '1')
      .update((entry) => (entry.name = 'Database'));
  });
  it('Verifies that the friendship is broken when a friend is deleted', async () => {
    await new Query(Table.USERS, dataPathTest).filter(({ email_ID }) => email_ID === test_user1.email_ID).delete();
    const res = await new Query(Table.USERS, dataPathTest)
      .filter(({ email_ID }) => email_ID === test_user2.email_ID)
      .results();
    expect(res[0]?.friends).toEqual([]);
    await new Query(Table.USERS, dataPathTest).insert(test_user1_no_friends);
    await makeFriends(test_user1_no_friends.email_ID, test_user2.email_ID, dataPathTest);
  });
  it('Checks if the databasefiles and directory are made when files do not exist', async () => {
    const notExisingPath = 'assets/notExisting/';
    await new Query(Table.USERS, notExisingPath).insert(test_user1_no_friends);
    const result = await access(notExisingPath);
    expect(result).toEqual(undefined);
    await rmdir(notExisingPath, { recursive: true });
  });
});
