import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { incidentsTable, organizationsTable, statusPagesTable } from '../db/schema';
import { type UpdateIncidentInput } from '../schema';
import { updateIncident } from '../handlers/update_incident';
import { eq } from 'drizzle-orm';

describe('updateIncident', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testIncidentId: number;
  let testStatusPageId: number;

  beforeEach(async () => {
    // Create prerequisite data
    const organization = await db.insert(organizationsTable)
      .values({
        name: 'Test Org',
        slug: 'test-org',
        subscription_tier: 'pro'
      })
      .returning()
      .execute();

    const statusPage = await db.insert(statusPagesTable)
      .values({
        organization_id: organization[0].id,
        name: 'Test Status Page',
        is_public: true
      })
      .returning()
      .execute();

    testStatusPageId = statusPage[0].id;

    // Create test incident
    const incident = await db.insert(incidentsTable)
      .values({
        status_page_id: testStatusPageId,
        name: 'Original Incident Name',
        description: 'Original incident description',
        status: 'investigating',
        impact: 'minor',
        started_at: new Date('2024-01-01T10:00:00Z')
      })
      .returning()
      .execute();

    testIncidentId = incident[0].id;
  });

  it('should update incident name', async () => {
    const updateInput: UpdateIncidentInput = {
      incident_id: testIncidentId,
      name: 'Updated Incident Name'
    };

    const result = await updateIncident(updateInput);

    expect(result.id).toEqual(testIncidentId);
    expect(result.name).toEqual('Updated Incident Name');
    expect(result.description).toEqual('Original incident description');
    expect(result.status).toEqual('investigating');
    expect(result.impact).toEqual('minor');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update incident description', async () => {
    const updateInput: UpdateIncidentInput = {
      incident_id: testIncidentId,
      description: 'Updated incident description with more details'
    };

    const result = await updateIncident(updateInput);

    expect(result.id).toEqual(testIncidentId);
    expect(result.name).toEqual('Original Incident Name');
    expect(result.description).toEqual('Updated incident description with more details');
    expect(result.status).toEqual('investigating');
    expect(result.impact).toEqual('minor');
  });

  it('should update incident status', async () => {
    const updateInput: UpdateIncidentInput = {
      incident_id: testIncidentId,
      status: 'identified'
    };

    const result = await updateIncident(updateInput);

    expect(result.id).toEqual(testIncidentId);
    expect(result.status).toEqual('identified');
    expect(result.resolved_at).toBeNull();
  });

  it('should update incident impact', async () => {
    const updateInput: UpdateIncidentInput = {
      incident_id: testIncidentId,
      impact: 'major'
    };

    const result = await updateIncident(updateInput);

    expect(result.id).toEqual(testIncidentId);
    expect(result.impact).toEqual('major');
  });

  it('should update multiple fields at once', async () => {
    const updateInput: UpdateIncidentInput = {
      incident_id: testIncidentId,
      name: 'Multi-field Update',
      description: 'Updated description and status',
      status: 'monitoring',
      impact: 'critical'
    };

    const result = await updateIncident(updateInput);

    expect(result.id).toEqual(testIncidentId);
    expect(result.name).toEqual('Multi-field Update');
    expect(result.description).toEqual('Updated description and status');
    expect(result.status).toEqual('monitoring');
    expect(result.impact).toEqual('critical');
    expect(result.resolved_at).toBeNull();
  });

  it('should set resolved_at when status is resolved', async () => {
    const updateInput: UpdateIncidentInput = {
      incident_id: testIncidentId,
      status: 'resolved'
    };

    const result = await updateIncident(updateInput);

    expect(result.id).toEqual(testIncidentId);
    expect(result.status).toEqual('resolved');
    expect(result.resolved_at).toBeInstanceOf(Date);
    expect(result.resolved_at).not.toBeNull();
  });

  it('should save changes to database', async () => {
    const updateInput: UpdateIncidentInput = {
      incident_id: testIncidentId,
      name: 'Database Update Test',
      status: 'resolved'
    };

    await updateIncident(updateInput);

    // Verify changes are persisted in database
    const incidents = await db.select()
      .from(incidentsTable)
      .where(eq(incidentsTable.id, testIncidentId))
      .execute();

    expect(incidents).toHaveLength(1);
    expect(incidents[0].name).toEqual('Database Update Test');
    expect(incidents[0].status).toEqual('resolved');
    expect(incidents[0].resolved_at).toBeInstanceOf(Date);
    expect(incidents[0].updated_at).toBeInstanceOf(Date);
  });

  it('should update updated_at timestamp', async () => {
    // Get original updated_at
    const originalIncident = await db.select()
      .from(incidentsTable)
      .where(eq(incidentsTable.id, testIncidentId))
      .execute();

    const originalUpdatedAt = originalIncident[0].updated_at;

    // Wait a small amount to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const updateInput: UpdateIncidentInput = {
      incident_id: testIncidentId,
      name: 'Timestamp Update Test'
    };

    const result = await updateIncident(updateInput);

    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should throw error for non-existent incident', async () => {
    const updateInput: UpdateIncidentInput = {
      incident_id: 99999,
      name: 'Non-existent Incident'
    };

    expect(updateIncident(updateInput)).rejects.toThrow(/Incident with id 99999 not found/i);
  });

  it('should handle partial updates correctly', async () => {
    // Update only status
    const statusUpdate: UpdateIncidentInput = {
      incident_id: testIncidentId,
      status: 'identified'
    };

    const statusResult = await updateIncident(statusUpdate);
    expect(statusResult.status).toEqual('identified');
    expect(statusResult.name).toEqual('Original Incident Name'); // Should remain unchanged

    // Update only impact
    const impactUpdate: UpdateIncidentInput = {
      incident_id: testIncidentId,
      impact: 'major'
    };

    const impactResult = await updateIncident(impactUpdate);
    expect(impactResult.impact).toEqual('major');
    expect(impactResult.status).toEqual('identified'); // Should remain from previous update
    expect(impactResult.name).toEqual('Original Incident Name'); // Should remain unchanged
  });

  it('should preserve original fields when not specified in update', async () => {
    const originalIncident = await db.select()
      .from(incidentsTable)
      .where(eq(incidentsTable.id, testIncidentId))
      .execute();

    const originalData = originalIncident[0];

    const updateInput: UpdateIncidentInput = {
      incident_id: testIncidentId,
      name: 'Only Name Changed'
    };

    const result = await updateIncident(updateInput);

    // Updated field
    expect(result.name).toEqual('Only Name Changed');
    
    // Preserved fields
    expect(result.description).toEqual(originalData.description);
    expect(result.status).toEqual(originalData.status);
    expect(result.impact).toEqual(originalData.impact);
    expect(result.status_page_id).toEqual(originalData.status_page_id);
    expect(result.started_at.getTime()).toEqual(originalData.started_at.getTime());
  });
});