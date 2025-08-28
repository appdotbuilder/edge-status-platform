import { db } from '../db';
import { componentsTable, metricsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type UpdateComponentStatusInput, type Component } from '../schema';

export const updateComponentStatus = async (input: UpdateComponentStatusInput): Promise<Component> => {
  try {
    // First, verify the component exists and get current data
    const existingComponents = await db.select()
      .from(componentsTable)
      .where(eq(componentsTable.id, input.component_id))
      .execute();

    if (existingComponents.length === 0) {
      throw new Error(`Component with id ${input.component_id} not found`);
    }

    // Update the component status and updated_at timestamp
    const updatedComponents = await db.update(componentsTable)
      .set({
        status: input.status,
        updated_at: new Date()
      })
      .where(eq(componentsTable.id, input.component_id))
      .returning()
      .execute();

    const updatedComponent = updatedComponents[0];

    // Create a metric entry for this status change
    await db.insert(metricsTable)
      .values({
        component_id: input.component_id,
        timestamp: new Date(),
        status: input.status,
        response_time: null // Could be extended to include response time data
      })
      .execute();

    return updatedComponent;
  } catch (error) {
    console.error('Component status update failed:', error);
    throw error;
  }
};