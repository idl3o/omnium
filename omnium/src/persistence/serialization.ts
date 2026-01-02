/**
 * OMNIUM Serialization Utilities
 *
 * Converts between runtime types (with Sets) and serializable types (with Arrays).
 * Essential for JSON-based persistence in Helia.
 */

import type {
  OmniumUnit,
  Wallet,
  PurposeChannel,
  TemporalStratum,
} from '../core/types.js';
import type {
  SerializedOmniumUnit,
  SerializedWallet,
  SerializedPurposeChannel,
} from './types.js';

// =============================================================================
// OMNIUM UNIT SERIALIZATION
// =============================================================================

/**
 * Serialize an OmniumUnit for storage.
 * Converts Sets to Arrays.
 */
export function serializeUnit(unit: OmniumUnit): SerializedOmniumUnit {
  return {
    id: unit.id,
    magnitude: unit.magnitude,
    temporality: unit.temporality,
    locality: Array.from(unit.locality),
    purpose: Array.from(unit.purpose),
    provenance: unit.provenance,
    createdAt: unit.createdAt,
    lastTickAt: unit.lastTickAt,
    walletId: unit.walletId,
  };
}

/**
 * Deserialize an OmniumUnit from storage.
 * Converts Arrays back to Sets.
 */
export function deserializeUnit(data: SerializedOmniumUnit): OmniumUnit {
  return {
    id: data.id,
    magnitude: data.magnitude,
    temporality: data.temporality as TemporalStratum,
    locality: new Set(data.locality),
    purpose: new Set(data.purpose),
    provenance: data.provenance,
    createdAt: data.createdAt,
    lastTickAt: data.lastTickAt,
    walletId: data.walletId,
  };
}

// =============================================================================
// WALLET SERIALIZATION
// =============================================================================

/**
 * Serialize a Wallet for storage.
 * Converts Sets to Arrays.
 */
export function serializeWallet(wallet: Wallet): SerializedWallet {
  return {
    id: wallet.id,
    name: wallet.name,
    createdAt: wallet.createdAt,
    communities: Array.from(wallet.communities),
    validPurposes: Array.from(wallet.validPurposes),
  };
}

/**
 * Deserialize a Wallet from storage.
 * Converts Arrays back to Sets.
 */
export function deserializeWallet(data: SerializedWallet): Wallet {
  return {
    id: data.id,
    name: data.name,
    createdAt: data.createdAt,
    communities: new Set(data.communities),
    validPurposes: new Set(data.validPurposes),
  };
}

// =============================================================================
// PURPOSE CHANNEL SERIALIZATION
// =============================================================================

/**
 * Serialize a PurposeChannel for storage.
 * Converts Set to Array.
 */
export function serializePurpose(purpose: PurposeChannel): SerializedPurposeChannel {
  return {
    id: purpose.id,
    name: purpose.name,
    description: purpose.description,
    validRecipients: Array.from(purpose.validRecipients),
    conversionDiscount: purpose.conversionDiscount,
    createdAt: purpose.createdAt,
  };
}

/**
 * Deserialize a PurposeChannel from storage.
 * Converts Array back to Set.
 */
export function deserializePurpose(data: SerializedPurposeChannel): PurposeChannel {
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    validRecipients: new Set(data.validRecipients),
    conversionDiscount: data.conversionDiscount,
    createdAt: data.createdAt,
  };
}

// =============================================================================
// BATCH SERIALIZATION
// =============================================================================

/**
 * Serialize an array of OmniumUnits.
 */
export function serializeUnits(units: OmniumUnit[]): SerializedOmniumUnit[] {
  return units.map(serializeUnit);
}

/**
 * Deserialize an array of OmniumUnits.
 */
export function deserializeUnits(data: SerializedOmniumUnit[]): OmniumUnit[] {
  return data.map(deserializeUnit);
}

/**
 * Serialize an array of Wallets.
 */
export function serializeWallets(wallets: Wallet[]): SerializedWallet[] {
  return wallets.map(serializeWallet);
}

/**
 * Deserialize an array of Wallets.
 */
export function deserializeWallets(data: SerializedWallet[]): Wallet[] {
  return data.map(deserializeWallet);
}

/**
 * Serialize an array of PurposeChannels.
 */
export function serializePurposes(purposes: PurposeChannel[]): SerializedPurposeChannel[] {
  return purposes.map(serializePurpose);
}

/**
 * Deserialize an array of PurposeChannels.
 */
export function deserializePurposes(data: SerializedPurposeChannel[]): PurposeChannel[] {
  return data.map(deserializePurpose);
}

// =============================================================================
// MAP UTILITIES
// =============================================================================

/**
 * Serialize a Map to an array of [key, value] pairs.
 */
export function serializeMap<K, V>(map: Map<K, V>): [K, V][] {
  return Array.from(map.entries());
}

/**
 * Deserialize an array of [key, value] pairs to a Map.
 */
export function deserializeMap<K, V>(entries: [K, V][]): Map<K, V> {
  return new Map(entries);
}

/**
 * Serialize a Map with serializable values directly to an object.
 */
export function mapToObject<V>(map: Map<string, V>): Record<string, V> {
  const obj: Record<string, V> = {};
  for (const [key, value] of map) {
    obj[key] = value;
  }
  return obj;
}

/**
 * Deserialize an object to a Map.
 */
export function objectToMap<V>(obj: Record<string, V>): Map<string, V> {
  return new Map(Object.entries(obj));
}
