import { db } from '../db';
import { componentGroupsTable, statusPagesTable } from '../db/schema';
import { type CreateComponentGroupInput, type ComponentGroup } from '../schema';
import { eq } from 'drizzle-orm';

export const createComponentGroup = async (input: CreateComponentGroupInput): Promise<ComponentGroup> => {
  try {
    // Validate that the status page exists
    const statusPage = await db.select()
      .from(statusPagesTable)
      .where(eq(statusPagesTable.id, input.status_page_id))
      .limit(1)
      .execute();

    if (!statusPage || statusPage.length === 0) {
      throw new Error(`Status page with id ${input.status_page_id} not found`);
    }

    // Insert component group record
    const result = await db.insert(componentGroupsTable)
      .values({
        status_page_id: input.status_page_id,
        name: input.name,
        description: input.description || null,
        sort_order: input.sort_order,
        is_collapsed: input.is_collapsed
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Component group creation failed:', error);
    throw error;
  }
};