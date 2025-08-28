import { db } from '../db';
import { maintenanceWindowsTable, maintenanceComponentsTable, statusPagesTable } from '../db/schema';
import { type CreateMaintenanceWindowInput, type MaintenanceWindow } from '../schema';
import { eq } from 'drizzle-orm';

export const createMaintenanceWindow = async (input: CreateMaintenanceWindowInput): Promise<MaintenanceWindow> => {
  try {
    // Validate that scheduled_end is after scheduled_start
    if (input.scheduled_end <= input.scheduled_start) {
      throw new Error('Scheduled end time must be after scheduled start time');
    }

    // Verify status page exists
    const statusPage = await db.select()
      .from(statusPagesTable)
      .where(eq(statusPagesTable.id, input.status_page_id))
      .execute();

    if (statusPage.length === 0) {
      throw new Error('Status page not found');
    }

    // Insert maintenance window
    const result = await db.insert(maintenanceWindowsTable)
      .values({
        status_page_id: input.status_page_id,
        name: input.name,
        description: input.description,
        scheduled_start: input.scheduled_start,
        scheduled_end: input.scheduled_end
      })
      .returning()
      .execute();

    const maintenanceWindow = result[0];

    // Link affected components if provided
    if (input.component_ids && input.component_ids.length > 0) {
      const componentLinks = input.component_ids.map(componentId => ({
        maintenance_window_id: maintenanceWindow.id,
        component_id: componentId
      }));

      await db.insert(maintenanceComponentsTable)
        .values(componentLinks)
        .execute();
    }

    return maintenanceWindow;
  } catch (error) {
    console.error('Maintenance window creation failed:', error);
    throw error;
  }
};