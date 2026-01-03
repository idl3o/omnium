/**
 * Purpose Channels Layer Tests
 *
 * Tests for purpose restrictions, recipient validation, and discount calculations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PurposeRegistry, STANDARD_PURPOSES } from './purpose.js';
import { Wallet } from '../core/types.js';
import { createTestUnit } from '../test-utils.js';

describe('PurposeRegistry', () => {
  let registry: PurposeRegistry;

  beforeEach(() => {
    registry = new PurposeRegistry();
  });

  // =========================================================================
  // INITIALIZATION
  // =========================================================================
  describe('initialization', () => {
    it('includes standard purposes', () => {
      const purposes = registry.getAllPurposes();
      expect(purposes.length).toBe(Object.keys(STANDARD_PURPOSES).length);
    });

    it('has health purpose', () => {
      const health = registry.getPurpose('health');
      expect(health).toBeDefined();
      expect(health?.name).toBe('health');
    });

    it('has education purpose', () => {
      const education = registry.getPurpose('education');
      expect(education).toBeDefined();
    });

    it('standard purposes have correct discounts', () => {
      const health = registry.getPurpose('health');
      expect(health?.conversionDiscount).toBe(0.03);
    });
  });

  // =========================================================================
  // CREATE PURPOSE
  // =========================================================================
  describe('createPurpose', () => {
    it('creates purpose with specified name', () => {
      const purpose = registry.createPurpose({ name: 'custom' });
      expect(purpose.name).toBe('custom');
    });

    it('defaults to 3% conversion discount', () => {
      const purpose = registry.createPurpose({ name: 'custom' });
      expect(purpose.conversionDiscount).toBe(0.03);
    });

    it('uses provided discount', () => {
      const purpose = registry.createPurpose({
        name: 'custom',
        conversionDiscount: 0.1,
      });
      expect(purpose.conversionDiscount).toBe(0.1);
    });

    it('throws for discount < 0', () => {
      expect(() =>
        registry.createPurpose({ name: 'bad', conversionDiscount: -0.1 })
      ).toThrow('between 0 and 1');
    });

    it('throws for discount > 1', () => {
      expect(() =>
        registry.createPurpose({ name: 'bad', conversionDiscount: 1.5 })
      ).toThrow('between 0 and 1');
    });

    it('initializes with empty validRecipients', () => {
      const purpose = registry.createPurpose({ name: 'custom' });
      expect(purpose.validRecipients.size).toBe(0);
    });
  });

  // =========================================================================
  // GET PURPOSE
  // =========================================================================
  describe('getPurpose', () => {
    it('finds by ID', () => {
      const created = registry.createPurpose({ name: 'custom' });
      const found = registry.getPurpose(created.id);
      expect(found).toEqual(created);
    });

    it('finds by name', () => {
      registry.createPurpose({ name: 'mychannel' });
      const found = registry.getPurpose('mychannel');
      expect(found?.name).toBe('mychannel');
    });

    it('finds by name case-insensitively', () => {
      registry.createPurpose({ name: 'MyChannel' });
      const found = registry.getPurpose('mychannel');
      expect(found?.name).toBe('MyChannel');
    });

    it('returns undefined for unknown', () => {
      expect(registry.getPurpose('unknown')).toBeUndefined();
    });
  });

  // =========================================================================
  // RECIPIENT REGISTRATION
  // =========================================================================
  describe('recipient management', () => {
    it('registerRecipient adds wallet to validRecipients', () => {
      const purpose = registry.createPurpose({ name: 'custom' });
      registry.registerRecipient(purpose.id, 'wallet-1');

      expect(
        registry.getPurpose(purpose.id)?.validRecipients.has('wallet-1')
      ).toBe(true);
    });

    it('registerRecipient throws for unknown purpose', () => {
      expect(() =>
        registry.registerRecipient('unknown', 'wallet-1')
      ).toThrow('not found');
    });

    it('unregisterRecipient removes wallet', () => {
      const purpose = registry.createPurpose({ name: 'custom' });
      registry.registerRecipient(purpose.id, 'wallet-1');
      registry.unregisterRecipient(purpose.id, 'wallet-1');

      expect(
        registry.getPurpose(purpose.id)?.validRecipients.has('wallet-1')
      ).toBe(false);
    });

    it('registering same wallet twice is idempotent', () => {
      const purpose = registry.createPurpose({ name: 'custom' });
      registry.registerRecipient(purpose.id, 'wallet-1');
      registry.registerRecipient(purpose.id, 'wallet-1');

      expect(registry.getPurpose(purpose.id)?.validRecipients.size).toBe(1);
    });
  });

  // =========================================================================
  // CAN RECEIVE
  // =========================================================================
  describe('canReceive', () => {
    const createWallet = (id: string): Wallet => ({
      id,
      name: 'Test',
      createdAt: Date.now(),
      communities: new Set(),
      validPurposes: new Set(),
    });

    it('unrestricted money can go anywhere', () => {
      const wallet = createWallet('wallet-1');
      const unit = createTestUnit({ purpose: new Set() });

      const result = registry.canReceive(wallet, unit);
      expect(result.valid).toBe(true);
    });

    it('purpose money can go to registered wallet', () => {
      const purpose = registry.createPurpose({ name: 'custom' });
      registry.registerRecipient(purpose.id, 'wallet-1');

      const wallet = createWallet('wallet-1');
      const unit = createTestUnit({ purpose: new Set([purpose.id]) });

      const result = registry.canReceive(wallet, unit);
      expect(result.valid).toBe(true);
    });

    it('purpose money cannot go to unregistered wallet', () => {
      const purpose = registry.createPurpose({ name: 'custom' });
      // wallet-1 not registered

      const wallet = createWallet('wallet-1');
      const unit = createTestUnit({ purpose: new Set([purpose.id]) });

      const result = registry.canReceive(wallet, unit);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not registered');
    });

    it('rejects for unknown purpose ID', () => {
      const wallet = createWallet('wallet-1');
      const unit = createTestUnit({ purpose: new Set(['unknown-purpose']) });

      const result = registry.canReceive(wallet, unit);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Unknown purpose');
    });

    it('requires all purposes to be valid', () => {
      const purpose1 = registry.createPurpose({ name: 'p1' });
      const purpose2 = registry.createPurpose({ name: 'p2' });
      registry.registerRecipient(purpose1.id, 'wallet-1');
      // wallet-1 not registered for purpose2

      const wallet = createWallet('wallet-1');
      const unit = createTestUnit({
        purpose: new Set([purpose1.id, purpose2.id]),
      });

      const result = registry.canReceive(wallet, unit);
      expect(result.valid).toBe(false);
    });
  });

  // =========================================================================
  // TOTAL CONVERSION DISCOUNT
  // =========================================================================
  describe('totalConversionDiscount', () => {
    it('returns 0 for empty purposes', () => {
      const discount = registry.totalConversionDiscount(new Set());
      expect(discount).toBe(0);
    });

    it('returns single purpose discount', () => {
      const health = registry.getPurpose('health');
      const discount = registry.totalConversionDiscount(new Set([health!.id]));
      expect(discount).toBeCloseTo(0.03, 6);
    });

    it('compounds multiple discounts', () => {
      const p1 = registry.createPurpose({ name: 'p1', conversionDiscount: 0.03 });
      const p2 = registry.createPurpose({ name: 'p2', conversionDiscount: 0.05 });

      const discount = registry.totalConversionDiscount(new Set([p1.id, p2.id]));
      // 1 - (1-0.03) * (1-0.05) = 1 - 0.97 * 0.95 = 1 - 0.9215 = 0.0785
      expect(discount).toBeCloseTo(0.0785, 4);
    });

    it('ignores unknown purpose IDs', () => {
      const discount = registry.totalConversionDiscount(new Set(['unknown']));
      expect(discount).toBe(0);
    });
  });

  // =========================================================================
  // EXPORT/IMPORT
  // =========================================================================
  describe('export/import', () => {
    it('exports all purposes', () => {
      const exported = registry.export();
      expect(exported.size).toBeGreaterThan(0);
    });

    it('imports purposes correctly', () => {
      const custom = registry.createPurpose({ name: 'custom' });

      const newRegistry = new PurposeRegistry();
      // Clear the new registry first
      newRegistry.import(new Map());
      newRegistry.import(registry.export());

      expect(newRegistry.getPurpose(custom.id)?.name).toBe('custom');
    });
  });
});
