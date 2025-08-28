import { db } from '../db';
import { maintenanceWindowsTable, statusPagesTable } from '../db/schema';
import { type MaintenanceWindow } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getMaintenanceWindows = async (statusPageId: number): Promise<MaintenanceWindow[]> => {
  try {
    // First verify the status page exists
    const statusPage = await db.select()
      .from(statusPagesTable)
      .where(eq(statusPagesTable.id, statusPageId))
      .execute();

    if (statusPage.length === 0) {
      throw new Error('Status page not found');
    }

    // Query maintenance windows ordered by scheduled_start (most recent first)
    const results = await db.select()
      .from(maintenanceWindowsTable)
      .where(eq(maintenanceWindowsTable.status_page_id, statusPageId))
      .orderBy(desc(maintenanceWindowsTable.scheduled_start))
      .execute();

    return results;
  } catch (error) {
    console.error('Get maintenance windows failed:', error);
    throw error;
  }
};