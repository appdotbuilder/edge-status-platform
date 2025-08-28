import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { componentGroupsTable, organizationsTable, statusPagesTable } from '../db/schema';
import { type CreateComponentGroupInput } from '../schema';
import { createComponentGroup } from '../handlers/create_component_group';
import { eq } from 'drizzle-orm';

// Test input with all fields including defaults
const testInput: CreateComponentGroupInput = {
  status_page_id: 1,
  name: 'Test Component Group',
  description: 'A component group for testing',
  sort_order: 5,
  is_collapsed: true
};

describe('createComponentGroup', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a component group with all fields', async () => {
    // Create prerequisite data
    const org = await db.insert(organizationsTable)
      .values({
        name: 'Test Org',
        slug: 'test-org'
      })
      .returning()
      .execute();

    const statusPage = await db.insert(statusPagesTable)
      .values({
        organization_id: org[0].id,
        name: 'Test Status Page'
      })
      .returning()
      .execute();

    const input = {
      ...testInput,
      status_page_id: statusPage[0].id
    };

    const result = await createComponentGroup(input);

    // Basic field validation
    expect(result.name).toEqual('Test Component Group');
    expect(result.description).toEqual('A component group for testing');
    expect(result.status_page_id).toEqual(statusPage[0].id);
    expect(result.sort_order).toEqual(5);
    expect(result.is_collapsed).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a component group with minimal fields and defaults', async () => {
    // Create prerequisite data
    const org = await db.insert(organizationsTable)
      .values({
        name: 'Test Org',
        slug: 'test-org'
      })
      .returning()
      .execute();

    const statusPage = await db.insert(statusPagesTable)
      .values({
        organization_id: org[0].id,
        name: 'Test Status Page'
      })
      .returning()
      .execute();

    const minimalInput: CreateComponentGroupInput = {
      status_page_id: statusPage[0].id,
      name: 'Minimal Component Group',
      sort_order: 0, // Default value
      is_collapsed: false // Default value
    };

    const result = await createComponentGroup(minimalInput);

    expect(result.name).toEqual('Minimal Component Group');
    expect(result.description).toBeNull();
    expect(result.status_page_id).toEqual(statusPage[0].id);
    expect(result.sort_order).toEqual(0);
    expect(result.is_collapsed).toEqual(false);
  });

  it('should save component group to database', async () => {
    // Create prerequisite data
    const org = await db.insert(organizationsTable)
      .values({
        name: 'Test Org',
        slug: 'test-org'
      })
      .returning()
      .execute();

    const statusPage = await db.insert(statusPagesTable)
      .values({
        organization_id: org[0].id,
        name: 'Test Status Page'
      })
      .returning()
      .execute();

    const input = {
      ...testInput,
      status_page_id: statusPage[0].id
    };

    const result = await createComponentGroup(input);

    // Query database directly to verify persistence
    const componentGroups = await db.select()
      .from(componentGroupsTable)
      .where(eq(componentGroupsTable.id, result.id))
      .execute();

    expect(componentGroups).toHaveLength(1);
    expect(componentGroups[0].name).toEqual('Test Component Group');
    expect(componentGroups[0].description).toEqual('A component group for testing');
    expect(componentGroups[0].status_page_id).toEqual(statusPage[0].id);
    expect(componentGroups[0].sort_order).toEqual(5);
    expect(componentGroups[0].is_collapsed).toEqual(true);
    expect(componentGroups[0].created_at).toBeInstanceOf(Date);
    expect(componentGroups[0].updated_at).toBeInstanceOf(Date);
  });

  it('should handle null description correctly', async () => {
    // Create prerequisite data
    const org = await db.insert(organizationsTable)
      .values({
        name: 'Test Org',
        slug: 'test-org'
      })
      .returning()
      .execute();

    const statusPage = await db.insert(statusPagesTable)
      .values({
        organization_id: org[0].id,
        name: 'Test Status Page'
      })
      .returning()
      .execute();

    const inputWithNullDescription: CreateComponentGroupInput = {
      status_page_id: statusPage[0].id,
      name: 'Group Without Description',
      description: null,
      sort_order: 0,
      is_collapsed: false
    };

    const result = await createComponentGroup(inputWithNullDescription);

    expect(result.description).toBeNull();

    // Verify in database
    const saved = await db.select()
      .from(componentGroupsTable)
      .where(eq(componentGroupsTable.id, result.id))
      .execute();

    expect(saved[0].description).toBeNull();
  });

  it('should throw error when status page does not exist', async () => {
    const inputWithInvalidStatusPageId = {
      ...testInput,
      status_page_id: 999999 // Non-existent status page ID
    };

    await expect(createComponentGroup(inputWithInvalidStatusPageId))
      .rejects
      .toThrow(/Status page with id 999999 not found/i);
  });

  it('should create multiple component groups for same status page', async () => {
    // Create prerequisite data
    const org = await db.insert(organizationsTable)
      .values({
        name: 'Test Org',
        slug: 'test-org'
      })
      .returning()
      .execute();

    const statusPage = await db.insert(statusPagesTable)
      .values({
        organization_id: org[0].id,
        name: 'Test Status Page'
      })
      .returning()
      .execute();

    // Create first component group
    const input1: CreateComponentGroupInput = {
      status_page_id: statusPage[0].id,
      name: 'First Group',
      sort_order: 1,
      is_collapsed: false
    };

    const result1 = await createComponentGroup(input1);

    // Create second component group
    const input2: CreateComponentGroupInput = {
      status_page_id: statusPage[0].id,
      name: 'Second Group',
      sort_order: 2,
      is_collapsed: true
    };

    const result2 = await createComponentGroup(input2);

    // Verify both were created
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.name).toEqual('First Group');
    expect(result2.name).toEqual('Second Group');
    expect(result1.status_page_id).toEqual(statusPage[0].id);
    expect(result2.status_page_id).toEqual(statusPage[0].id);

    // Verify both exist in database
    const allGroups = await db.select()
      .from(componentGroupsTable)
      .where(eq(componentGroupsTable.status_page_id, statusPage[0].id))
      .execute();

    expect(allGroups).toHaveLength(2);
  });
});