import type { Channel, ChannelId } from '../protocol/proto.mjs';

/**
 * This class represents a repository to be used by the chat client, holding all channel related data, namely the current
 * active channel, the known available, the joined channels, and the open invites. This class is created to encapsulate this
 * data, and to create an easier interface to adjust the client's knowledge related to channels.
 */
export class ChannelRepository {
  /**
   * The current active channel. May be undefined (no active channel).
   */
  private activeChannel: Channel | undefined = undefined;
  /**
   * The current available channels. Split up among the public channels (received on a channel_list command), and the non-
   * public channels.
   */
  private availableChannels: { publicChannels: Channel[]; nonPublicChannels: Channel[] } = {
    publicChannels: [],
    nonPublicChannels: [],
  };
  /**
   * The current connected (or joined) channels.
   */
  private connectedChannels: Channel[] = [];
  /**
   * The current open channel invites.
   */
  private channelInvites: Channel[] = [];
  /**
   * The current channel secret, is undefined if the channel is not encrypted.
   */
  private currentSecret: Buffer | undefined = undefined;

  /**
   * Returns the current active channel.
   * @returns the current active channel
   */
  getActiveChannel(): Channel | undefined {
    return this.activeChannel;
  }

  /**
   * Returns an array of all currently available (joinable or connected) channels.
   * @returns an array of al currently available channels
   */
  getAllAvailableChannels(): Channel[] {
    // Concatenates the public and non-public channels
    return [...this.availableChannels.publicChannels, ...this.availableChannels.nonPublicChannels];
  }

  /**
   * Returns an array of the currently connected channels.
   * @returns array of the currently connected channels
   */
  getConnectedChannels(): Channel[] {
    return this.connectedChannels.slice();
  }

  /**
   * Returns an array of the current open channel invites.
   * @returns array containig current open channel invites
   */
  getChannelInvites(): Channel[] {
    return this.channelInvites.slice();
  }

  /**
   * Returns the secret of the current channel, undefined if the channel is not encrypted
   * @returns secret of the current channel
   */
  getCurrentSecret(): Buffer | undefined {
    return this.currentSecret;
  }

  /**
   * Sets the current active channel to the given channel. Does not perform any checks.
   * @param newActive The new active channel
   */
  setActiveChannel(newActive: Channel | undefined): void {
    this.activeChannel = newActive;
  }

  /**
   * Sets the available channels to the given channels. Does not perform any checks.
   * @param newChannels The new available channels
   */
  setAllChannels(newChannels: Channel[]): void {
    this.availableChannels = {
      publicChannels: [],
      nonPublicChannels: [],
    };
    newChannels.forEach((channel) => {
      this.addAvailableChannel(channel);
    });
  }

  /**
   * Sets the secret of the active channel
   * @param Buffer Secret of the active channel
   */
  setCurrentSecret(secret: Buffer) {
    this.currentSecret = secret;
  }

  /**
   * Clears the secret of the active channel
   */
  clearCurrentSecret() {
    this.currentSecret = undefined;
  }

  /**
   * Updates the available channels by removing the old public channels (which may no longer be available), and replacing them
   * with the given public channels.
   * @param newPublicChannels The new public channels
   */
  updatePublicChannels(newPublicChannels: Channel[]): void {
    this.availableChannels.publicChannels = [];
    newPublicChannels.forEach((channel) => {
      this.availableChannels.publicChannels.push(channel);
    });
  }

  /**
   * Adds a channel to the list of available channels.
   * @param newChannel The new channel to add to the list of available channels
   */
  addAvailableChannel(newChannel: Channel): void {
    if (newChannel.type === 'public') {
      this.availableChannels.publicChannels.push(newChannel);
    } else {
      this.availableChannels.nonPublicChannels.push(newChannel);
    }
  }

  /**
   * Removes the channel with the given ID from the available channels list.
   * @param oldChannelId The channel ID of the channel to delete
   * @returns The channel that was deleted, or undefined if none was deleted
   */
  removeAvailableChannel(oldChannelId: ChannelId): Channel | undefined {
    const actualOldChannel = this.getAllAvailableChannels().filter((channel) => channel.id === oldChannelId);
    const filteredConnected = this.getAllAvailableChannels().filter((channel) => channel.id !== oldChannelId);
    this.setAllChannels(filteredConnected);
    return actualOldChannel[0];
  }

  /**
   * Checks whether the given channel ID is present within the saved available channels
   * @param channelID The channel ID suspected to be in the available channels list
   * @returns true if and only if the channel ID is present in the saved available channels
   */
  containsAsAvailable(channelID: ChannelId): boolean {
    return this.getAllAvailableChannels().findIndex((channel) => channel.id === channelID) !== -1;
  }

  /**
   * Removes the channel with thegiven ID from the available channels list, if it is not a public list (eg. requires
   * an invitation).
   * @param oldChannelId The channel ID of the channel to delete
   * @returns The channel that was deleted, or undefined if none was deleted
   */
  removeAvailableChannelIfNotPublic(oldChannelId: ChannelId): Channel | undefined {
    const actualOldChannel = this.availableChannels.nonPublicChannels.filter((channel) => channel.id === oldChannelId);
    const filteredConnected = this.availableChannels.nonPublicChannels.filter((channel) => channel.id !== oldChannelId);
    this.availableChannels.nonPublicChannels = filteredConnected;
    return actualOldChannel[0];
  }

  /**
   * Sets the current connected channels to the given array of channels.
   * @param newConnectedChannels The new array of connected channels
   */
  setConnectedChannels(newConnectedChannels: Channel[]): void {
    this.connectedChannels = newConnectedChannels;
  }

  /**
   * Adds a channel to the current list of connected channels. Does not perform any checks.
   * @param newChannel The new connected channel
   */
  addConnectedChannel(newChannel: Channel): void {
    this.connectedChannels.push(newChannel);
  }

  /**
   * Removes the channel with the given ID from the connected list.
   * @param oldChannelId The channel ID of the channel to delete
   * @returns The channel that was deleted, or undefined if none was deleted
   */
  removeConnectedChannel(oldChannelId: ChannelId): Channel | undefined {
    const actualOldChannel = this.connectedChannels.filter((channel) => channel.id === oldChannelId);
    const filteredConnected = this.connectedChannels.filter((channel) => channel.id !== oldChannelId);
    this.connectedChannels = filteredConnected;
    return actualOldChannel[0];
  }

  /**
   * Sets the open channel invites to the given channel array.
   * @param channelInvites The new channel invites
   */
  setOpenInvites(channelInvites: Channel[]) {
    this.channelInvites = channelInvites;
  }
}
