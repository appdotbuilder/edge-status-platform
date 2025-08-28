import { db } from '../db';
import { incidentsTable, componentsTable, incidentComponentsTable, statusPagesTable } from '../db/schema';
import { type CreateIncidentInput, type Incident } from '../schema';
import { eq, and } from 'drizzle-orm';

export const createIncident = async (input: CreateIncidentInput): Promise<Incident> => {
  try {
    // Validate that the status page exists
    const statusPage = await db.select()
      .from(statusPagesTable)
      .where(eq(statusPagesTable.id, input.status_page_id))
      .execute();
    
    if (statusPage.length === 0) {
      throw new Error(`Status page with id ${input.status_page_id} not found`);
    }

    // If component_ids are provided, validate they exist and belong to the status page
    if (input.component_ids && input.component_ids.length > 0) {
      const components = await db.select()
        .from(componentsTable)
        .where(
          and(
            eq(componentsTable.status_page_id, input.status_page_id)
          )
        )
        .execute();
      
      const validComponentIds = components.map(c => c.id);
      const invalidComponents = input.component_ids.filter(id => !validComponentIds.includes(id));
      
      if (invalidComponents.length > 0) {
        throw new Error(`Components with ids ${invalidComponents.join(', ')} not found or don't belong to status page ${input.status_page_id}`);
      }
    }

    // Create the incident
    const incidentResult = await db.insert(incidentsTable)
      .values({
        status_page_id: input.status_page_id,
        name: input.name,
        description: input.description,
        status: input.status,
        impact: input.impact,
        started_at: input.started_at || new Date()
      })
      .returning()
      .execute();

    const incident = incidentResult[0];

    // Link affected components if provided
    if (input.component_ids && input.component_ids.length > 0) {
      const componentLinks = input.component_ids.map(componentId => ({
        incident_id: incident.id,
        component_id: componentId
      }));

      await db.insert(incidentComponentsTable)
        .values(componentLinks)
        .execute();

      // Update component statuses based on incident impact
      let newComponentStatus: 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage' | 'under_maintenance';
      
      switch (input.impact) {
        case 'critical':
          newComponentStatus = 'major_outage';
          break;
        case 'major':
          newComponentStatus = 'partial_outage';
          break;
        case 'minor':
          newComponentStatus = 'degraded_performance';
          break;
        default:
          newComponentStatus = 'operational';
      }

      // Only update component status if it's more severe than current status
      if (newComponentStatus !== 'operational') {
        for (const componentId of input.component_ids) {
          await db.update(componentsTable)
            .set({ 
              status: newComponentStatus,
              updated_at: new Date()
            })
            .where(eq(componentsTable.id, componentId))
            .execute();
        }
      }
    }

    return incident;
  } catch (error) {
    console.error('Incident creation failed:', error);
    throw error;
  }
};