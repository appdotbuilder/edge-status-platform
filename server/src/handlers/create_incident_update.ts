import { db } from '../db';
import { incidentUpdatesTable, incidentsTable } from '../db/schema';
import { type CreateIncidentUpdateInput, type IncidentUpdate } from '../schema';
import { eq } from 'drizzle-orm';

export const createIncidentUpdate = async (input: CreateIncidentUpdateInput): Promise<IncidentUpdate> => {
  try {
    // Verify the incident exists and get its current status
    const existingIncident = await db.select()
      .from(incidentsTable)
      .where(eq(incidentsTable.id, input.incident_id))
      .execute();

    if (existingIncident.length === 0) {
      throw new Error(`Incident with ID ${input.incident_id} not found`);
    }

    // Insert the incident update
    const result = await db.insert(incidentUpdatesTable)
      .values({
        incident_id: input.incident_id,
        title: input.title,
        body: input.body,
        status: input.status
      })
      .returning()
      .execute();

    const incidentUpdate = result[0];

    // Update the main incident status if it's different from the current status
    const currentIncident = existingIncident[0];
    if (currentIncident.status !== input.status) {
      await db.update(incidentsTable)
        .set({ 
          status: input.status,
          resolved_at: input.status === 'resolved' ? new Date() : null,
          updated_at: new Date()
        })
        .where(eq(incidentsTable.id, input.incident_id))
        .execute();
    }

    return incidentUpdate;
  } catch (error) {
    console.error('Incident update creation failed:', error);
    throw error;
  }
};