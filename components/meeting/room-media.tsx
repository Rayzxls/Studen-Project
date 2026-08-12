/**
 * What the stage knows about everyone's audio, in our own user ids.
 *
 * Two of these are LiveKit's own facts and one is not. Speaking and a muted
 * microphone travel with the participant automatically; **deafening happens
 * inside a single browser** and reaches the room only because the stage
 * publishes it as an attribute. Without that the roster could show who has
 * stopped talking but never who has stopped listening.
 */
export interface RoomMediaState {
  speaking: readonly string[];
  micOff: readonly string[];
  deafened: readonly string[];
}

export const NO_MEDIA_STATE: RoomMediaState = {
  speaking: [],
  micOff: [],
  deafened: [],
};
