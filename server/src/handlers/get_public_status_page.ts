import { db } from '../db';
import { organizationsTable, statusPagesTable, componentGroupsTable, componentsTable, incidentsTable, maintenanceWindowsTable } from '../db/schema';
import { type PublicStatusPage } from '../schema';
import { eq, and, gte, lte, SQL } from 'drizzle-orm';

export const getPublicStatusPage = async (slug: string): Promise<PublicStatusPage | null> => {
  try {
    // Query organization by slug and get its status page
    const organizationResults = await db.select({
      organization: organizationsTable,
      statusPage: statusPagesTable
    })
      .from(organizationsTable)
      .innerJoin(statusPagesTable, eq(statusPagesTable.organization_id, organizationsTable.id))
      .where(
        and(
          eq(organizationsTable.slug, slug),
          eq(statusPagesTable.is_public, true),
          eq(organizationsTable.is_active, true)
        )
      )
      .execute();

    if (organizationResults.length === 0) {
      return null;
    }

    const statusPage = organizationResults[0].statusPage;

    // Fetch component groups
    const componentGroups = await db.select()
      .from(componentGroupsTable)
      .where(eq(componentGroupsTable.status_page_id, statusPage.id))
      .execute();

    // Fetch components
    const components = await db.select()
      .from(componentsTable)
      .where(
        and(
          eq(componentsTable.status_page_id, statusPage.id),
          eq(componentsTable.is_visible, true)
        )
      )
      .execute();

    // Fetch active incidents (not resolved)
    const conditions: SQL<unknown>[] = [
      eq(incidentsTable.status_page_id, statusPage.id)
    ];
    conditions.push(eq(incidentsTable.status, 'investigating'));
    conditions.push(eq(incidentsTable.status, 'identified'));
    conditions.push(eq(incidentsTable.status, 'monitoring'));

    // Query for active incidents with multiple status conditions
    const activeIncidents = await db.select()
      .from(incidentsTable)
      .where(eq(incidentsTable.status_page_id, statusPage.id))
      .execute();

    // Filter active incidents (not resolved) in memory
    const filteredActiveIncidents = activeIncidents.filter(incident => 
      incident.status !== 'resolved'
    );

    // Fetch upcoming maintenance windows
    const now = new Date();
    const upcomingMaintenance = await db.select()
      .from(maintenanceWindowsTable)
      .where(
        and(
          eq(maintenanceWindowsTable.status_page_id, statusPage.id),
          gte(maintenanceWindowsTable.scheduled_start, now)
        )
      )
      .execute();

    // Calculate overall status based on component statuses
    let overallStatus: 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage' | 'under_maintenance' = 'operational';
    
    if (components.length > 0) {
      const hasOutage = components.some(c => c.status === 'major_outage');
      const hasPartialOutage = components.some(c => c.status === 'partial_outage');
      const hasDegraded = components.some(c => c.status === 'degraded_performance');
      const hasMaintenance = components.some(c => c.status === 'under_maintenance');

      if (hasOutage) {
        overallStatus = 'major_outage';
      } else if (hasPartialOutage) {
        overallStatus = 'partial_outage';
      } else if (hasDegraded) {
        overallStatus = 'degraded_performance';
      } else if (hasMaintenance) {
        overallStatus = 'under_maintenance';
      }
    }

    return {
      status_page: statusPage,
      overall_status: overallStatus,
      component_groups: componentGroups,
      components: components,
      active_incidents: filteredActiveIncidents,
      upcoming_maintenance: upcomingMaintenance
    };
  } catch (error) {
    console.error('Failed to fetch public status page:', error);
    throw error;
  }
};