This file contains error codes the server might return.

| Code | Type                                    | Meaning                                                          |
| ---- | --------------------------------------- | ---------------------------------------------------------------- |
| 0    | Internal error                          | Something went wrong in server code, error 0 should never occur  |
| 1    | Parsing error                           | The server wasn't able to parse the sent data as a known command |
| 2    | Missing permissions error               | You don't have the permissions to perform the sent request       |
| 101  | Login error                             | Given user password is incorrect                                 |
| 102  | Login error                             | No such user is known in the database                            |
| 103  | Signup error                            | Already existing user with that ID/Email                         |
| 204  | Channel lookup error                    | No messages in channel                                           |
| 404  | Channel join/leave/lookup/history error | Channel does not exist                                           |
| 405  | Channel join/lookup/history error       | User attempting to access a channel they are not a member of     |
| 407  | Channel leave error                     | User attempting to leave a channel they are not a member of      |
| 500  | Database insertion error                | Failed to insert message into the database                       |
