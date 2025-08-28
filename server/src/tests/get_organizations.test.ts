import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { organizationsTable } from '../db/schema';
import { type CreateOrganizationInput } from '../schema';
import { getOrganizations } from '../handlers/get_organizations';
import { eq } from 'drizzle-orm';

// Test organization data
const testOrganizations: CreateOrganizationInput[] = [
  {
    name: 'Test Organization 1',
    slug: 'test-org-1',
    subscription_tier: 'free'
  },
  {
    name: 'Test Organization 2', 
    slug: 'test-org-2',
    subscription_tier: 'pro'
  },
  {
    name: 'Test Organization 3',
    slug: 'test-org-3',
    subscription_tier: 'starter'
  }
];

describe('getOrganizations', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no organizations exist', async () => {
    const result = await getOrganizations();
    
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('should return all active organizations', async () => {
    // Create test organizations
    for (const org of testOrganizations) {
      await db.insert(organizationsTable)
        .values({
          name: org.name,
          slug: org.slug,
          subscription_tier: org.subscription_tier
        })
        .execute();
    }

    const result = await getOrganizations();

    expect(result).toHaveLength(3);
    expect(result[0].name).toEqual('Test Organization 1');
    expect(result[0].slug).toEqual('test-org-1');
    expect(result[0].subscription_tier).toEqual('free');
    expect(result[0].is_active).toBe(true);
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);

    expect(result[1].name).toEqual('Test Organization 2');
    expect(result[1].subscription_tier).toEqual('pro');
    
    expect(result[2].name).toEqual('Test Organization 3');
    expect(result[2].subscription_tier).toEqual('starter');
  });

  it('should only return active organizations', async () => {
    // Create active organization
    await db.insert(organizationsTable)
      .values({
        name: 'Active Organization',
        slug: 'active-org',
        subscription_tier: 'free',
        is_active: true
      })
      .execute();

    // Create inactive organization
    await db.insert(organizationsTable)
      .values({
        name: 'Inactive Organization', 
        slug: 'inactive-org',
        subscription_tier: 'pro',
        is_active: false
      })
      .execute();

    const result = await getOrganizations();

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Active Organization');
    expect(result[0].is_active).toBe(true);
  });

  it('should maintain data integrity in database', async () => {
    const testOrg = testOrganizations[0];
    
    // Create organization via direct DB insert
    const insertResult = await db.insert(organizationsTable)
      .values({
        name: testOrg.name,
        slug: testOrg.slug,
        subscription_tier: testOrg.subscription_tier
      })
      .returning()
      .execute();

    // Fetch via handler
    const handlerResult = await getOrganizations();

    // Verify via direct DB query
    const dbResult = await db.select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, insertResult[0].id))
      .execute();

    expect(handlerResult).toHaveLength(1);
    expect(dbResult).toHaveLength(1);
    expect(handlerResult[0].id).toEqual(insertResult[0].id);
    expect(handlerResult[0].name).toEqual(dbResult[0].name);
    expect(handlerResult[0].slug).toEqual(dbResult[0].slug);
    expect(handlerResult[0].subscription_tier).toEqual(dbResult[0].subscription_tier);
  });

  it('should handle different subscription tiers correctly', async () => {
    // Create organizations with all subscription tiers
    const subscriptionTiers = ['free', 'starter', 'pro', 'enterprise'] as const;
    
    for (const tier of subscriptionTiers) {
      await db.insert(organizationsTable)
        .values({
          name: `${tier} Organization`,
          slug: `${tier}-org`,
          subscription_tier: tier
        })
        .execute();
    }

    const result = await getOrganizations();

    expect(result).toHaveLength(4);
    
    const tierCounts = result.reduce((acc, org) => {
      acc[org.subscription_tier] = (acc[org.subscription_tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    expect(tierCounts['free']).toBe(1);
    expect(tierCounts['starter']).toBe(1);
    expect(tierCounts['pro']).toBe(1);
    expect(tierCounts['enterprise']).toBe(1);
  });
});