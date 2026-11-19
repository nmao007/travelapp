import 'react-native-url-polyfill/auto';
import { randomUUID } from 'expo-crypto';

// The shared trip logic calls crypto.randomUUID(), which Hermes doesn't provide.
const globalCrypto = (globalThis as { crypto?: Partial<Crypto> }).crypto ?? {};
if (!globalCrypto.randomUUID) {
  globalCrypto.randomUUID = randomUUID as Crypto['randomUUID'];
  (globalThis as { crypto?: Partial<Crypto> }).crypto = globalCrypto;
}

// itinerary-model.js snapshots removed plans with structuredClone for undo.
const scope = globalThis as { structuredClone?: <T>(value: T) => T };
scope.structuredClone ||= <T,>(value: T): T => JSON.parse(JSON.stringify(value));
