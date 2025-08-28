import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { organizationsTable, statusPagesTable, maintenanceWindowsTable } from '../db/schema';
import { type CreateOrganizationInput, type CreateStatusPageInput, type CreateMaintenanceWindowInput } from '../schema';
import { getMaintenanceWindows } from '../handlers/get_maintenance_windows';
import { eq } from 'drizzle-orm';

// Test data setup
const testOrganization: CreateOrganizationInput = {
  name: 'Test Organization',
  slug: 'test-org',
  subscription_tier: 'pro'
};

const testStatusPage: CreateStatusPageInput = {
  organization_id: 1,
  name: 'Test Status Page',
  description: 'A status page for testing',
  is_public: true
};

const testMaintenanceWindow: CreateMaintenanceWindowInput = {
  status_page_id: 1,
  name: 'Database Maintenance',
  description: 'Scheduled database maintenance window',
  scheduled_start: new Date('2024-12-01T02:00:00Z'),
  scheduled_end: new Date('2024-12-01T04:00:00Z')
};

describe('getMaintenanceWindows', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no maintenance windows exist', async () => {
    // Create prerequisite data
    await db.insert(organizationsTable).values(testOrganization).execute();
    await db.insert(statusPagesTable).values(testStatusPage).execute();

    const result = await getMaintenanceWindows(1);

    expect(result).toEqual([]);
  });

  it('should return maintenance windows ordered by scheduled_start desc', async () => {
    // Create prerequisite data
    await db.insert(organizationsTable).values(testOrganization).execute();
    await db.insert(statusPagesTable).values(testStatusPage).execute();

    // Create multiple maintenance windows with different scheduled times
    const maintenance1 = {
      ...testMaintenanceWindow,
      name: 'First Maintenance',
      scheduled_start: new Date('2024-12-01T02:00:00Z'),
      scheduled_end: new Date('2024-12-01T04:00:00Z')
    };

    const maintenance2 = {
      ...testMaintenanceWindow,
      name: 'Second Maintenance',
      scheduled_start: new Date('2024-12-02T02:00:00Z'),
      scheduled_end: new Date('2024-12-02T04:00:00Z')
    };

    const maintenance3 = {
      ...testMaintenanceWindow,
      name: 'Third Maintenance',
      scheduled_start: new Date('2024-12-03T02:00:00Z'),
      scheduled_end: new Date('2024-12-03T04:00:00Z')
    };

    await db.insert(maintenanceWindowsTable).values([
      maintenance1,
      maintenance2,
      maintenance3
    ]).execute();

    const result = await getMaintenanceWindows(1);

    expect(result).toHaveLength(3);
    // Should be ordered by scheduled_start desc (most recent first)
    expect(result[0].name).toEqual('Third Maintenance');
    expect(result[1].name).toEqual('Second Maintenance');
    expect(result[2].name).toEqual('First Maintenance');
  });

  it('should return maintenance windows with all required fields', async () => {
    // Create prerequisite data
    await db.insert(organizationsTable).values(testOrganization).execute();
    await db.insert(statusPagesTable).values(testStatusPage).execute();

    await db.insert(maintenanceWindowsTable).values(testMaintenanceWindow).execute();

    const result = await getMaintenanceWindows(1);

    expect(result).toHaveLength(1);
    const maintenanceWindow = result[0];

    // Verify all required fields are present
    expect(maintenanceWindow.id).toBeDefined();
    expect(maintenanceWindow.status_page_id).toEqual(1);
    expect(maintenanceWindow.name).toEqual('Database Maintenance');
    expect(maintenanceWindow.description).toEqual('Scheduled database maintenance window');
    expect(maintenanceWindow.status).toEqual('scheduled'); // Default status
    expect(maintenanceWindow.scheduled_start).toBeInstanceOf(Date);
    expect(maintenanceWindow.scheduled_end).toBeInstanceOf(Date);
    expect(maintenanceWindow.actual_start).toBeNull();
    expect(maintenanceWindow.actual_end).toBeNull();
    expect(maintenanceWindow.created_at).toBeInstanceOf(Date);
    expect(maintenanceWindow.updated_at).toBeInstanceOf(Date);
  });

  it('should only return maintenance windows for the specified status page', async () => {
    // Create organizations and status pages
    await db.insert(organizationsTable).values([
      testOrganization,
      { ...testOrganization, name: 'Other Org', slug: 'other-org' }
    ]).execute();

    await db.insert(statusPagesTable).values([
      testStatusPage,
      { ...testStatusPage, organization_id: 2, name: 'Other Status Page' }
    ]).execute();

    // Create maintenance windows for both status pages
    await db.insert(maintenanceWindowsTable).values([
      { ...testMaintenanceWindow, status_page_id: 1, name: 'Maintenance 1' },
      { ...testMaintenanceWindow, status_page_id: 2, name: 'Maintenance 2' }
    ]).execute();

    const result = await getMaintenanceWindows(1);

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Maintenance 1');
    expect(result[0].status_page_id).toEqual(1);
  });

  it('should handle maintenance windows with different statuses', async () => {
    // Create prerequisite data
    await db.insert(organizationsTable).values(testOrganization).execute();
    await db.insert(statusPagesTable).values(testStatusPage).execute();

    // Create maintenance windows with different statuses
    await db.insert(maintenanceWindowsTable).values([
      { ...testMaintenanceWindow, name: 'Scheduled', status: 'scheduled' },
      { ...testMaintenanceWindow, name: 'In Progress', status: 'in_progress' },
      { ...testMaintenanceWindow, name: 'Completed', status: 'completed' }
    ]).execute();

    const result = await getMaintenanceWindows(1);

    expect(result).toHaveLength(3);
    expect(result.some(mw => mw.status === 'scheduled')).toBe(true);
    expect(result.some(mw => mw.status === 'in_progress')).toBe(true);
    expect(result.some(mw => mw.status === 'completed')).toBe(true);
  });

  it('should throw error when status page does not exist', async () => {
    await expect(getMaintenanceWindows(999)).rejects.toThrow(/status page not found/i);
  });

  it('should save maintenance windows correctly in database', async () => {
    // Create prerequisite data
    await db.insert(organizationsTable).values(testOrganization).execute();
    await db.insert(statusPagesTable).values(testStatusPage).execute();

    await db.insert(maintenanceWindowsTable).values(testMaintenanceWindow).execute();

    // Call handler
    const result = await getMaintenanceWindows(1);

    // Verify data was saved correctly by querying database directly
    const savedWindows = await db.select()
      .from(maintenanceWindowsTable)
      .where(eq(maintenanceWindowsTable.status_page_id, 1))
      .execute();

    expect(savedWindows).toHaveLength(1);
    expect(savedWindows[0].name).toEqual(testMaintenanceWindow.name);
    expect(savedWindows[0].description).toEqual(testMaintenanceWindow.description);

    // Compare with handler result
    expect(result[0].name).toEqual(savedWindows[0].name);
    expect(result[0].description).toEqual(savedWindows[0].description);
  });
});