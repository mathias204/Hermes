import { it, expect, describe } from 'vitest';
import { breakUpFriends, checkFriends, loadMessages, makeFriends, compareTime } from './queries.mjs';
import { Query } from './query-builder.mjs';
import { Table } from './table.mjs';
import { DateTime } from 'luxon';

const dataPathTest = 'assets/database-queries-testJSON/';

describe('Friend functions tests on data from a test database', () => {
  it('Checks correctly if two users are friends', async () => {
    expect(
      await checkFriends(
        'jonas.couwberghs@student.kuleuven.be',
        'pieter.vanderschueren1@student.kuleuven.be',
        dataPathTest,
      ),
    ).toEqual(true);
  });
  it('Removes a friendship correctly and in both ways', async () => {
    await breakUpFriends(
      'jonas.couwberghs@student.kuleuven.be',
      'pieter.vanderschueren1@student.kuleuven.be',
      dataPathTest,
    );
    expect(
      await checkFriends(
        'jonas.couwberghs@student.kuleuven.be',
        'pieter.vanderschueren1@student.kuleuven.be',
        dataPathTest,
      ),
    ).toEqual(false);
  });
  it('Adds a friendship correctly and in both ways', async () => {
    await makeFriends(
      'jonas.couwberghs@student.kuleuven.be',
      'pieter.vanderschueren1@student.kuleuven.be',
      dataPathTest,
    );
    expect(
      await checkFriends(
        'jonas.couwberghs@student.kuleuven.be',
        'pieter.vanderschueren1@student.kuleuven.be',
        dataPathTest,
      ),
    ).toEqual(true);
  });
});

describe('loadMessages tests on data from a test database.', () => {
  it('Gives the last messages from the specified channel', async () => {
    expect((await loadMessages('1', 1, dataPathTest))[0]).toEqual(
      (await new Query(Table.MESSAGES, dataPathTest).filter(({ message_ID }) => message_ID === '3').results())[0],
    );
  });
  it('Gives the correct message order', async () => {
    const messages = await loadMessages('1', 2, dataPathTest);
    const query_result = await new Query(Table.MESSAGES, dataPathTest)
      .filter(
        ({ sent_at_utc_timestamp }) =>
          DateTime.fromISO(sent_at_utc_timestamp) > DateTime.fromISO('2023-11-06T18:26:45.126Z'),
      )
      .results();
    query_result.sort((a, b) => compareTime(a, b));
    expect(messages).toEqual(query_result);
  });
});
