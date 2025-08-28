import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  incidentsTable, 
  statusPagesTable, 
  organizationsTable, 
  componentsTable,
  incidentComponentsTable
} from '../db/schema';
import { type CreateIncidentInput } from '../schema';
import { createIncident } from '../handlers/create_incident';
import { eq } from 'drizzle-orm';

describe('createIncident', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a basic incident without components', async () => {
    // Create prerequisite organization and status page
    const orgResult = await db.insert(organizationsTable)
      .values({
        name: 'Test Org',
        slug: 'test-org',
        subscription_tier: 'free'
      })
      .returning()
      .execute();

    const statusPageResult = await db.insert(statusPagesTable)
      .values({
        organization_id: orgResult[0].id,
        name: 'Test Status Page',
        is_public: true
      })
      .returning()
      .execute();

    const testInput: CreateIncidentInput = {
      status_page_id: statusPageResult[0].id,
      name: 'Database Outage',
      description: 'Our database is experiencing connectivity issues',
      status: 'investigating',
      impact: 'major'
    };

    const result = await createIncident(testInput);

    // Validate returned incident
    expect(result.name).toEqual('Database Outage');
    expect(result.description).toEqual(testInput.description);
    expect(result.status).toEqual('investigating');
    expect(result.impact).toEqual('major');
    expect(result.status_page_id).toEqual(statusPageResult[0].id);
    expect(result.id).toBeDefined();
    expect(result.started_at).toBeInstanceOf(Date);
    expect(result.resolved_at).toBeNull();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save incident to database', async () => {
    // Create prerequisite data
    const orgResult = await db.insert(organizationsTable)
      .values({
        name: 'Test Org',
        slug: 'test-org'
      })
      .returning()
      .execute();

    const statusPageResult = await db.insert(statusPagesTable)
      .values({
        organization_id: orgResult[0].id,
        name: 'Test Status Page',
        is_public: true
      })
      .returning()
      .execute();

    const testInput: CreateIncidentInput = {
      status_page_id: statusPageResult[0].id,
      name: 'API Issues',
      description: 'API response times are elevated',
      status: 'identified',
      impact: 'minor'
    };

    const result = await createIncident(testInput);

    // Verify incident was saved to database
    const incidents = await db.select()
      .from(incidentsTable)
      .where(eq(incidentsTable.id, result.id))
      .execute();

    expect(incidents).toHaveLength(1);
    expect(incidents[0].name).toEqual('API Issues');
    expect(incidents[0].status).toEqual('identified');
    expect(incidents[0].impact).toEqual('minor');
  });

  it('should create incident with custom started_at timestamp', async () => {
    // Create prerequisite data
    const orgResult = await db.insert(organizationsTable)
      .values({
        name: 'Test Org',
        slug: 'test-org'
      })
      .returning()
      .execute();

    const statusPageResult = await db.insert(statusPagesTable)
      .values({
        organization_id: orgResult[0].id,
        name: 'Test Status Page'
      })
      .returning()
      .execute();

    const customStartTime = new Date('2023-01-15T10:00:00Z');
    const testInput: CreateIncidentInput = {
      status_page_id: statusPageResult[0].id,
      name: 'Network Issues',
      description: 'Network connectivity problems',
      status: 'investigating',
      impact: 'critical',
      started_at: customStartTime
    };

    const result = await createIncident(testInput);

    expect(result.started_at.getTime()).toEqual(customStartTime.getTime());
  });

  it('should create incident with affected components', async () => {
    // Create prerequisite data
    const orgResult = await db.insert(organizationsTable)
      .values({
        name: 'Test Org',
        slug: 'test-org'
      })
      .returning()
      .execute();

    const statusPageResult = await db.insert(statusPagesTable)
      .values({
        organization_id: orgResult[0].id,
        name: 'Test Status Page'
      })
      .returning()
      .execute();

    const component1Result = await db.insert(componentsTable)
      .values({
        status_page_id: statusPageResult[0].id,
        name: 'API Server',
        status: 'operational'
      })
      .returning()
      .execute();

    const component2Result = await db.insert(componentsTable)
      .values({
        status_page_id: statusPageResult[0].id,
        name: 'Database',
        status: 'operational'
      })
      .returning()
      .execute();

    const testInput: CreateIncidentInput = {
      status_page_id: statusPageResult[0].id,
      name: 'Service Disruption',
      description: 'Multiple services affected',
      status: 'investigating',
      impact: 'major',
      component_ids: [component1Result[0].id, component2Result[0].id]
    };

    const result = await createIncident(testInput);

    // Verify incident-component links were created
    const links = await db.select()
      .from(incidentComponentsTable)
      .where(eq(incidentComponentsTable.incident_id, result.id))
      .execute();

    expect(links).toHaveLength(2);
    expect(links.map(l => l.component_id)).toContain(component1Result[0].id);
    expect(links.map(l => l.component_id)).toContain(component2Result[0].id);
  });

  it('should update component statuses based on incident impact', async () => {
    // Create prerequisite data
    const orgResult = await db.insert(organizationsTable)
      .values({
        name: 'Test Org',
        slug: 'test-org'
      })
      .returning()
      .execute();

    const statusPageResult = await db.insert(statusPagesTable)
      .values({
        organization_id: orgResult[0].id,
        name: 'Test Status Page'
      })
      .returning()
      .execute();

    const componentResult = await db.insert(componentsTable)
      .values({
        status_page_id: statusPageResult[0].id,
        name: 'Web Server',
        status: 'operational'
      })
      .returning()
      .execute();

    const testInput: CreateIncidentInput = {
      status_page_id: statusPageResult[0].id,
      name: 'Critical Outage',
      description: 'Complete service failure',
      status: 'investigating',
      impact: 'critical',
      component_ids: [componentResult[0].id]
    };

    await createIncident(testInput);

    // Verify component status was updated
    const components = await db.select()
      .from(componentsTable)
      .where(eq(componentsTable.id, componentResult[0].id))
      .execute();

    expect(components[0].status).toEqual('major_outage');
  });

  it('should throw error for non-existent status page', async () => {
    const testInput: CreateIncidentInput = {
      status_page_id: 999,
      name: 'Test Incident',
      description: 'Test description',
      status: 'investigating',
      impact: 'minor'
    };

    expect(createIncident(testInput)).rejects.toThrow(/Status page with id 999 not found/i);
  });

  it('should throw error for invalid component ids', async () => {
    // Create prerequisite data
    const orgResult = await db.insert(organizationsTable)
      .values({
        name: 'Test Org',
        slug: 'test-org'
      })
      .returning()
      .execute();

    const statusPageResult = await db.insert(statusPagesTable)
      .values({
        organization_id: orgResult[0].id,
        name: 'Test Status Page'
      })
      .returning()
      .execute();

    const testInput: CreateIncidentInput = {
      status_page_id: statusPageResult[0].id,
      name: 'Test Incident',
      description: 'Test description',
      status: 'investigating',
      impact: 'minor',
      component_ids: [999, 1000] // Non-existent component IDs
    };

    expect(createIncident(testInput)).rejects.toThrow(/Components with ids 999, 1000 not found/i);
  });

  it('should throw error for components from different status page', async () => {
    // Create two organizations and status pages
    const org1Result = await db.insert(organizationsTable)
      .values({
        name: 'Test Org 1',
        slug: 'test-org-1'
      })
      .returning()
      .execute();

    const org2Result = await db.insert(organizationsTable)
      .values({
        name: 'Test Org 2',
        slug: 'test-org-2'
      })
      .returning()
      .execute();

    const statusPage1Result = await db.insert(statusPagesTable)
      .values({
        organization_id: org1Result[0].id,
        name: 'Status Page 1'
      })
      .returning()
      .execute();

    const statusPage2Result = await db.insert(statusPagesTable)
      .values({
        organization_id: org2Result[0].id,
        name: 'Status Page 2'
      })
      .returning()
      .execute();

    // Create component for second status page
    const componentResult = await db.insert(componentsTable)
      .values({
        status_page_id: statusPage2Result[0].id,
        name: 'Other Component',
        status: 'operational'
      })
      .returning()
      .execute();

    // Try to create incident on first status page using component from second
    const testInput: CreateIncidentInput = {
      status_page_id: statusPage1Result[0].id,
      name: 'Cross-page Incident',
      description: 'This should fail',
      status: 'investigating',
      impact: 'minor',
      component_ids: [componentResult[0].id]
    };

    expect(createIncident(testInput)).rejects.toThrow(/not found or don't belong to status page/i);
  });

  it('should handle different impact levels correctly', async () => {
    // Create prerequisite data
    const orgResult = await db.insert(organizationsTable)
      .values({
        name: 'Test Org',
        slug: 'test-org'
      })
      .returning()
      .execute();

    const statusPageResult = await db.insert(statusPagesTable)
      .values({
        organization_id: orgResult[0].id,
        name: 'Test Status Page'
      })
      .returning()
      .execute();

    const componentResult = await db.insert(componentsTable)
      .values({
        status_page_id: statusPageResult[0].id,
        name: 'Test Component',
        status: 'operational'
      })
      .returning()
      .execute();

    // Test minor impact
    const minorInput: CreateIncidentInput = {
      status_page_id: statusPageResult[0].id,
      name: 'Minor Issue',
      description: 'Minor performance degradation',
      status: 'investigating',
      impact: 'minor',
      component_ids: [componentResult[0].id]
    };

    await createIncident(minorInput);

    const component = await db.select()
      .from(componentsTable)
      .where(eq(componentsTable.id, componentResult[0].id))
      .execute();

    expect(component[0].status).toEqual('degraded_performance');
  });
});