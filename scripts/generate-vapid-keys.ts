/**
 * Prints a fresh VAPID key pair for Web Push (ADR-0047).
 *
 * Run once per deployment and keep the pair stable afterwards: the public key
 * is baked into every subscription a browser has already created, so rotating
 * it silently invalidates all of them and every existing device stops receiving
 * pushes until it re-subscribes.
 *
 * The private key is a credential. It belongs in the deployment's environment,
 * never in the repository.
 *
 *   pnpm push:vapid:generate
 */
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log(`
Add these to your environment (and to Vercel), then redeploy:

NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}
VAPID_PRIVATE_KEY=${privateKey}
VAPID_SUBJECT=mailto:you@example.com

VAPID_SUBJECT must be a mailto: or https: URL that a push service can use to
contact whoever runs this deployment. Keep the private key out of Git.
`);
