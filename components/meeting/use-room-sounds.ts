"use client";

import { useEffect, useRef } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent, Track } from "livekit-client";

import { playSound, type RoomSound } from "@/components/meeting/room-sounds";

/**
 * The sounds the whole room hears (ADR-0053).
 *
 * Nothing is transmitted. Every client watches the same room events and makes
 * its own noise locally, which is how a call application does this: sending
 * audio for a doorbell would cost bandwidth on a free tier measured in
 * participant-minutes, and would arrive late.
 *
 * The sounds that only you hear — your microphone, your ears — are not here.
 * They belong to the button that caused them, because they are the button
 * answering you rather than the room reporting something.
 */

/**
 * A reconnect buffers every event it missed and delivers them together, so a
 * dropped connection would otherwise come back as a burst of chimes. Ordinary
 * joining needs no such guard: LiveKit adds the people already in the room
 * while the state is still `Connecting`, and `emitWhenConnected` drops those,
 * so walking into a class of thirty is silent rather than thirty doorbells.
 */
const SETTLE_MS = 800;

/** Both local and remote publications carry a source; nothing else is read. */
interface SourcedPublication {
  source?: string;
}

export function useRoomSounds({ deafened }: { deafened: boolean }): void {
  const room = useRoomContext();
  // Read at fire time rather than resubscribing every time it flips.
  const deafenedRef = useRef(deafened);
  useEffect(() => {
    deafenedRef.current = deafened;
  });

  useEffect(() => {
    if (!room) return;

    let quietUntil = Date.now() + SETTLE_MS;
    const settle = () => {
      quietUntil = Date.now() + SETTLE_MS;
    };

    const roomSound = (sound: RoomSound) => {
      // Deafened means "I do not want to hear the room", and these are the
      // room. Your own controls still answer you.
      if (deafenedRef.current) return;
      if (Date.now() < quietUntil) return;
      playSound(sound);
    };

    const onJoin = () => roomSound("join");
    const onLeave = () => roomSound("leave");
    const onPublished = (publication: SourcedPublication) => {
      if (publication.source === Track.Source.ScreenShare) {
        roomSound("share-start");
      }
    };
    const onUnpublished = (publication: SourcedPublication) => {
      if (publication.source === Track.Source.ScreenShare) {
        roomSound("share-stop");
      }
    };

    room.on(RoomEvent.Connected, settle);
    room.on(RoomEvent.Reconnected, settle);
    room.on(RoomEvent.ParticipantConnected, onJoin);
    room.on(RoomEvent.ParticipantDisconnected, onLeave);
    room.on(RoomEvent.TrackPublished, onPublished);
    room.on(RoomEvent.TrackUnpublished, onUnpublished);
    // The person sharing hears it too — it is the room's event, not a report
    // about someone else.
    room.on(RoomEvent.LocalTrackPublished, onPublished);
    room.on(RoomEvent.LocalTrackUnpublished, onUnpublished);

    return () => {
      room.off(RoomEvent.Connected, settle);
      room.off(RoomEvent.Reconnected, settle);
      room.off(RoomEvent.ParticipantConnected, onJoin);
      room.off(RoomEvent.ParticipantDisconnected, onLeave);
      room.off(RoomEvent.TrackPublished, onPublished);
      room.off(RoomEvent.TrackUnpublished, onUnpublished);
      room.off(RoomEvent.LocalTrackPublished, onPublished);
      room.off(RoomEvent.LocalTrackUnpublished, onUnpublished);
    };
  }, [room]);
}
