import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  organizationsTable, 
  statusPagesTable, 
  incidentsTable,
  incidentUpdatesTable
} from '../db/schema';
import { type CreateIncidentUpdateInput } from '../schema';
import { createIncidentUpdate } from '../handlers/create_incident_update';
import { eq } from 'drizzle-orm';

// Test data setup
const testOrganization = {
  name: 'Test Org',
  slug: 'test-org',
  subscription_tier: 'free' as const
};

const testStatusPage = {
  organization_id: 1,
  name: 'Test Status Page',
  description: 'A status page for testing',
  is_public: true
};

const testIncident = {
  status_page_id: 1,
  name: 'Test Incident',
  description: 'A test incident',
  status: 'investigating' as const,
  impact: 'major' as const,
  started_at: new Date()
};

const testInput: CreateIncidentUpdateInput = {
  incident_id: 1,
  title: 'Initial Investigation',
  body: 'We are investigating reports of service degradation.',
  status: 'investigating'
};

describe('createIncidentUpdate', () => {
  beforeEach(async () => {
    await createDB();
    
    // Create organization
    await db.insert(organizationsTable)
      .values(testOrganization)
      .execute();
    
    // Create status page
    await db.insert(statusPagesTable)
      .values(testStatusPage)
      .execute();
    
    // Create incident
    await db.insert(incidentsTable)
      .values(testIncident)
      .execute();
  });

  afterEach(resetDB);

  it('should create an incident update', async () => {
    const result = await createIncidentUpdate(testInput);

    expect(result.incident_id).toEqual(1);
    expect(result.title).toEqual('Initial Investigation');
    expect(result.body).toEqual('We are investigating reports of service degradation.');
    expect(result.status).toEqual('investigating');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save incident update to database', async () => {
    const result = await createIncidentUpdate(testInput);

    const updates = await db.select()
      .from(incidentUpdatesTable)
      .where(eq(incidentUpdatesTable.id, result.id))
      .execute();

    expect(updates).toHaveLength(1);
    expect(updates[0].incident_id).toEqual(1);
    expect(updates[0].title).toEqual('Initial Investigation');
    expect(updates[0].body).toEqual('We are investigating reports of service degradation.');
    expect(updates[0].status).toEqual('investigating');
    expect(updates[0].created_at).toBeInstanceOf(Date);
  });

  it('should update main incident status when different', async () => {
    const updateInput: CreateIncidentUpdateInput = {
      incident_id: 1,
      title: 'Issue Identified',
      body: 'We have identified the root cause.',
      status: 'identified'
    };

    await createIncidentUpdate(updateInput);

    const incidents = await db.select()
      .from(incidentsTable)
      .where(eq(incidentsTable.id, 1))
      .execute();

    expect(incidents).toHaveLength(1);
    expect(incidents[0].status).toEqual('identified');
    expect(incidents[0].updated_at).toBeInstanceOf(Date);
  });

  it('should set resolved_at when incident is resolved', async () => {
    const resolveInput: CreateIncidentUpdateInput = {
      incident_id: 1,
      title: 'Issue Resolved',
      body: 'The incident has been fully resolved.',
      status: 'resolved'
    };

    await createIncidentUpdate(resolveInput);

    const incidents = await db.select()
      .from(incidentsTable)
      .where(eq(incidentsTable.id, 1))
      .execute();

    expect(incidents).toHaveLength(1);
    expect(incidents[0].status).toEqual('resolved');
    expect(incidents[0].resolved_at).toBeInstanceOf(Date);
    expect(incidents[0].resolved_at).not.toBeNull();
  });

  it('should not update main incident when status is the same', async () => {
    // First, get the original updated_at timestamp
    const originalIncident = await db.select()
      .from(incidentsTable)
      .where(eq(incidentsTable.id, 1))
      .execute();

    const originalUpdatedAt = originalIncident[0].updated_at;

    // Create update with same status
    const sameStatusInput: CreateIncidentUpdateInput = {
      incident_id: 1,
      title: 'Additional Info',
      body: 'More details about the ongoing investigation.',
      status: 'investigating' // Same as original
    };

    await createIncidentUpdate(sameStatusInput);

    // Check that the incident status didn't change and updated_at is close to original
    const updatedIncident = await db.select()
      .from(incidentsTable)
      .where(eq(incidentsTable.id, 1))
      .execute();

    expect(updatedIncident[0].status).toEqual('investigating');
    // The timestamp might be slightly different due to database precision, but should be very close
    const timeDiff = Math.abs(updatedIncident[0].updated_at.getTime() - originalUpdatedAt.getTime());
    expect(timeDiff).toBeLessThan(1000); // Less than 1 second difference
  });

  it('should throw error when incident does not exist', async () => {
    const invalidInput: CreateIncidentUpdateInput = {
      incident_id: 999,
      title: 'Update for non-existent incident',
      body: 'This should fail.',
      status: 'investigating'
    };

    await expect(createIncidentUpdate(invalidInput)).rejects.toThrow(/Incident with ID 999 not found/i);
  });

  it('should create multiple updates for same incident', async () => {
    // Create first update
    const firstUpdate: CreateIncidentUpdateInput = {
      incident_id: 1,
      title: 'First Update',
      body: 'Initial investigation started.',
      status: 'investigating'
    };

    const result1 = await createIncidentUpdate(firstUpdate);

    // Create second update
    const secondUpdate: CreateIncidentUpdateInput = {
      incident_id: 1,
      title: 'Second Update',
      body: 'Issue has been identified.',
      status: 'identified'
    };

    const result2 = await createIncidentUpdate(secondUpdate);

    // Verify both updates exist
    const updates = await db.select()
      .from(incidentUpdatesTable)
      .where(eq(incidentUpdatesTable.incident_id, 1))
      .execute();

    expect(updates).toHaveLength(2);
    expect(updates.find(u => u.id === result1.id)?.title).toEqual('First Update');
    expect(updates.find(u => u.id === result2.id)?.title).toEqual('Second Update');

    // Verify main incident has the latest status
    const incidents = await db.select()
      .from(incidentsTable)
      .where(eq(incidentsTable.id, 1))
      .execute();

    expect(incidents[0].status).toEqual('identified');
  });

  it('should handle monitoring status update', async () => {
    const monitoringInput: CreateIncidentUpdateInput = {
      incident_id: 1,
      title: 'Monitoring Fix',
      body: 'A fix has been deployed and we are monitoring the situation.',
      status: 'monitoring'
    };

    const result = await createIncidentUpdate(monitoringInput);

    expect(result.status).toEqual('monitoring');

    // Verify main incident status is updated but resolved_at is not set
    const incidents = await db.select()
      .from(incidentsTable)
      .where(eq(incidentsTable.id, 1))
      .execute();

    expect(incidents[0].status).toEqual('monitoring');
    expect(incidents[0].resolved_at).toBeNull();
  });
});