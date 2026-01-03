/**
 * Local Currencies (Community) Layer Tests
 *
 * Tests for community boundaries and fees.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CommunityRegistry } from './local.js';
import { Wallet } from '../core/types.js';
import { createTestUnit } from '../test-utils.js';

describe('CommunityRegistry', () => {
  let registry: CommunityRegistry;

  beforeEach(() => {
    registry = new CommunityRegistry();
  });

  // =========================================================================
  // CREATE COMMUNITY
  // =========================================================================
  describe('createCommunity', () => {
    it('creates community with specified name', () => {
      const community = registry.createCommunity({
        name: 'Village',
        boundaryFee: 0.03,
      });

      expect(community.name).toBe('Village');
    });

    it('creates community with specified boundary fee', () => {
      const community = registry.createCommunity({
        name: 'Village',
        boundaryFee: 0.05,
      });

      expect(community.boundaryFee).toBe(0.05);
    });

    it('generates unique ID', () => {
      const c1 = registry.createCommunity({ name: 'A', boundaryFee: 0.01 });
      const c2 = registry.createCommunity({ name: 'B', boundaryFee: 0.01 });

      expect(c1.id).not.toBe(c2.id);
    });

    it('initializes memberCount to 0', () => {
      const community = registry.createCommunity({
        name: 'Village',
        boundaryFee: 0.03,
      });

      expect(community.memberCount).toBe(0);
    });

    it('throws for boundary fee < 0', () => {
      expect(() =>
        registry.createCommunity({ name: 'Bad', boundaryFee: -0.1 })
      ).toThrow('between 0 and 1');
    });

    it('throws for boundary fee > 1', () => {
      expect(() =>
        registry.createCommunity({ name: 'Bad', boundaryFee: 1.5 })
      ).toThrow('between 0 and 1');
    });

    it('allows boundary fee of 0', () => {
      const community = registry.createCommunity({
        name: 'Free',
        boundaryFee: 0,
      });
      expect(community.boundaryFee).toBe(0);
    });

    it('allows boundary fee of 1', () => {
      const community = registry.createCommunity({
        name: 'Closed',
        boundaryFee: 1,
      });
      expect(community.boundaryFee).toBe(1);
    });
  });

  // =========================================================================
  // GET COMMUNITY
  // =========================================================================
  describe('getCommunity', () => {
    it('returns community by ID', () => {
      const created = registry.createCommunity({
        name: 'Village',
        boundaryFee: 0.03,
      });
      const found = registry.getCommunity(created.id);

      expect(found).toEqual(created);
    });

    it('returns undefined for unknown ID', () => {
      expect(registry.getCommunity('unknown')).toBeUndefined();
    });
  });

  describe('getCommunityByName', () => {
    it('finds community by exact name', () => {
      registry.createCommunity({ name: 'Village', boundaryFee: 0.03 });
      const found = registry.getCommunityByName('Village');

      expect(found?.name).toBe('Village');
    });

    it('finds community case-insensitively', () => {
      registry.createCommunity({ name: 'Village', boundaryFee: 0.03 });
      const found = registry.getCommunityByName('village');

      expect(found?.name).toBe('Village');
    });

    it('returns undefined for unknown name', () => {
      expect(registry.getCommunityByName('Unknown')).toBeUndefined();
    });
  });

  // =========================================================================
  // MEMBER COUNT
  // =========================================================================
  describe('member management', () => {
    it('addMember increments count', () => {
      const community = registry.createCommunity({
        name: 'Village',
        boundaryFee: 0.03,
      });

      registry.addMember(community.id);
      expect(registry.getCommunity(community.id)?.memberCount).toBe(1);

      registry.addMember(community.id);
      expect(registry.getCommunity(community.id)?.memberCount).toBe(2);
    });

    it('removeMember decrements count', () => {
      const community = registry.createCommunity({
        name: 'Village',
        boundaryFee: 0.03,
      });

      registry.addMember(community.id);
      registry.addMember(community.id);
      registry.removeMember(community.id);

      expect(registry.getCommunity(community.id)?.memberCount).toBe(1);
    });

    it('removeMember does not go below 0', () => {
      const community = registry.createCommunity({
        name: 'Village',
        boundaryFee: 0.03,
      });

      registry.removeMember(community.id);
      expect(registry.getCommunity(community.id)?.memberCount).toBe(0);
    });
  });

  // =========================================================================
  // UPDATE COMMUNITY
  // =========================================================================
  describe('updateCommunity', () => {
    it('updates name', () => {
      const community = registry.createCommunity({
        name: 'Old Name',
        boundaryFee: 0.03,
      });

      registry.updateCommunity(community.id, { name: 'New Name' });
      expect(registry.getCommunity(community.id)?.name).toBe('New Name');
    });

    it('updates boundary fee', () => {
      const community = registry.createCommunity({
        name: 'Village',
        boundaryFee: 0.03,
      });

      registry.updateCommunity(community.id, { boundaryFee: 0.05 });
      expect(registry.getCommunity(community.id)?.boundaryFee).toBe(0.05);
    });

    it('throws for unknown community', () => {
      expect(() =>
        registry.updateCommunity('unknown', { name: 'Test' })
      ).toThrow('not found');
    });

    it('throws for invalid boundary fee', () => {
      const community = registry.createCommunity({
        name: 'Village',
        boundaryFee: 0.03,
      });

      expect(() =>
        registry.updateCommunity(community.id, { boundaryFee: 1.5 })
      ).toThrow('between 0 and 1');
    });
  });

  // =========================================================================
  // CAN SPEND IN COMMUNITY
  // =========================================================================
  describe('canSpendInCommunity', () => {
    it('global money can spend anywhere', () => {
      const community = registry.createCommunity({
        name: 'Village',
        boundaryFee: 0.03,
      });
      const unit = createTestUnit({ locality: new Set() }); // Global

      expect(registry.canSpendInCommunity(unit, community.id)).toBe(true);
    });

    it('local money can spend in its community', () => {
      const community = registry.createCommunity({
        name: 'Village',
        boundaryFee: 0.03,
      });
      const unit = createTestUnit({ locality: new Set([community.id]) });

      expect(registry.canSpendInCommunity(unit, community.id)).toBe(true);
    });

    it('local money cannot spend outside its community', () => {
      const community1 = registry.createCommunity({
        name: 'Village 1',
        boundaryFee: 0.03,
      });
      const community2 = registry.createCommunity({
        name: 'Village 2',
        boundaryFee: 0.03,
      });
      const unit = createTestUnit({ locality: new Set([community1.id]) });

      expect(registry.canSpendInCommunity(unit, community2.id)).toBe(false);
    });
  });

  // =========================================================================
  // EFFECTIVE VALUE OUTSIDE
  // =========================================================================
  describe('effectiveValueOutside', () => {
    it('global money has full value everywhere', () => {
      const unit = createTestUnit({ magnitude: 100, locality: new Set() });

      expect(registry.effectiveValueOutside(unit)).toBe(100);
    });

    it('local money has full value in its community', () => {
      const community = registry.createCommunity({
        name: 'Village',
        boundaryFee: 0.05,
      });
      const unit = createTestUnit({
        magnitude: 100,
        locality: new Set([community.id]),
      });

      expect(registry.effectiveValueOutside(unit, community.id)).toBe(100);
    });

    it('local money loses boundary fee outside', () => {
      const community = registry.createCommunity({
        name: 'Village',
        boundaryFee: 0.05, // 5%
      });
      const unit = createTestUnit({
        magnitude: 100,
        locality: new Set([community.id]),
      });

      const value = registry.effectiveValueOutside(unit);
      expect(value).toBeCloseTo(95, 4); // 100 * (1 - 0.05)
    });

    it('compounds fees for multiple communities', () => {
      const c1 = registry.createCommunity({
        name: 'Village 1',
        boundaryFee: 0.03,
      });
      const c2 = registry.createCommunity({
        name: 'Village 2',
        boundaryFee: 0.05,
      });
      const unit = createTestUnit({
        magnitude: 100,
        locality: new Set([c1.id, c2.id]),
      });

      const value = registry.effectiveValueOutside(unit);
      // 100 * (1-0.03) * (1-0.05) = 100 * 0.97 * 0.95 = 92.15
      expect(value).toBeCloseTo(92.15, 4);
    });
  });

  // =========================================================================
  // EXPORT/IMPORT
  // =========================================================================
  describe('export/import', () => {
    it('exports all communities', () => {
      registry.createCommunity({ name: 'A', boundaryFee: 0.01 });
      registry.createCommunity({ name: 'B', boundaryFee: 0.02 });

      const exported = registry.export();
      expect(exported.size).toBe(2);
    });

    it('imports communities correctly', () => {
      const c1 = registry.createCommunity({ name: 'A', boundaryFee: 0.01 });

      const newRegistry = new CommunityRegistry();
      newRegistry.import(registry.export());

      expect(newRegistry.getCommunity(c1.id)?.name).toBe('A');
    });
  });
});
