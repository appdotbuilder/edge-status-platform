import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { statusPagesTable, organizationsTable } from '../db/schema';
import { type CreateStatusPageInput } from '../schema';
import { createStatusPage } from '../handlers/create_status_page';
import { eq } from 'drizzle-orm';

describe('createStatusPage', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper to create test organization
  const createTestOrganization = async (isActive: boolean = true) => {
    const result = await db.insert(organizationsTable)
      .values({
        name: 'Test Organization',
        slug: 'test-org',
        subscription_tier: 'free',
        is_active: isActive
      })
      .returning()
      .execute();
    return result[0];
  };

  it('should create a status page with all fields', async () => {
    const organization = await createTestOrganization();
    
    const testInput: CreateStatusPageInput = {
      organization_id: organization.id,
      name: 'Test Status Page',
      description: 'A status page for testing',
      domain: 'status.example.com',
      is_public: true
    };

    const result = await createStatusPage(testInput);

    // Basic field validation
    expect(result.name).toEqual('Test Status Page');
    expect(result.description).toEqual('A status page for testing');
    expect(result.domain).toEqual('status.example.com');
    expect(result.organization_id).toEqual(organization.id);
    expect(result.is_public).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.custom_css).toBeNull();
    expect(result.logo_url).toBeNull();
  });

  it('should create a status page with minimal required fields', async () => {
    const organization = await createTestOrganization();
    
    const testInput: CreateStatusPageInput = {
      organization_id: organization.id,
      name: 'Minimal Status Page',
      is_public: true
    };

    const result = await createStatusPage(testInput);

    expect(result.name).toEqual('Minimal Status Page');
    expect(result.organization_id).toEqual(organization.id);
    expect(result.is_public).toEqual(true);
    expect(result.description).toBeNull();
    expect(result.domain).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a status page with Zod defaults applied', async () => {
    const organization = await createTestOrganization();
    
    // Test with only required fields (Zod will apply defaults)
    const testInput: CreateStatusPageInput = {
      organization_id: organization.id,
      name: 'Default Status Page',
      is_public: true // Required field, but testing defaults for optional fields
    };

    const result = await createStatusPage(testInput);

    expect(result.name).toEqual('Default Status Page');
    expect(result.organization_id).toEqual(organization.id);
    expect(result.is_public).toEqual(true);
    expect(result.description).toBeNull(); // Optional field defaults to null
    expect(result.domain).toBeNull(); // Optional field defaults to null
  });

  it('should save status page to database', async () => {
    const organization = await createTestOrganization();
    
    const testInput: CreateStatusPageInput = {
      organization_id: organization.id,
      name: 'Database Test Page',
      description: 'Testing database persistence',
      domain: 'db.test.com',
      is_public: false
    };

    const result = await createStatusPage(testInput);

    // Query database to verify persistence
    const statusPages = await db.select()
      .from(statusPagesTable)
      .where(eq(statusPagesTable.id, result.id))
      .execute();

    expect(statusPages).toHaveLength(1);
    expect(statusPages[0].name).toEqual('Database Test Page');
    expect(statusPages[0].description).toEqual('Testing database persistence');
    expect(statusPages[0].domain).toEqual('db.test.com');
    expect(statusPages[0].organization_id).toEqual(organization.id);
    expect(statusPages[0].is_public).toEqual(false);
    expect(statusPages[0].created_at).toBeInstanceOf(Date);
    expect(statusPages[0].updated_at).toBeInstanceOf(Date);
  });

  it('should reject creation for non-existent organization', async () => {
    const testInput: CreateStatusPageInput = {
      organization_id: 99999, // Non-existent organization ID
      name: 'Invalid Org Status Page',
      is_public: true
    };

    await expect(createStatusPage(testInput))
      .rejects.toThrow(/organization with id 99999 not found/i);
  });

  it('should reject creation for inactive organization', async () => {
    const organization = await createTestOrganization(false); // Create inactive organization
    
    const testInput: CreateStatusPageInput = {
      organization_id: organization.id,
      name: 'Inactive Org Status Page',
      is_public: true
    };

    await expect(createStatusPage(testInput))
      .rejects.toThrow(/organization with id .+ is not active/i);
  });

  it('should create multiple status pages for the same organization', async () => {
    const organization = await createTestOrganization();
    
    const testInput1: CreateStatusPageInput = {
      organization_id: organization.id,
      name: 'First Status Page',
      is_public: true
    };

    const testInput2: CreateStatusPageInput = {
      organization_id: organization.id,
      name: 'Second Status Page',
      is_public: false
    };

    const result1 = await createStatusPage(testInput1);
    const result2 = await createStatusPage(testInput2);

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.name).toEqual('First Status Page');
    expect(result2.name).toEqual('Second Status Page');
    expect(result1.organization_id).toEqual(organization.id);
    expect(result2.organization_id).toEqual(organization.id);

    // Verify both exist in database
    const statusPages = await db.select()
      .from(statusPagesTable)
      .where(eq(statusPagesTable.organization_id, organization.id))
      .execute();

    expect(statusPages).toHaveLength(2);
  });
});