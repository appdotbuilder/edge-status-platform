import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { organizationsTable, statusPagesTable } from '../db/schema';
import { type CreateOrganizationInput, type CreateStatusPageInput } from '../schema';
import { getStatusPages } from '../handlers/get_status_pages';
import { eq } from 'drizzle-orm';

// Test data
const testOrganization1: CreateOrganizationInput = {
  name: 'Test Organization 1',
  slug: 'test-org-1',
  subscription_tier: 'pro'
};

const testOrganization2: CreateOrganizationInput = {
  name: 'Test Organization 2', 
  slug: 'test-org-2',
  subscription_tier: 'free'
};

describe('getStatusPages', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no status pages exist', async () => {
    const result = await getStatusPages();
    expect(result).toEqual([]);
  });

  it('should return all status pages when no organization filter is provided', async () => {
    // Create organizations first
    const [org1] = await db.insert(organizationsTable)
      .values(testOrganization1)
      .returning()
      .execute();

    const [org2] = await db.insert(organizationsTable)
      .values(testOrganization2)
      .returning()
      .execute();

    // Create status pages for both organizations
    const statusPage1: CreateStatusPageInput = {
      organization_id: org1.id,
      name: 'Main Status Page',
      description: 'Primary status page',
      is_public: true
    };

    const statusPage2: CreateStatusPageInput = {
      organization_id: org1.id,
      name: 'Internal Status Page',
      description: 'Internal monitoring',
      is_public: false
    };

    const statusPage3: CreateStatusPageInput = {
      organization_id: org2.id,
      name: 'Public Status',
      description: 'Public facing status',
      is_public: true
    };

    await db.insert(statusPagesTable)
      .values([statusPage1, statusPage2, statusPage3])
      .execute();

    const result = await getStatusPages();

    expect(result).toHaveLength(3);
    
    // Verify all status pages are returned
    const names = result.map(page => page.name).sort();
    expect(names).toEqual(['Internal Status Page', 'Main Status Page', 'Public Status']);
    
    // Verify data structure
    result.forEach(page => {
      expect(page.id).toBeDefined();
      expect(page.organization_id).toBeDefined();
      expect(page.name).toBeDefined();
      expect(typeof page.is_public).toBe('boolean');
      expect(page.created_at).toBeInstanceOf(Date);
      expect(page.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should return status pages for specific organization when filtered', async () => {
    // Create organizations
    const [org1] = await db.insert(organizationsTable)
      .values(testOrganization1)
      .returning()
      .execute();

    const [org2] = await db.insert(organizationsTable)
      .values(testOrganization2)
      .returning()
      .execute();

    // Create status pages
    const statusPage1: CreateStatusPageInput = {
      organization_id: org1.id,
      name: 'Org 1 Status Page',
      description: 'First organization status',
      is_public: true
    };

    const statusPage2: CreateStatusPageInput = {
      organization_id: org2.id,
      name: 'Org 2 Status Page',
      description: 'Second organization status', 
      is_public: true
    };

    await db.insert(statusPagesTable)
      .values([statusPage1, statusPage2])
      .execute();

    // Test filtering by organization 1
    const result1 = await getStatusPages(org1.id);
    expect(result1).toHaveLength(1);
    expect(result1[0].name).toBe('Org 1 Status Page');
    expect(result1[0].organization_id).toBe(org1.id);

    // Test filtering by organization 2
    const result2 = await getStatusPages(org2.id);
    expect(result2).toHaveLength(1);
    expect(result2[0].name).toBe('Org 2 Status Page');
    expect(result2[0].organization_id).toBe(org2.id);
  });

  it('should return empty array when filtering by non-existent organization', async () => {
    // Create an organization and status page
    const [org1] = await db.insert(organizationsTable)
      .values(testOrganization1)
      .returning()
      .execute();

    const statusPage: CreateStatusPageInput = {
      organization_id: org1.id,
      name: 'Test Status Page',
      description: 'Test page',
      is_public: true
    };

    await db.insert(statusPagesTable)
      .values(statusPage)
      .execute();

    // Filter by non-existent organization ID
    const result = await getStatusPages(99999);
    expect(result).toEqual([]);
  });

  it('should handle multiple status pages for same organization', async () => {
    // Create organization
    const [org1] = await db.insert(organizationsTable)
      .values(testOrganization1)
      .returning()
      .execute();

    // Create multiple status pages for the same organization
    const statusPages: CreateStatusPageInput[] = [
      {
        organization_id: org1.id,
        name: 'Public Status',
        description: 'Public facing',
        is_public: true
      },
      {
        organization_id: org1.id,
        name: 'Internal Status',
        description: 'Internal monitoring',
        is_public: false
      },
      {
        organization_id: org1.id,
        name: 'API Status',
        description: 'API monitoring',
        is_public: true
      }
    ];

    await db.insert(statusPagesTable)
      .values(statusPages)
      .execute();

    const result = await getStatusPages(org1.id);

    expect(result).toHaveLength(3);
    
    // Verify all belong to the same organization
    result.forEach(page => {
      expect(page.organization_id).toBe(org1.id);
    });

    // Verify names are correct
    const names = result.map(page => page.name).sort();
    expect(names).toEqual(['API Status', 'Internal Status', 'Public Status']);
  });

  it('should preserve all status page fields correctly', async () => {
    // Create organization
    const [org1] = await db.insert(organizationsTable)
      .values(testOrganization1)
      .returning()
      .execute();

    // Create status page with all fields
    const statusPageData: CreateStatusPageInput = {
      organization_id: org1.id,
      name: 'Full Status Page',
      description: 'Complete status page with all fields',
      domain: 'status.example.com',
      is_public: false
    };

    const [createdPage] = await db.insert(statusPagesTable)
      .values({
        ...statusPageData,
        custom_css: '.status { color: red; }',
        logo_url: 'https://example.com/logo.png'
      })
      .returning()
      .execute();

    const result = await getStatusPages(org1.id);

    expect(result).toHaveLength(1);
    const page = result[0];

    expect(page.id).toBe(createdPage.id);
    expect(page.organization_id).toBe(org1.id);
    expect(page.name).toBe('Full Status Page');
    expect(page.description).toBe('Complete status page with all fields');
    expect(page.domain).toBe('status.example.com');
    expect(page.custom_css).toBe('.status { color: red; }');
    expect(page.logo_url).toBe('https://example.com/logo.png');
    expect(page.is_public).toBe(false);
    expect(page.created_at).toBeInstanceOf(Date);
    expect(page.updated_at).toBeInstanceOf(Date);
  });

  it('should handle organization ID of zero', async () => {
    // Create organization with ID that will be generated
    const [org1] = await db.insert(organizationsTable)
      .values(testOrganization1)
      .returning()
      .execute();

    const statusPage: CreateStatusPageInput = {
      organization_id: org1.id,
      name: 'Test Status Page',
      description: 'Test',
      is_public: true
    };

    await db.insert(statusPagesTable)
      .values(statusPage)
      .execute();

    // Test with organization ID 0 (should return empty since no org has ID 0)
    const result = await getStatusPages(0);
    expect(result).toEqual([]);
  });

  it('should maintain correct data types in returned objects', async () => {
    // Create organization
    const [org1] = await db.insert(organizationsTable)
      .values(testOrganization1)
      .returning()
      .execute();

    const statusPage: CreateStatusPageInput = {
      organization_id: org1.id,
      name: 'Type Test Page',
      description: 'Testing data types',
      is_public: true
    };

    await db.insert(statusPagesTable)
      .values(statusPage)
      .execute();

    const result = await getStatusPages();

    expect(result).toHaveLength(1);
    const page = result[0];

    // Verify data types
    expect(typeof page.id).toBe('number');
    expect(typeof page.organization_id).toBe('number');
    expect(typeof page.name).toBe('string');
    expect(typeof page.is_public).toBe('boolean');
    expect(page.created_at).toBeInstanceOf(Date);
    expect(page.updated_at).toBeInstanceOf(Date);
    
    // Nullable fields should be null or string
    if (page.description !== null) {
      expect(typeof page.description).toBe('string');
    }
    if (page.domain !== null) {
      expect(typeof page.domain).toBe('string');
    }
  });
});