import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { organizationsTable, statusPagesTable, componentsTable, componentGroupsTable } from '../db/schema';
import { getComponents } from '../handlers/get_components';

describe('getComponents', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array for status page with no components', async () => {
    // Create organization and status page
    const org = await db.insert(organizationsTable)
      .values({
        name: 'Test Org',
        slug: 'test-org',
        subscription_tier: 'free'
      })
      .returning()
      .execute();

    const statusPage = await db.insert(statusPagesTable)
      .values({
        organization_id: org[0].id,
        name: 'Test Status Page',
        is_public: true
      })
      .returning()
      .execute();

    const result = await getComponents(statusPage[0].id);

    expect(result).toEqual([]);
  });

  it('should return components ordered by sort_order', async () => {
    // Create organization and status page
    const org = await db.insert(organizationsTable)
      .values({
        name: 'Test Org',
        slug: 'test-org',
        subscription_tier: 'free'
      })
      .returning()
      .execute();

    const statusPage = await db.insert(statusPagesTable)
      .values({
        organization_id: org[0].id,
        name: 'Test Status Page',
        is_public: true
      })
      .returning()
      .execute();

    // Create components with different sort orders
    const components = await db.insert(componentsTable)
      .values([
        {
          status_page_id: statusPage[0].id,
          name: 'Third Component',
          description: 'Third component description',
          status: 'operational',
          sort_order: 20,
          is_visible: true
        },
        {
          status_page_id: statusPage[0].id,
          name: 'First Component',
          description: 'First component description',
          status: 'degraded_performance',
          sort_order: 10,
          is_visible: true
        },
        {
          status_page_id: statusPage[0].id,
          name: 'Second Component',
          description: 'Second component description',
          status: 'partial_outage',
          sort_order: 15,
          is_visible: false
        }
      ])
      .returning()
      .execute();

    const result = await getComponents(statusPage[0].id);

    expect(result).toHaveLength(3);
    expect(result[0].name).toEqual('First Component');
    expect(result[0].sort_order).toEqual(10);
    expect(result[0].status).toEqual('degraded_performance');
    expect(result[1].name).toEqual('Second Component');
    expect(result[1].sort_order).toEqual(15);
    expect(result[1].status).toEqual('partial_outage');
    expect(result[2].name).toEqual('Third Component');
    expect(result[2].sort_order).toEqual(20);
    expect(result[2].status).toEqual('operational');
  });

  it('should return components ordered by name when sort_order is same', async () => {
    // Create organization and status page
    const org = await db.insert(organizationsTable)
      .values({
        name: 'Test Org',
        slug: 'test-org',
        subscription_tier: 'free'
      })
      .returning()
      .execute();

    const statusPage = await db.insert(statusPagesTable)
      .values({
        organization_id: org[0].id,
        name: 'Test Status Page',
        is_public: true
      })
      .returning()
      .execute();

    // Create components with same sort order but different names
    await db.insert(componentsTable)
      .values([
        {
          status_page_id: statusPage[0].id,
          name: 'Zebra Component',
          description: 'Z component',
          status: 'operational',
          sort_order: 10,
          is_visible: true
        },
        {
          status_page_id: statusPage[0].id,
          name: 'Alpha Component',
          description: 'A component',
          status: 'operational',
          sort_order: 10,
          is_visible: true
        },
        {
          status_page_id: statusPage[0].id,
          name: 'Beta Component',
          description: 'B component',
          status: 'operational',
          sort_order: 10,
          is_visible: true
        }
      ])
      .returning()
      .execute();

    const result = await getComponents(statusPage[0].id);

    expect(result).toHaveLength(3);
    expect(result[0].name).toEqual('Alpha Component');
    expect(result[1].name).toEqual('Beta Component');
    expect(result[2].name).toEqual('Zebra Component');
  });

  it('should include components with component group ids', async () => {
    // Create organization and status page
    const org = await db.insert(organizationsTable)
      .values({
        name: 'Test Org',
        slug: 'test-org',
        subscription_tier: 'free'
      })
      .returning()
      .execute();

    const statusPage = await db.insert(statusPagesTable)
      .values({
        organization_id: org[0].id,
        name: 'Test Status Page',
        is_public: true
      })
      .returning()
      .execute();

    // Create component group
    const componentGroup = await db.insert(componentGroupsTable)
      .values({
        status_page_id: statusPage[0].id,
        name: 'Test Group',
        description: 'Test group description',
        sort_order: 0,
        is_collapsed: false
      })
      .returning()
      .execute();

    // Create component with component group
    await db.insert(componentsTable)
      .values({
        status_page_id: statusPage[0].id,
        component_group_id: componentGroup[0].id,
        name: 'Grouped Component',
        description: 'Component in group',
        status: 'operational',
        sort_order: 10,
        is_visible: true
      })
      .returning()
      .execute();

    // Create component without component group
    await db.insert(componentsTable)
      .values({
        status_page_id: statusPage[0].id,
        component_group_id: null,
        name: 'Standalone Component',
        description: 'Component without group',
        status: 'operational',
        sort_order: 20,
        is_visible: true
      })
      .returning()
      .execute();

    const result = await getComponents(statusPage[0].id);

    expect(result).toHaveLength(2);
    expect(result[0].name).toEqual('Grouped Component');
    expect(result[0].component_group_id).toEqual(componentGroup[0].id);
    expect(result[1].name).toEqual('Standalone Component');
    expect(result[1].component_group_id).toBeNull();
  });

  it('should only return components for the specified status page', async () => {
    // Create organization
    const org = await db.insert(organizationsTable)
      .values({
        name: 'Test Org',
        slug: 'test-org',
        subscription_tier: 'free'
      })
      .returning()
      .execute();

    // Create two status pages
    const statusPages = await db.insert(statusPagesTable)
      .values([
        {
          organization_id: org[0].id,
          name: 'First Status Page',
          is_public: true
        },
        {
          organization_id: org[0].id,
          name: 'Second Status Page',
          is_public: true
        }
      ])
      .returning()
      .execute();

    // Create components for both status pages
    await db.insert(componentsTable)
      .values([
        {
          status_page_id: statusPages[0].id,
          name: 'Component 1',
          status: 'operational',
          sort_order: 10,
          is_visible: true
        },
        {
          status_page_id: statusPages[1].id,
          name: 'Component 2',
          status: 'operational',
          sort_order: 10,
          is_visible: true
        }
      ])
      .returning()
      .execute();

    const result = await getComponents(statusPages[0].id);

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Component 1');
    expect(result[0].status_page_id).toEqual(statusPages[0].id);
  });

  it('should include all component fields', async () => {
    // Create organization and status page
    const org = await db.insert(organizationsTable)
      .values({
        name: 'Test Org',
        slug: 'test-org',
        subscription_tier: 'free'
      })
      .returning()
      .execute();

    const statusPage = await db.insert(statusPagesTable)
      .values({
        organization_id: org[0].id,
        name: 'Test Status Page',
        is_public: true
      })
      .returning()
      .execute();

    // Create component with all fields
    await db.insert(componentsTable)
      .values({
        status_page_id: statusPage[0].id,
        component_group_id: null,
        name: 'Test Component',
        description: 'Test component description',
        status: 'major_outage',
        sort_order: 15,
        is_visible: false
      })
      .returning()
      .execute();

    const result = await getComponents(statusPage[0].id);

    expect(result).toHaveLength(1);
    const component = result[0];
    
    // Verify all fields are present
    expect(component.id).toBeDefined();
    expect(component.status_page_id).toEqual(statusPage[0].id);
    expect(component.component_group_id).toBeNull();
    expect(component.name).toEqual('Test Component');
    expect(component.description).toEqual('Test component description');
    expect(component.status).toEqual('major_outage');
    expect(component.sort_order).toEqual(15);
    expect(component.is_visible).toEqual(false);
    expect(component.created_at).toBeInstanceOf(Date);
    expect(component.updated_at).toBeInstanceOf(Date);
  });

  it('should handle non-existent status page', async () => {
    const result = await getComponents(999);

    expect(result).toEqual([]);
  });
});