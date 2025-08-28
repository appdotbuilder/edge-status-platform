import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { organizationsTable, statusPagesTable, incidentsTable } from '../db/schema';
import { type CreateOrganizationInput, type CreateStatusPageInput, type CreateIncidentInput } from '../schema';
import { getIncidents } from '../handlers/get_incidents';

describe('getIncidents', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return incidents for a status page', async () => {
    // Create prerequisite data
    const org = await db.insert(organizationsTable)
      .values({
        name: 'Test Organization',
        slug: 'test-org'
      })
      .returning()
      .execute();

    const statusPage = await db.insert(statusPagesTable)
      .values({
        organization_id: org[0].id,
        name: 'Test Status Page'
      })
      .returning()
      .execute();

    const incident1 = await db.insert(incidentsTable)
      .values({
        status_page_id: statusPage[0].id,
        name: 'Database Outage',
        description: 'Database is experiencing issues',
        impact: 'major',
        started_at: new Date('2024-01-01T10:00:00Z')
      })
      .returning()
      .execute();

    const incident2 = await db.insert(incidentsTable)
      .values({
        status_page_id: statusPage[0].id,
        name: 'API Slowness',
        description: 'API response times are degraded',
        impact: 'minor',
        started_at: new Date('2024-01-01T11:00:00Z')
      })
      .returning()
      .execute();

    const results = await getIncidents(statusPage[0].id);

    expect(results).toHaveLength(2);
    
    // Should be ordered by created_at desc (newest first)
    expect(results[0].name).toBe('API Slowness');
    expect(results[1].name).toBe('Database Outage');

    // Verify all incident fields are returned
    expect(results[0].id).toBeDefined();
    expect(results[0].status_page_id).toBe(statusPage[0].id);
    expect(results[0].description).toBe('API response times are degraded');
    expect(results[0].status).toBe('investigating');
    expect(results[0].impact).toBe('minor');
    expect(results[0].started_at).toBeInstanceOf(Date);
    expect(results[0].resolved_at).toBeNull();
    expect(results[0].created_at).toBeInstanceOf(Date);
    expect(results[0].updated_at).toBeInstanceOf(Date);
  });

  it('should return empty array when no incidents exist', async () => {
    // Create status page without incidents
    const org = await db.insert(organizationsTable)
      .values({
        name: 'Test Organization',
        slug: 'test-org'
      })
      .returning()
      .execute();

    const statusPage = await db.insert(statusPagesTable)
      .values({
        organization_id: org[0].id,
        name: 'Test Status Page'
      })
      .returning()
      .execute();

    const results = await getIncidents(statusPage[0].id);

    expect(results).toHaveLength(0);
  });

  it('should return only incidents for specified status page', async () => {
    // Create two status pages
    const org = await db.insert(organizationsTable)
      .values({
        name: 'Test Organization',
        slug: 'test-org'
      })
      .returning()
      .execute();

    const statusPage1 = await db.insert(statusPagesTable)
      .values({
        organization_id: org[0].id,
        name: 'Status Page 1'
      })
      .returning()
      .execute();

    const statusPage2 = await db.insert(statusPagesTable)
      .values({
        organization_id: org[0].id,
        name: 'Status Page 2'
      })
      .returning()
      .execute();

    // Create incidents for both status pages
    await db.insert(incidentsTable)
      .values({
        status_page_id: statusPage1[0].id,
        name: 'Incident 1',
        description: 'First incident',
        impact: 'minor'
      })
      .execute();

    await db.insert(incidentsTable)
      .values({
        status_page_id: statusPage2[0].id,
        name: 'Incident 2',
        description: 'Second incident',
        impact: 'major'
      })
      .execute();

    const results = await getIncidents(statusPage1[0].id);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Incident 1');
    expect(results[0].status_page_id).toBe(statusPage1[0].id);
  });

  it('should handle different incident statuses correctly', async () => {
    const org = await db.insert(organizationsTable)
      .values({
        name: 'Test Organization',
        slug: 'test-org'
      })
      .returning()
      .execute();

    const statusPage = await db.insert(statusPagesTable)
      .values({
        organization_id: org[0].id,
        name: 'Test Status Page'
      })
      .returning()
      .execute();

    await db.insert(incidentsTable)
      .values({
        status_page_id: statusPage[0].id,
        name: 'Resolved Incident',
        description: 'This incident is resolved',
        impact: 'minor',
        status: 'resolved',
        resolved_at: new Date()
      })
      .execute();

    await db.insert(incidentsTable)
      .values({
        status_page_id: statusPage[0].id,
        name: 'Active Incident',
        description: 'This incident is being monitored',
        impact: 'major',
        status: 'monitoring'
      })
      .execute();

    const results = await getIncidents(statusPage[0].id);

    expect(results).toHaveLength(2);
    
    const resolvedIncident = results.find(i => i.name === 'Resolved Incident');
    const activeIncident = results.find(i => i.name === 'Active Incident');

    expect(resolvedIncident?.status).toBe('resolved');
    expect(resolvedIncident?.resolved_at).toBeInstanceOf(Date);
    expect(activeIncident?.status).toBe('monitoring');
    expect(activeIncident?.resolved_at).toBeNull();
  });

  it('should handle non-existent status page gracefully', async () => {
    const results = await getIncidents(99999);
    expect(results).toHaveLength(0);
  });
});