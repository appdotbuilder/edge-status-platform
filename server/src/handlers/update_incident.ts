import { db } from '../db';
import { incidentsTable } from '../db/schema';
import { type UpdateIncidentInput, type Incident } from '../schema';
import { eq } from 'drizzle-orm';

export const updateIncident = async (input: UpdateIncidentInput): Promise<Incident> => {
  try {
    // Prepare update data
    const updateData: any = {
      updated_at: new Date(),
    };

    // Add fields if they are provided
    if (input.name !== undefined) {
      updateData.name = input.name;
    }

    if (input.description !== undefined) {
      updateData.description = input.description;
    }

    if (input.status !== undefined) {
      updateData.status = input.status;
      // If status is resolved, set resolved_at timestamp
      if (input.status === 'resolved') {
        updateData.resolved_at = new Date();
      }
    }

    if (input.impact !== undefined) {
      updateData.impact = input.impact;
    }

    // Update incident record
    const result = await db.update(incidentsTable)
      .set(updateData)
      .where(eq(incidentsTable.id, input.incident_id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Incident with id ${input.incident_id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('Incident update failed:', error);
    throw error;
  }
};