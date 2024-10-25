This file contains (error) codes the server might return.

| Code | Type                                    | Meaning                                                               |
| ---- | --------------------------------------- | --------------------------------------------------------------------- |
| 0    | Internal error                          | Something went wrong in server code, error 0 should never occur       |
| 1    | Parsing error                           | The server wasn't able to parse the sent data as a known command      |
| 2    | Missing permissions error               | You don't have the permissions to perform the sent request            |
| 101  | Login error                             | Given user password is incorrect                                      |
| 102  | Login error                             | No such user is known in the database                                 |
| 103  | Signup error                            | Already existing user with that ID/Email                              |
| 204  | Channel lookup error                    | No messages in channel                                                |
| 404  | Channel join/leave/lookup/history error | Channel does not exist                                                |
| 405  | Channel join/lookup/history error       | User attempting to access a channel they are not a member of          |
| 407  | Channel leave error                     | User attempting to leave a channel they are not a member of           |
| 408  | Channel join error                      | User has no invites to this private channel                           |
| 409  | Channel join error                      | User has no invites to this direct message channel                    |
| 410  | Channel join error                      | Direct message channels already has 2 users                           |
| 411  | Channel join error                      | Invite to encrypted channel is missing encrypted secret               |
| 412  | Channel join error                      | The user that sent the invite doesn't have their public key published |
| 500  | Database insertion error                | Failed to insert message into the database                            |
| 501  | Database file saving error              | Failed to insert file into the database                               |
| 600  | User willingly closing ws connection    | User sent command to permanently delete its account                   |
| 601  | Delete user refused                     | Refused deleting a user                                               |
| 602  | Update nickname refused                 | Invalid nickname, has length less than 3 characters                   |
| 603  | Update nickname refused                 | User was not found in the database, error should never occur          |
| 700  | Request participants denied             | No such channel exists                                                |
| 701  | Request participants denied             | User has no permissions to this channel                               |
| 800  | File request error                      | User requested a file (hash) that is not present in the database      |
| 801  | File request faulty file                | The requested file was not successfully retrieved from the database   |
| 900  | Reject invite error                     | The client tried deleting an invite from a non-existing channel       |
| 901  | Accept invite error                     | Tried accepting an invite to a non-existing channel                   |
| 902  | Accept invite error                     | Tried accepting an invite to a public channel                         |
| 903  | Channel invite error                    | Invite to channel failed, channel does not exist in database          |
| 904  | Channel invite error                    | Invite to channel failed, recipient user does not exist in database   |
| 905  | Channel invite error                    | Invite to channel failed, channel of type public                      |
| 906  | Channel invite error                    | Invite to channel failed, sender of invite not part of channel        |
| 907  | Channel invite error                    | Invite to channel failed, recipient of invite already part of channel |
| 908  | Channel invite error                    | Invite to channel failed, recipient already is invited to channel     |
| 909  | Channel invite error                    | Invite to channel failed, no secret provided for encrypted channel    |
| 1000 | Update public key error                 | The key is in an invalid format                                       |
| 1001 | Request public key error                | The user does not exist                                               |
| 1002 | Request public key error                | The user does not have a public key published                         |
