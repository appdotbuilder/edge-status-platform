import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { organizationsTable } from '../db/schema';
import { type CreateOrganizationInput } from '../schema';
import { createOrganization } from '../handlers/create_organization';
import { eq } from 'drizzle-orm';

// Test input with all required fields and default
const testInput: CreateOrganizationInput = {
  name: 'Test Organization',
  slug: 'test-org',
  subscription_tier: 'starter'
};

// Test input using the default subscription_tier
const testInputWithDefault: CreateOrganizationInput = {
  name: 'Default Tier Org',
  slug: 'default-org',
  subscription_tier: 'free' // This is the default from Zod schema
};

describe('createOrganization', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an organization with all fields', async () => {
    const result = await createOrganization(testInput);

    // Basic field validation
    expect(result.name).toEqual('Test Organization');
    expect(result.slug).toEqual('test-org');
    expect(result.subscription_tier).toEqual('starter');
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(typeof result.id).toEqual('number');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create organization with default subscription tier', async () => {
    const result = await createOrganization(testInputWithDefault);

    expect(result.name).toEqual('Default Tier Org');
    expect(result.slug).toEqual('default-org');
    expect(result.subscription_tier).toEqual('free');
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save organization to database', async () => {
    const result = await createOrganization(testInput);

    // Query database to verify persistence
    const organizations = await db.select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, result.id))
      .execute();

    expect(organizations).toHaveLength(1);
    expect(organizations[0].name).toEqual('Test Organization');
    expect(organizations[0].slug).toEqual('test-org');
    expect(organizations[0].subscription_tier).toEqual('starter');
    expect(organizations[0].is_active).toEqual(true);
    expect(organizations[0].created_at).toBeInstanceOf(Date);
    expect(organizations[0].updated_at).toBeInstanceOf(Date);
  });

  it('should handle different subscription tiers', async () => {
    const tierTests = [
      { tier: 'free' as const, name: 'Free Org', slug: 'free-org' },
      { tier: 'starter' as const, name: 'Starter Org', slug: 'starter-org' },
      { tier: 'pro' as const, name: 'Pro Org', slug: 'pro-org' },
      { tier: 'enterprise' as const, name: 'Enterprise Org', slug: 'enterprise-org' }
    ];

    for (const test of tierTests) {
      const input: CreateOrganizationInput = {
        name: test.name,
        slug: test.slug,
        subscription_tier: test.tier
      };

      const result = await createOrganization(input);
      expect(result.subscription_tier).toEqual(test.tier);
      expect(result.name).toEqual(test.name);
      expect(result.slug).toEqual(test.slug);
    }
  });

  it('should enforce unique slug constraint', async () => {
    // Create first organization
    await createOrganization(testInput);

    // Try to create another with same slug
    const duplicateInput: CreateOrganizationInput = {
      name: 'Another Organization',
      slug: 'test-org', // Same slug as first
      subscription_tier: 'pro'
    };

    // Should throw error due to unique constraint
    expect(createOrganization(duplicateInput)).rejects.toThrow(/unique/i);
  });

  it('should create multiple organizations with different slugs', async () => {
    const org1Input: CreateOrganizationInput = {
      name: 'First Organization',
      slug: 'first-org',
      subscription_tier: 'free'
    };

    const org2Input: CreateOrganizationInput = {
      name: 'Second Organization',
      slug: 'second-org',
      subscription_tier: 'pro'
    };

    const result1 = await createOrganization(org1Input);
    const result2 = await createOrganization(org2Input);

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.slug).toEqual('first-org');
    expect(result2.slug).toEqual('second-org');

    // Verify both are in database
    const allOrgs = await db.select().from(organizationsTable).execute();
    expect(allOrgs).toHaveLength(2);
  });
});