import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  organizationsTable, 
  statusPagesTable, 
  componentsTable, 
  metricsTable 
} from '../db/schema';
import { type UpdateComponentStatusInput } from '../schema';
import { updateComponentStatus } from '../handlers/update_component_status';
import { eq } from 'drizzle-orm';

describe('updateComponentStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test data
  const createTestData = async () => {
    // Create organization
    const organizations = await db.insert(organizationsTable)
      .values({
        name: 'Test Org',
        slug: 'test-org',
        subscription_tier: 'free'
      })
      .returning()
      .execute();

    const organizationId = organizations[0].id;

    // Create status page
    const statusPages = await db.insert(statusPagesTable)
      .values({
        organization_id: organizationId,
        name: 'Test Status Page',
        is_public: true
      })
      .returning()
      .execute();

    const statusPageId = statusPages[0].id;

    // Create component
    const components = await db.insert(componentsTable)
      .values({
        status_page_id: statusPageId,
        name: 'API Service',
        description: 'Main API service',
        status: 'operational',
        sort_order: 1,
        is_visible: true
      })
      .returning()
      .execute();

    return {
      organizationId,
      statusPageId,
      componentId: components[0].id,
      component: components[0]
    };
  };

  it('should update component status successfully', async () => {
    const { componentId } = await createTestData();
    
    const input: UpdateComponentStatusInput = {
      component_id: componentId,
      status: 'degraded_performance'
    };

    const result = await updateComponentStatus(input);

    // Verify the updated component
    expect(result.id).toEqual(componentId);
    expect(result.status).toEqual('degraded_performance');
    expect(result.name).toEqual('API Service');
    expect(result.description).toEqual('Main API service');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should persist status change to database', async () => {
    const { componentId } = await createTestData();
    
    const input: UpdateComponentStatusInput = {
      component_id: componentId,
      status: 'major_outage'
    };

    await updateComponentStatus(input);

    // Verify component was updated in database
    const components = await db.select()
      .from(componentsTable)
      .where(eq(componentsTable.id, componentId))
      .execute();

    expect(components).toHaveLength(1);
    expect(components[0].status).toEqual('major_outage');
    expect(components[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create metric entry for status change', async () => {
    const { componentId } = await createTestData();
    
    const input: UpdateComponentStatusInput = {
      component_id: componentId,
      status: 'partial_outage'
    };

    await updateComponentStatus(input);

    // Verify metric was created
    const metrics = await db.select()
      .from(metricsTable)
      .where(eq(metricsTable.component_id, componentId))
      .execute();

    expect(metrics).toHaveLength(1);
    expect(metrics[0].component_id).toEqual(componentId);
    expect(metrics[0].status).toEqual('partial_outage');
    expect(metrics[0].timestamp).toBeInstanceOf(Date);
    expect(metrics[0].response_time).toBeNull();
  });

  it('should handle all valid status values', async () => {
    const { componentId } = await createTestData();
    
    const statusValues = ['operational', 'degraded_performance', 'partial_outage', 'major_outage', 'under_maintenance'] as const;
    
    for (const status of statusValues) {
      const input: UpdateComponentStatusInput = {
        component_id: componentId,
        status
      };

      const result = await updateComponentStatus(input);
      expect(result.status).toEqual(status);
    }

    // Verify all metrics were created
    const metrics = await db.select()
      .from(metricsTable)
      .where(eq(metricsTable.component_id, componentId))
      .execute();

    expect(metrics).toHaveLength(statusValues.length);
  });

  it('should throw error for non-existent component', async () => {
    const input: UpdateComponentStatusInput = {
      component_id: 999999,
      status: 'operational'
    };

    await expect(updateComponentStatus(input)).rejects.toThrow(/Component with id 999999 not found/i);
  });

  it('should update updated_at timestamp', async () => {
    const { componentId, component } = await createTestData();
    
    // Wait a small amount to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const input: UpdateComponentStatusInput = {
      component_id: componentId,
      status: 'degraded_performance'
    };

    const result = await updateComponentStatus(input);

    // Verify updated_at was changed
    expect(result.updated_at.getTime()).toBeGreaterThan(component.created_at.getTime());
  });

  it('should maintain all other component properties', async () => {
    const { componentId } = await createTestData();
    
    const input: UpdateComponentStatusInput = {
      component_id: componentId,
      status: 'under_maintenance'
    };

    const result = await updateComponentStatus(input);

    // Verify all other properties remain unchanged
    expect(result.name).toEqual('API Service');
    expect(result.description).toEqual('Main API service');
    expect(result.sort_order).toEqual(1);
    expect(result.is_visible).toEqual(true);
    expect(result.component_group_id).toBeNull();
  });

  it('should handle status change from non-operational to operational', async () => {
    const { componentId } = await createTestData();
    
    // First set to degraded
    await updateComponentStatus({
      component_id: componentId,
      status: 'degraded_performance'
    });

    // Then restore to operational
    const result = await updateComponentStatus({
      component_id: componentId,
      status: 'operational'
    });

    expect(result.status).toEqual('operational');

    // Verify two metrics were created
    const metrics = await db.select()
      .from(metricsTable)
      .where(eq(metricsTable.component_id, componentId))
      .execute();

    expect(metrics).toHaveLength(2);
    expect(metrics[0].status).toEqual('degraded_performance');
    expect(metrics[1].status).toEqual('operational');
  });
});