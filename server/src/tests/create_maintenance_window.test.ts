import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  maintenanceWindowsTable, 
  maintenanceComponentsTable, 
  organizationsTable, 
  statusPagesTable, 
  componentsTable 
} from '../db/schema';
import { type CreateMaintenanceWindowInput } from '../schema';
import { createMaintenanceWindow } from '../handlers/create_maintenance_window';
import { eq } from 'drizzle-orm';

describe('createMaintenanceWindow', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const setupTestData = async () => {
    // Create organization
    const orgResult = await db.insert(organizationsTable)
      .values({
        name: 'Test Org',
        slug: 'test-org'
      })
      .returning()
      .execute();

    // Create status page
    const statusPageResult = await db.insert(statusPagesTable)
      .values({
        organization_id: orgResult[0].id,
        name: 'Test Status Page',
        description: 'Test description'
      })
      .returning()
      .execute();

    // Create components
    const componentResults = await db.insert(componentsTable)
      .values([
        {
          status_page_id: statusPageResult[0].id,
          name: 'API Service',
          description: 'Main API'
        },
        {
          status_page_id: statusPageResult[0].id,
          name: 'Database',
          description: 'Primary database'
        }
      ])
      .returning()
      .execute();

    return {
      organizationId: orgResult[0].id,
      statusPageId: statusPageResult[0].id,
      componentIds: componentResults.map(c => c.id)
    };
  };

  it('should create a maintenance window successfully', async () => {
    const { statusPageId } = await setupTestData();
    
    const scheduledStart = new Date('2024-12-01T10:00:00Z');
    const scheduledEnd = new Date('2024-12-01T12:00:00Z');

    const testInput: CreateMaintenanceWindowInput = {
      status_page_id: statusPageId,
      name: 'Database Upgrade',
      description: 'Upgrading database to version 2.0',
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd
    };

    const result = await createMaintenanceWindow(testInput);

    // Validate return values
    expect(result.id).toBeDefined();
    expect(result.status_page_id).toEqual(statusPageId);
    expect(result.name).toEqual('Database Upgrade');
    expect(result.description).toEqual('Upgrading database to version 2.0');
    expect(result.status).toEqual('scheduled');
    expect(result.scheduled_start).toEqual(scheduledStart);
    expect(result.scheduled_end).toEqual(scheduledEnd);
    expect(result.actual_start).toBeNull();
    expect(result.actual_end).toBeNull();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save maintenance window to database', async () => {
    const { statusPageId } = await setupTestData();
    
    const testInput: CreateMaintenanceWindowInput = {
      status_page_id: statusPageId,
      name: 'System Maintenance',
      description: 'Regular system maintenance',
      scheduled_start: new Date('2024-12-02T02:00:00Z'),
      scheduled_end: new Date('2024-12-02T04:00:00Z')
    };

    const result = await createMaintenanceWindow(testInput);

    // Verify data was saved to database
    const savedWindows = await db.select()
      .from(maintenanceWindowsTable)
      .where(eq(maintenanceWindowsTable.id, result.id))
      .execute();

    expect(savedWindows).toHaveLength(1);
    expect(savedWindows[0].name).toEqual('System Maintenance');
    expect(savedWindows[0].description).toEqual('Regular system maintenance');
    expect(savedWindows[0].status).toEqual('scheduled');
    expect(savedWindows[0].scheduled_start).toEqual(testInput.scheduled_start);
    expect(savedWindows[0].scheduled_end).toEqual(testInput.scheduled_end);
  });

  it('should create maintenance window with affected components', async () => {
    const { statusPageId, componentIds } = await setupTestData();
    
    const testInput: CreateMaintenanceWindowInput = {
      status_page_id: statusPageId,
      name: 'Multi-service Maintenance',
      description: 'Maintenance affecting multiple services',
      scheduled_start: new Date('2024-12-03T01:00:00Z'),
      scheduled_end: new Date('2024-12-03T03:00:00Z'),
      component_ids: componentIds
    };

    const result = await createMaintenanceWindow(testInput);

    // Verify maintenance window was created
    expect(result.id).toBeDefined();
    expect(result.name).toEqual('Multi-service Maintenance');

    // Verify component associations were created
    const componentLinks = await db.select()
      .from(maintenanceComponentsTable)
      .where(eq(maintenanceComponentsTable.maintenance_window_id, result.id))
      .execute();

    expect(componentLinks).toHaveLength(2);
    expect(componentLinks.map(link => link.component_id).sort()).toEqual(componentIds.sort());
  });

  it('should create maintenance window without component_ids', async () => {
    const { statusPageId } = await setupTestData();
    
    const testInput: CreateMaintenanceWindowInput = {
      status_page_id: statusPageId,
      name: 'General Maintenance',
      description: 'General system maintenance',
      scheduled_start: new Date('2024-12-04T06:00:00Z'),
      scheduled_end: new Date('2024-12-04T08:00:00Z')
      // No component_ids provided
    };

    const result = await createMaintenanceWindow(testInput);

    // Verify maintenance window was created
    expect(result.id).toBeDefined();
    expect(result.name).toEqual('General Maintenance');

    // Verify no component associations were created
    const componentLinks = await db.select()
      .from(maintenanceComponentsTable)
      .where(eq(maintenanceComponentsTable.maintenance_window_id, result.id))
      .execute();

    expect(componentLinks).toHaveLength(0);
  });

  it('should reject maintenance window with end time before start time', async () => {
    const { statusPageId } = await setupTestData();
    
    const testInput: CreateMaintenanceWindowInput = {
      status_page_id: statusPageId,
      name: 'Invalid Maintenance',
      description: 'This should fail',
      scheduled_start: new Date('2024-12-05T10:00:00Z'),
      scheduled_end: new Date('2024-12-05T08:00:00Z') // End before start
    };

    await expect(() => createMaintenanceWindow(testInput))
      .toThrow(/scheduled end time must be after scheduled start time/i);
  });

  it('should reject maintenance window with equal start and end times', async () => {
    const { statusPageId } = await setupTestData();
    
    const sameTime = new Date('2024-12-05T10:00:00Z');
    const testInput: CreateMaintenanceWindowInput = {
      status_page_id: statusPageId,
      name: 'Invalid Maintenance',
      description: 'This should fail',
      scheduled_start: sameTime,
      scheduled_end: sameTime // Same as start
    };

    await expect(() => createMaintenanceWindow(testInput))
      .toThrow(/scheduled end time must be after scheduled start time/i);
  });

  it('should reject maintenance window for non-existent status page', async () => {
    const testInput: CreateMaintenanceWindowInput = {
      status_page_id: 99999, // Non-existent status page
      name: 'Invalid Maintenance',
      description: 'This should fail',
      scheduled_start: new Date('2024-12-06T10:00:00Z'),
      scheduled_end: new Date('2024-12-06T12:00:00Z')
    };

    await expect(() => createMaintenanceWindow(testInput))
      .toThrow(/status page not found/i);
  });
});