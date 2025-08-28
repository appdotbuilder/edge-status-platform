import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { componentsTable, statusPagesTable, componentGroupsTable, organizationsTable } from '../db/schema';
import { type CreateComponentInput } from '../schema';
import { createComponent } from '../handlers/create_component';
import { eq } from 'drizzle-orm';

// Test data
const testOrganization = {
  name: 'Test Organization',
  slug: 'test-org',
  subscription_tier: 'free' as const
};

const testStatusPage = {
  name: 'Test Status Page',
  description: 'A status page for testing',
  is_public: true
};

const testComponentGroup = {
  name: 'Test Component Group',
  description: 'A component group for testing',
  sort_order: 0,
  is_collapsed: false
};

const testInput: CreateComponentInput = {
  status_page_id: 1,
  component_group_id: null,
  name: 'API Service',
  description: 'Main API service component',
  status: 'operational',
  sort_order: 0,
  is_visible: true
};

describe('createComponent', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a component without component group', async () => {
    // Create prerequisite organization and status page
    const orgResult = await db.insert(organizationsTable)
      .values(testOrganization)
      .returning()
      .execute();
    
    const statusPageResult = await db.insert(statusPagesTable)
      .values({
        ...testStatusPage,
        organization_id: orgResult[0].id
      })
      .returning()
      .execute();

    const componentInput = {
      ...testInput,
      status_page_id: statusPageResult[0].id,
      component_group_id: null
    };

    const result = await createComponent(componentInput);

    // Validate returned component
    expect(result.id).toBeDefined();
    expect(result.status_page_id).toEqual(statusPageResult[0].id);
    expect(result.component_group_id).toBeNull();
    expect(result.name).toEqual('API Service');
    expect(result.description).toEqual('Main API service component');
    expect(result.status).toEqual('operational');
    expect(result.sort_order).toEqual(0);
    expect(result.is_visible).toEqual(true);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a component with component group', async () => {
    // Create prerequisite organization, status page, and component group
    const orgResult = await db.insert(organizationsTable)
      .values(testOrganization)
      .returning()
      .execute();
    
    const statusPageResult = await db.insert(statusPagesTable)
      .values({
        ...testStatusPage,
        organization_id: orgResult[0].id
      })
      .returning()
      .execute();

    const componentGroupResult = await db.insert(componentGroupsTable)
      .values({
        ...testComponentGroup,
        status_page_id: statusPageResult[0].id
      })
      .returning()
      .execute();

    const componentInput = {
      ...testInput,
      status_page_id: statusPageResult[0].id,
      component_group_id: componentGroupResult[0].id
    };

    const result = await createComponent(componentInput);

    // Validate returned component
    expect(result.id).toBeDefined();
    expect(result.status_page_id).toEqual(statusPageResult[0].id);
    expect(result.component_group_id).toEqual(componentGroupResult[0].id);
    expect(result.name).toEqual('API Service');
    expect(result.description).toEqual('Main API service component');
    expect(result.status).toEqual('operational');
    expect(result.sort_order).toEqual(0);
    expect(result.is_visible).toEqual(true);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save component to database', async () => {
    // Create prerequisite organization and status page
    const orgResult = await db.insert(organizationsTable)
      .values(testOrganization)
      .returning()
      .execute();
    
    const statusPageResult = await db.insert(statusPagesTable)
      .values({
        ...testStatusPage,
        organization_id: orgResult[0].id
      })
      .returning()
      .execute();

    const componentInput = {
      ...testInput,
      status_page_id: statusPageResult[0].id,
      component_group_id: null
    };

    const result = await createComponent(componentInput);

    // Query database to verify component was saved
    const savedComponents = await db.select()
      .from(componentsTable)
      .where(eq(componentsTable.id, result.id))
      .execute();

    expect(savedComponents).toHaveLength(1);
    expect(savedComponents[0].name).toEqual('API Service');
    expect(savedComponents[0].description).toEqual('Main API service component');
    expect(savedComponents[0].status).toEqual('operational');
    expect(savedComponents[0].status_page_id).toEqual(statusPageResult[0].id);
    expect(savedComponents[0].component_group_id).toBeNull();
    expect(savedComponents[0].sort_order).toEqual(0);
    expect(savedComponents[0].is_visible).toEqual(true);
    expect(savedComponents[0].created_at).toBeInstanceOf(Date);
    expect(savedComponents[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create component with all input fields', async () => {
    // Create prerequisite data
    const orgResult = await db.insert(organizationsTable)
      .values(testOrganization)
      .returning()
      .execute();
    
    const statusPageResult = await db.insert(statusPagesTable)
      .values({
        ...testStatusPage,
        organization_id: orgResult[0].id
      })
      .returning()
      .execute();

    const componentGroupResult = await db.insert(componentGroupsTable)
      .values({
        ...testComponentGroup,
        status_page_id: statusPageResult[0].id
      })
      .returning()
      .execute();

    const fullInput: CreateComponentInput = {
      status_page_id: statusPageResult[0].id,
      component_group_id: componentGroupResult[0].id,
      name: 'Database Service',
      description: 'Primary database service',
      status: 'degraded_performance',
      sort_order: 5,
      is_visible: false
    };

    const result = await createComponent(fullInput);

    expect(result.name).toEqual('Database Service');
    expect(result.description).toEqual('Primary database service');
    expect(result.status).toEqual('degraded_performance');
    expect(result.sort_order).toEqual(5);
    expect(result.is_visible).toEqual(false);
    expect(result.component_group_id).toEqual(componentGroupResult[0].id);
  });

  it('should throw error for non-existent status page', async () => {
    const invalidInput = {
      ...testInput,
      status_page_id: 99999
    };

    expect(async () => {
      await createComponent(invalidInput);
    }).toThrow(/Status page with id 99999 not found/);
  });

  it('should throw error for non-existent component group', async () => {
    // Create prerequisite organization and status page
    const orgResult = await db.insert(organizationsTable)
      .values(testOrganization)
      .returning()
      .execute();
    
    const statusPageResult = await db.insert(statusPagesTable)
      .values({
        ...testStatusPage,
        organization_id: orgResult[0].id
      })
      .returning()
      .execute();

    const invalidInput = {
      ...testInput,
      status_page_id: statusPageResult[0].id,
      component_group_id: 99999
    };

    expect(async () => {
      await createComponent(invalidInput);
    }).toThrow(/Component group with id 99999 not found/);
  });

  it('should throw error when component group belongs to different status page', async () => {
    // Create two organizations and status pages
    const orgResult1 = await db.insert(organizationsTable)
      .values({ ...testOrganization, slug: 'test-org-1' })
      .returning()
      .execute();
    
    const orgResult2 = await db.insert(organizationsTable)
      .values({ ...testOrganization, name: 'Test Org 2', slug: 'test-org-2' })
      .returning()
      .execute();
    
    const statusPageResult1 = await db.insert(statusPagesTable)
      .values({
        ...testStatusPage,
        organization_id: orgResult1[0].id
      })
      .returning()
      .execute();

    const statusPageResult2 = await db.insert(statusPagesTable)
      .values({
        ...testStatusPage,
        name: 'Different Status Page',
        organization_id: orgResult2[0].id
      })
      .returning()
      .execute();

    // Create component group for first status page
    const componentGroupResult = await db.insert(componentGroupsTable)
      .values({
        ...testComponentGroup,
        status_page_id: statusPageResult1[0].id
      })
      .returning()
      .execute();

    // Try to create component on second status page with first status page's component group
    const invalidInput = {
      ...testInput,
      status_page_id: statusPageResult2[0].id,
      component_group_id: componentGroupResult[0].id
    };

    expect(async () => {
      await createComponent(invalidInput);
    }).toThrow(/Component group .+ does not belong to status page/);
  });

  it('should handle optional description field', async () => {
    // Create prerequisite data
    const orgResult = await db.insert(organizationsTable)
      .values(testOrganization)
      .returning()
      .execute();
    
    const statusPageResult = await db.insert(statusPagesTable)
      .values({
        ...testStatusPage,
        organization_id: orgResult[0].id
      })
      .returning()
      .execute();

    const inputWithoutDescription: CreateComponentInput = {
      status_page_id: statusPageResult[0].id,
      component_group_id: null,
      name: 'Simple Component',
      description: undefined,
      status: 'operational',
      sort_order: 0,
      is_visible: true
    };

    const result = await createComponent(inputWithoutDescription);

    expect(result.name).toEqual('Simple Component');
    expect(result.description).toBeNull();
  });
});