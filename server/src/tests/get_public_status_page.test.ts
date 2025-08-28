import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  organizationsTable, 
  statusPagesTable, 
  componentGroupsTable, 
  componentsTable, 
  incidentsTable, 
  maintenanceWindowsTable 
} from '../db/schema';
import { getPublicStatusPage } from '../handlers/get_public_status_page';

describe('getPublicStatusPage', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null for non-existent organization', async () => {
    const result = await getPublicStatusPage('non-existent-org');
    
    expect(result).toBeNull();
  });

  it('should return null for private status page', async () => {
    // Create organization
    const organization = await db.insert(organizationsTable)
      .values({
        name: 'Test Organization',
        slug: 'test-org',
        subscription_tier: 'free'
      })
      .returning()
      .execute();

    // Create private status page
    await db.insert(statusPagesTable)
      .values({
        organization_id: organization[0].id,
        name: 'Test Status Page',
        is_public: false
      })
      .execute();

    const result = await getPublicStatusPage('test-org');
    
    expect(result).toBeNull();
  });

  it('should return null for inactive organization', async () => {
    // Create inactive organization
    const organization = await db.insert(organizationsTable)
      .values({
        name: 'Inactive Organization',
        slug: 'inactive-org',
        subscription_tier: 'free',
        is_active: false
      })
      .returning()
      .execute();

    // Create public status page
    await db.insert(statusPagesTable)
      .values({
        organization_id: organization[0].id,
        name: 'Test Status Page',
        is_public: true
      })
      .execute();

    const result = await getPublicStatusPage('inactive-org');
    
    expect(result).toBeNull();
  });

  it('should return basic public status page data', async () => {
    // Create organization
    const organization = await db.insert(organizationsTable)
      .values({
        name: 'Test Organization',
        slug: 'test-org',
        subscription_tier: 'pro'
      })
      .returning()
      .execute();

    // Create public status page
    const statusPage = await db.insert(statusPagesTable)
      .values({
        organization_id: organization[0].id,
        name: 'Test Status Page',
        description: 'Our system status',
        domain: 'status.example.com',
        is_public: true
      })
      .returning()
      .execute();

    const result = await getPublicStatusPage('test-org');
    
    expect(result).not.toBeNull();
    expect(result!.status_page.id).toEqual(statusPage[0].id);
    expect(result!.status_page.name).toEqual('Test Status Page');
    expect(result!.status_page.description).toEqual('Our system status');
    expect(result!.status_page.domain).toEqual('status.example.com');
    expect(result!.status_page.is_public).toBe(true);
    expect(result!.overall_status).toEqual('operational');
    expect(result!.component_groups).toHaveLength(0);
    expect(result!.components).toHaveLength(0);
    expect(result!.active_incidents).toHaveLength(0);
    expect(result!.upcoming_maintenance).toHaveLength(0);
  });

  it('should return status page with component groups and components', async () => {
    // Create organization and status page
    const organization = await db.insert(organizationsTable)
      .values({
        name: 'Test Organization',
        slug: 'test-org',
        subscription_tier: 'free'
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

    // Create component groups
    const componentGroup1 = await db.insert(componentGroupsTable)
      .values({
        status_page_id: statusPage[0].id,
        name: 'Web Services',
        description: 'Main web applications',
        sort_order: 1
      })
      .returning()
      .execute();

    const componentGroup2 = await db.insert(componentGroupsTable)
      .values({
        status_page_id: statusPage[0].id,
        name: 'API Services',
        sort_order: 2
      })
      .returning()
      .execute();

    // Create components
    const component1 = await db.insert(componentsTable)
      .values({
        status_page_id: statusPage[0].id,
        component_group_id: componentGroup1[0].id,
        name: 'Main Website',
        description: 'Primary website',
        status: 'operational',
        sort_order: 1
      })
      .returning()
      .execute();

    const component2 = await db.insert(componentsTable)
      .values({
        status_page_id: statusPage[0].id,
        component_group_id: componentGroup2[0].id,
        name: 'REST API',
        status: 'degraded_performance',
        sort_order: 1
      })
      .returning()
      .execute();

    // Create invisible component (should not appear in results)
    await db.insert(componentsTable)
      .values({
        status_page_id: statusPage[0].id,
        name: 'Internal Service',
        status: 'operational',
        is_visible: false
      })
      .execute();

    const result = await getPublicStatusPage('test-org');
    
    expect(result).not.toBeNull();
    expect(result!.component_groups).toHaveLength(2);
    expect(result!.components).toHaveLength(2);
    expect(result!.overall_status).toEqual('degraded_performance');

    // Verify component groups
    const groups = result!.component_groups;
    expect(groups.find(g => g.id === componentGroup1[0].id)!.name).toEqual('Web Services');
    expect(groups.find(g => g.id === componentGroup2[0].id)!.name).toEqual('API Services');

    // Verify components
    const components = result!.components;
    expect(components.find(c => c.id === component1[0].id)!.name).toEqual('Main Website');
    expect(components.find(c => c.id === component2[0].id)!.name).toEqual('REST API');
    expect(components.find(c => c.name === 'Internal Service')).toBeUndefined();
  });

  it('should calculate overall status correctly with major outage', async () => {
    // Create organization and status page
    const organization = await db.insert(organizationsTable)
      .values({
        name: 'Test Organization',
        slug: 'test-org',
        subscription_tier: 'free'
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

    // Create components with different statuses
    await db.insert(componentsTable)
      .values([
        {
          status_page_id: statusPage[0].id,
          name: 'Component 1',
          status: 'operational'
        },
        {
          status_page_id: statusPage[0].id,
          name: 'Component 2',
          status: 'degraded_performance'
        },
        {
          status_page_id: statusPage[0].id,
          name: 'Component 3',
          status: 'major_outage'
        }
      ])
      .execute();

    const result = await getPublicStatusPage('test-org');
    
    expect(result).not.toBeNull();
    expect(result!.overall_status).toEqual('major_outage');
  });

  it('should calculate overall status correctly with partial outage', async () => {
    // Create organization and status page
    const organization = await db.insert(organizationsTable)
      .values({
        name: 'Test Organization',
        slug: 'test-org',
        subscription_tier: 'free'
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

    // Create components with partial outage (but no major outage)
    await db.insert(componentsTable)
      .values([
        {
          status_page_id: statusPage[0].id,
          name: 'Component 1',
          status: 'operational'
        },
        {
          status_page_id: statusPage[0].id,
          name: 'Component 2',
          status: 'partial_outage'
        }
      ])
      .execute();

    const result = await getPublicStatusPage('test-org');
    
    expect(result).not.toBeNull();
    expect(result!.overall_status).toEqual('partial_outage');
  });

  it('should include active incidents and exclude resolved ones', async () => {
    // Create organization and status page
    const organization = await db.insert(organizationsTable)
      .values({
        name: 'Test Organization',
        slug: 'test-org',
        subscription_tier: 'free'
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

    // Create incidents with different statuses
    await db.insert(incidentsTable)
      .values([
        {
          status_page_id: statusPage[0].id,
          name: 'Active Incident 1',
          description: 'Currently investigating',
          status: 'investigating',
          impact: 'major',
          started_at: new Date()
        },
        {
          status_page_id: statusPage[0].id,
          name: 'Active Incident 2',
          description: 'Issue identified',
          status: 'identified',
          impact: 'minor',
          started_at: new Date()
        },
        {
          status_page_id: statusPage[0].id,
          name: 'Monitoring Incident',
          description: 'Monitoring fix',
          status: 'monitoring',
          impact: 'minor',
          started_at: new Date()
        },
        {
          status_page_id: statusPage[0].id,
          name: 'Resolved Incident',
          description: 'This is resolved',
          status: 'resolved',
          impact: 'major',
          started_at: new Date(),
          resolved_at: new Date()
        }
      ])
      .execute();

    const result = await getPublicStatusPage('test-org');
    
    expect(result).not.toBeNull();
    expect(result!.active_incidents).toHaveLength(3);
    
    const incidentNames = result!.active_incidents.map(i => i.name);
    expect(incidentNames).toContain('Active Incident 1');
    expect(incidentNames).toContain('Active Incident 2');
    expect(incidentNames).toContain('Monitoring Incident');
    expect(incidentNames).not.toContain('Resolved Incident');
  });

  it('should include upcoming maintenance windows', async () => {
    // Create organization and status page
    const organization = await db.insert(organizationsTable)
      .values({
        name: 'Test Organization',
        slug: 'test-org',
        subscription_tier: 'free'
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

    // Create maintenance windows
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    await db.insert(maintenanceWindowsTable)
      .values([
        {
          status_page_id: statusPage[0].id,
          name: 'Upcoming Maintenance',
          description: 'Scheduled maintenance tomorrow',
          status: 'scheduled',
          scheduled_start: tomorrow,
          scheduled_end: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000) // 2 hours later
        },
        {
          status_page_id: statusPage[0].id,
          name: 'Past Maintenance',
          description: 'Maintenance that already happened',
          status: 'completed',
          scheduled_start: yesterday,
          scheduled_end: new Date(yesterday.getTime() + 2 * 60 * 60 * 1000)
        }
      ])
      .execute();

    const result = await getPublicStatusPage('test-org');
    
    expect(result).not.toBeNull();
    expect(result!.upcoming_maintenance).toHaveLength(1);
    expect(result!.upcoming_maintenance[0].name).toEqual('Upcoming Maintenance');
    expect(result!.upcoming_maintenance[0].status).toEqual('scheduled');
  });

  it('should handle components with under_maintenance status', async () => {
    // Create organization and status page
    const organization = await db.insert(organizationsTable)
      .values({
        name: 'Test Organization',
        slug: 'test-org',
        subscription_tier: 'free'
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

    // Create component under maintenance
    await db.insert(componentsTable)
      .values({
        status_page_id: statusPage[0].id,
        name: 'Maintenance Component',
        status: 'under_maintenance'
      })
      .execute();

    const result = await getPublicStatusPage('test-org');
    
    expect(result).not.toBeNull();
    expect(result!.overall_status).toEqual('under_maintenance');
  });
});