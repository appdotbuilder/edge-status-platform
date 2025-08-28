import { db } from '../db';
import { componentsTable, statusPagesTable, componentGroupsTable } from '../db/schema';
import { type CreateComponentInput, type Component } from '../schema';
import { eq } from 'drizzle-orm';

export const createComponent = async (input: CreateComponentInput): Promise<Component> => {
  try {
    // Validate that the status page exists
    const statusPageExists = await db.select()
      .from(statusPagesTable)
      .where(eq(statusPagesTable.id, input.status_page_id))
      .execute();

    if (statusPageExists.length === 0) {
      throw new Error(`Status page with id ${input.status_page_id} not found`);
    }

    // Validate that the component group exists if provided
    if (input.component_group_id) {
      const componentGroupExists = await db.select()
        .from(componentGroupsTable)
        .where(eq(componentGroupsTable.id, input.component_group_id))
        .execute();

      if (componentGroupExists.length === 0) {
        throw new Error(`Component group with id ${input.component_group_id} not found`);
      }

      // Ensure the component group belongs to the same status page
      if (componentGroupExists[0].status_page_id !== input.status_page_id) {
        throw new Error(`Component group ${input.component_group_id} does not belong to status page ${input.status_page_id}`);
      }
    }

    // Insert the component
    const result = await db.insert(componentsTable)
      .values({
        status_page_id: input.status_page_id,
        component_group_id: input.component_group_id || null,
        name: input.name,
        description: input.description || null,
        status: input.status,
        sort_order: input.sort_order,
        is_visible: input.is_visible
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Component creation failed:', error);
    throw error;
  }
};