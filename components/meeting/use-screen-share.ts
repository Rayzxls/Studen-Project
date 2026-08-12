"use client";

import { useCallback, useState } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { createLocalScreenTracks, Track } from "livekit-client";
import type { LocalTrack } from "livekit-client";

/**
 * Starting, stopping and swapping the shared screen (ADR-0053).
 *
 * A hook rather than state inside the button, because two places need the same
 * share: the control on the teacher's own strip, and the bar that follows them
 * around the page while a share is running. Two copies of this state would
 * disagree the moment either one acted.
 */

/**
 * The picker itself belongs to the browser. No page can draw, restyle or skip
 * it — it is the permission gate for screen capture, and a site that could fake
 * it could take a screen without asking. What a page *can* do is shape the
 * choices inside it, which is all of this.
 */
export const SCREEN_SHARE_OPTIONS = {
  audio: true,
  /** Sharing this tab is the hall-of-mirrors mistake, never the intent. */
  selfBrowserSurface: "exclude",
  /** Chrome's own "share this tab instead" control, for free. */
  surfaceSwitching: "include",
  /** A video played to the class should carry its sound. */
  systemAudio: "include",
  /** Slides and documents: keep the bitrate on legible text, not frame rate. */
  contentHint: "detail",
} as const;

export interface ScreenShare {
  sharing: boolean;
  pending: boolean;
  /** The last attempt did not happen — most often a dismissed picker. */
  failed: boolean;
  toggle: () => void;
  /** Change what is being shared without the class losing the picture. */
  switchSource: () => void;
}

function stopAll(tracks: LocalTrack[]): void {
  for (const track of tracks) track.stop();
}

export function useScreenShare(): ScreenShare {
  const { localParticipant } = useLocalParticipant();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const sharing = localParticipant.isScreenShareEnabled;

  const toggle = useCallback(() => {
    void (async () => {
      setPending(true);
      setFailed(false);
      try {
        await localParticipant.setScreenShareEnabled(
          !sharing,
          SCREEN_SHARE_OPTIONS
        );
      } catch {
        // Includes the ordinary case of dismissing the browser's own picker,
        // which is not worth an alarming message.
        setFailed(true);
      } finally {
        setPending(false);
      }
    })();
  }, [localParticipant, sharing]);

  const switchSource = useCallback(() => {
    void (async () => {
      setPending(true);
      setFailed(false);
      try {
        // The picker opens before anything is torn down, so changing your mind
        // costs nothing: dismissing it leaves the running share exactly as it
        // was. Stopping first would punish a cancelled dialog by dropping the
        // class's picture for no reason.
        const next = await createLocalScreenTracks(SCREEN_SHARE_OPTIONS);
        const video = next.find((track) => track.kind === Track.Kind.Video);
        const current = localParticipant.getTrackPublication(
          Track.Source.ScreenShare
        )?.videoTrack;

        if (!video || !current) {
          // Nothing to swap into. Release what the picker just opened rather
          // than leaving a capture running with nowhere to go.
          stopAll(next);
          setFailed(true);
          return;
        }

        // Replacing the media rather than republishing is what makes this
        // seamless: subscribers never see the share stop and start, the
        // picture simply becomes the other thing.
        const previous = current.mediaStreamTrack;
        await current.replaceTrack(video.mediaStreamTrack, {
          userProvidedTrack: false,
        });
        // The old capture goes on running otherwise, and the browser goes on
        // saying this tab is sharing a surface it no longer is.
        previous.stop();

        // Screen-share audio can only follow if both the old share and the new
        // one have it. Gaining audio where there was none needs a republish,
        // and interrupting a live class to add sound is the worse trade — so
        // the picture switches and the audio stays as it was.
        const audio = next.find((track) => track.kind === Track.Kind.Audio);
        const currentAudio = localParticipant.getTrackPublication(
          Track.Source.ScreenShareAudio
        )?.audioTrack;
        if (audio && currentAudio) {
          const previousAudio = currentAudio.mediaStreamTrack;
          await currentAudio.replaceTrack(audio.mediaStreamTrack, {
            userProvidedTrack: false,
          });
          previousAudio.stop();
        } else if (audio) {
          audio.stop();
        }
      } catch {
        setFailed(true);
      } finally {
        setPending(false);
      }
    })();
  }, [localParticipant]);

  return { sharing, pending, failed, toggle, switchSource };
}
