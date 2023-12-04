import { it, expect, describe } from 'vitest';
import { Query } from '../../database/query-builder.mjs';
import { Table } from '../../database/table.mjs';
import type { ChannelEntry, MessageEntry, UserEntry } from '../../database/database-interfaces.mjs';
import { DateTime } from 'luxon';
import { DatabaseCleanUp } from './database-cleanup.mjs';
import { breakUpFriends, makeFriends } from '../../database/queries.mjs';

const dataPathTest = 'assets/database-cleanup-testJSON/';
const databaseCleaner = new DatabaseCleanUp(dataPathTest);

const weekAgo = DateTime.utc().minus({ days: 7 }).toISO() as string;
const future = DateTime.utc().plus({ days: 1 }).toISO() as string;

const userAlmostDead: UserEntry = {
  email_ID: 'userAlmostDead@student.kuleuven.be',
  user_name: 'Mathias',
  last_seen_utc_timestamp: '2023-11-06T18:26:45.126Z',
  hashed_pass: '99ac8bf4bf76806c',
  channels: ['1', '3'],
  self_destruct_at_utc_timestamp: '2023-11-15T16:56:38.089Z',
  friends: [],
  destroy_warning: false,
};

const userAlmostDead2: UserEntry = {
  email_ID: 'userAlmostDead2@student.kuleuven.be',
  user_name: 'Mathias',
  last_seen_utc_timestamp: '2023-11-06T18:26:45.126Z',
  hashed_pass: '99ac8bf4bf76806c',
  channels: ['1', '3'],
  self_destruct_at_utc_timestamp: weekAgo,
  friends: [],
  destroy_warning: false,
};

const deadUser: UserEntry = {
  email_ID: 'deadUser@student.kuleuven.be',
  user_name: 'Mathias',
  last_seen_utc_timestamp: '2023-11-06T18:26:45.126Z',
  hashed_pass: '99ac8bf4bf76806c',
  channels: ['1', '3'],
  self_destruct_at_utc_timestamp: '2023-11-15T16:56:38.089Z',
  friends: [],
  destroy_warning: true,
};

const deadUser2: UserEntry = {
  email_ID: 'deadUser2@student.kuleuven.be',
  user_name: 'Mathias',
  last_seen_utc_timestamp: '2023-11-06T18:26:45.126Z',
  hashed_pass: '99ac8bf4bf76806c',
  channels: ['1', '3'],
  self_destruct_at_utc_timestamp: '2023-11-15T16:56:38.089Z',
  friends: [],
  destroy_warning: true,
};

const deadUser3: UserEntry = {
  email_ID: 'deadUser3@student.kuleuven.be',
  user_name: 'Mathias',
  last_seen_utc_timestamp: '2023-11-06T18:26:45.126Z',
  hashed_pass: '99ac8bf4bf76806c',
  channels: ['1', '3'],
  self_destruct_at_utc_timestamp: '2023-11-15T16:56:38.089Z',
  friends: [],
  destroy_warning: true,
};

const notDeadUser: UserEntry = {
  email_ID: 'notDeadUser@student.kuleuven.be',
  user_name: 'Mathias',
  last_seen_utc_timestamp: '2023-11-06T18:26:45.126Z',
  hashed_pass: '99ac8bf4bf76806c',
  channels: ['1', '3'],
  self_destruct_at_utc_timestamp: future,
  friends: [],
  destroy_warning: true,
};

const notDeadUserWithFriend: UserEntry = {
  email_ID: 'notDeadUser@student.kuleuven.be',
  user_name: 'Mathias',
  last_seen_utc_timestamp: '2023-11-06T18:26:45.126Z',
  hashed_pass: '99ac8bf4bf76806c',
  channels: ['1', '3'],
  self_destruct_at_utc_timestamp: future,
  friends: ['pieter.vanderschueren1@student.kuleuven.be'],
  destroy_warning: true,
};

const messageFromDeadUser: MessageEntry = {
  message_ID: '5',
  sender_ID: 'deadUser@student.kuleuven.be',
  channel_ID: '1',
  sent_at_utc_timestamp: '2023-11-06T18:26:45.126Z',
  message: 'I am dead',
};

const messageFromDeadUser2: MessageEntry = {
  message_ID: '6',
  sender_ID: 'deadUser2@student.kuleuven.be',
  channel_ID: '3',
  sent_at_utc_timestamp: '2023-11-06T18:26:45.126Z',
  message: 'I am dead',
};

const messageFromUser: MessageEntry = {
  message_ID: '7',
  sender_ID: 'notDeadUser@student.kuleuven.be',
  channel_ID: '3',
  sent_at_utc_timestamp: '2023-11-06T18:26:45.126Z',
  message: 'I am dead',
};

const channelDead: ChannelEntry = {
  channel_ID: '3',
  name: 'Dead',
};

describe('Database-cleanup tests', () => {
  it('Test for issuing a warning to a user one week prior to their data deletion.', async () => {
    await new Query(Table.USERS, dataPathTest).insert(userAlmostDead2);
    await databaseCleaner.handleUserStatusAndCleanup();
    const res = await new Query(Table.USERS, dataPathTest)
      .filter(({ email_ID }) => email_ID === userAlmostDead2.email_ID)
      .results();
    expect(DateTime.fromISO(res[0]?.self_destruct_at_utc_timestamp as string).startOf('day')).toEqual(
      DateTime.local().plus({ days: 7 }).startOf('day'),
    );
    expect(res[0]?.destroy_warning).toEqual(true);
    await new Query(Table.USERS, dataPathTest).filter(({ email_ID }) => email_ID === userAlmostDead2.email_ID).delete();
  });
  it('Test if user gets warning if account destruction date is in the past and user did not yet receive a warning', async () => {
    await new Query(Table.USERS, dataPathTest).insert(userAlmostDead);
    await databaseCleaner.handleUserStatusAndCleanup();
    const res = await new Query(Table.USERS, dataPathTest)
      .filter(({ email_ID }) => email_ID === userAlmostDead.email_ID)
      .results();
    expect(DateTime.fromISO(res[0]?.self_destruct_at_utc_timestamp as string).startOf('day')).toEqual(
      DateTime.local().plus({ days: 7 }).startOf('day'),
    );
    expect(res[0]?.destroy_warning).toEqual(true);
    await new Query(Table.USERS, dataPathTest).filter(({ email_ID }) => email_ID === userAlmostDead.email_ID).delete();
  });
  it('Test if the user gets deleted and their messages if they got a warning and the destruction date in in the past', async () => {
    await new Query(Table.USERS, dataPathTest).insert(deadUser);
    await new Query(Table.MESSAGES, dataPathTest).insert(messageFromDeadUser);
    await databaseCleaner.handleUserStatusAndCleanup();
    const resultUser = await new Query(Table.USERS, dataPathTest)
      .filter(({ email_ID }) => email_ID === deadUser.email_ID)
      .results();
    const resultMessage = await new Query(Table.MESSAGES, dataPathTest)
      .filter(({ message_ID }) => message_ID === messageFromDeadUser.message_ID)
      .results();
    const resultChannel = await new Query(Table.CHANNELS, dataPathTest)
      .filter(({ channel_ID }) => channel_ID === messageFromDeadUser.channel_ID)
      .results();
    expect(resultUser).toEqual([]);
    expect(resultMessage).toEqual([]);
    expect(resultChannel[0]?.channel_ID).toEqual(messageFromDeadUser.channel_ID);
  });
  it('Test if a channel gets deleted with no messages left and if all the information of the user gets deleted if they got a warning and the destruction date in in the past', async () => {
    await new Query(Table.USERS, dataPathTest).insert(deadUser2);
    await new Query(Table.MESSAGES, dataPathTest).insert(messageFromDeadUser2);
    await new Query(Table.CHANNELS, dataPathTest).insert(channelDead);
    await databaseCleaner.handleUserStatusAndCleanup();
    const resultUser = await new Query(Table.USERS, dataPathTest)
      .filter(({ email_ID }) => email_ID === deadUser2.email_ID)
      .results();
    const resultMessage = await new Query(Table.MESSAGES, dataPathTest)
      .filter(({ message_ID }) => message_ID === messageFromDeadUser2.message_ID)
      .results();
    const resultChannel = await new Query(Table.CHANNELS, dataPathTest)
      .filter(({ channel_ID }) => channel_ID === messageFromDeadUser2.channel_ID)
      .results();
    expect(resultUser).toEqual([]);
    expect(resultMessage).toEqual([]);
    expect(resultChannel).toEqual([]);
  });
  it('Test if the friendship gets removed if the user is deleted from database', async () => {
    const friend_ID = 'pieter.vanderschueren1@student.kuleuven.be';
    await new Query(Table.USERS, dataPathTest).insert(deadUser3);
    await makeFriends(deadUser3.email_ID, friend_ID, dataPathTest);
    await databaseCleaner.handleUserStatusAndCleanup();
    const resultUser = await new Query(Table.USERS, dataPathTest)
      .filter(({ email_ID }) => email_ID === deadUser3.email_ID)
      .results();
    const resultFriend = await new Query(Table.USERS, dataPathTest)
      .filter(({ email_ID }) => email_ID === friend_ID)
      .results();
    expect(resultUser).toEqual([]);
    expect(resultFriend[0]?.friends).toEqual(['jonas.couwberghs@student.kuleuven.be']);
  });
  it('Verifies there is no data deletion if the user got a warning but the destructiondate is not yet reached', async () => {
    const friend_ID = 'pieter.vanderschueren1@student.kuleuven.be';
    await new Query(Table.USERS, dataPathTest).insert(notDeadUser);
    await makeFriends(notDeadUser.email_ID, friend_ID, dataPathTest);
    await new Query(Table.MESSAGES, dataPathTest).insert(messageFromUser);
    await databaseCleaner.handleUserStatusAndCleanup();
    const resultUser = await new Query(Table.USERS, dataPathTest)
      .filter(({ email_ID }) => email_ID === notDeadUser.email_ID)
      .results();
    const resultMessage = await new Query(Table.MESSAGES, dataPathTest)
      .filter(({ message_ID }) => message_ID === messageFromUser.message_ID)
      .results();
    const resultFriend = await new Query(Table.USERS, dataPathTest)
      .filter(({ email_ID }) => email_ID === friend_ID)
      .results();
    expect(resultUser).toEqual([notDeadUserWithFriend]);
    expect(resultMessage).toEqual([messageFromUser]);
    expect(resultFriend[0]?.friends).toEqual(['jonas.couwberghs@student.kuleuven.be', notDeadUser.email_ID]);
    await breakUpFriends(notDeadUser.email_ID, friend_ID, dataPathTest);
    await new Query(Table.USERS, dataPathTest).filter(({ email_ID }) => email_ID === notDeadUser.email_ID).delete();
    await new Query(Table.MESSAGES, dataPathTest)
      .filter(({ message_ID }) => message_ID === messageFromUser.message_ID)
      .delete();
  });
});
