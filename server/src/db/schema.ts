import { serial, text, pgTable, timestamp, boolean, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Define enums
export const subscriptionTierEnum = pgEnum('subscription_tier', ['free', 'starter', 'pro', 'enterprise']);
export const componentStatusEnum = pgEnum('component_status', ['operational', 'degraded_performance', 'partial_outage', 'major_outage', 'under_maintenance']);
export const incidentStatusEnum = pgEnum('incident_status', ['investigating', 'identified', 'monitoring', 'resolved']);
export const incidentImpactEnum = pgEnum('incident_impact', ['none', 'minor', 'major', 'critical']);
export const maintenanceStatusEnum = pgEnum('maintenance_status', ['scheduled', 'in_progress', 'completed']);
export const userRoleEnum = pgEnum('user_role', ['admin', 'editor', 'viewer']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  role: userRoleEnum('role').notNull().default('viewer'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Organizations table
export const organizationsTable = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  subscription_tier: subscriptionTierEnum('subscription_tier').notNull().default('free'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Organization members junction table
export const organizationMembersTable = pgTable('organization_members', {
  id: serial('id').primaryKey(),
  organization_id: integer('organization_id').notNull().references(() => organizationsTable.id),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  role: userRoleEnum('role').notNull().default('viewer'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Status pages table
export const statusPagesTable = pgTable('status_pages', {
  id: serial('id').primaryKey(),
  organization_id: integer('organization_id').notNull().references(() => organizationsTable.id),
  name: text('name').notNull(),
  description: text('description'),
  domain: text('domain'),
  custom_css: text('custom_css'),
  logo_url: text('logo_url'),
  is_public: boolean('is_public').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Component groups table
export const componentGroupsTable = pgTable('component_groups', {
  id: serial('id').primaryKey(),
  status_page_id: integer('status_page_id').notNull().references(() => statusPagesTable.id),
  name: text('name').notNull(),
  description: text('description'),
  sort_order: integer('sort_order').notNull().default(0),
  is_collapsed: boolean('is_collapsed').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Components table
export const componentsTable = pgTable('components', {
  id: serial('id').primaryKey(),
  status_page_id: integer('status_page_id').notNull().references(() => statusPagesTable.id),
  component_group_id: integer('component_group_id').references(() => componentGroupsTable.id),
  name: text('name').notNull(),
  description: text('description'),
  status: componentStatusEnum('status').notNull().default('operational'),
  sort_order: integer('sort_order').notNull().default(0),
  is_visible: boolean('is_visible').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Incidents table
export const incidentsTable = pgTable('incidents', {
  id: serial('id').primaryKey(),
  status_page_id: integer('status_page_id').notNull().references(() => statusPagesTable.id),
  name: text('name').notNull(),
  description: text('description').notNull(),
  status: incidentStatusEnum('status').notNull().default('investigating'),
  impact: incidentImpactEnum('impact').notNull(),
  started_at: timestamp('started_at').defaultNow().notNull(),
  resolved_at: timestamp('resolved_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Incident updates table
export const incidentUpdatesTable = pgTable('incident_updates', {
  id: serial('id').primaryKey(),
  incident_id: integer('incident_id').notNull().references(() => incidentsTable.id),
  title: text('title').notNull(),
  body: text('body').notNull(),
  status: incidentStatusEnum('status').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Incident affected components junction table
export const incidentComponentsTable = pgTable('incident_components', {
  id: serial('id').primaryKey(),
  incident_id: integer('incident_id').notNull().references(() => incidentsTable.id),
  component_id: integer('component_id').notNull().references(() => componentsTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Maintenance windows table
export const maintenanceWindowsTable = pgTable('maintenance_windows', {
  id: serial('id').primaryKey(),
  status_page_id: integer('status_page_id').notNull().references(() => statusPagesTable.id),
  name: text('name').notNull(),
  description: text('description').notNull(),
  status: maintenanceStatusEnum('status').notNull().default('scheduled'),
  scheduled_start: timestamp('scheduled_start').notNull(),
  scheduled_end: timestamp('scheduled_end').notNull(),
  actual_start: timestamp('actual_start'),
  actual_end: timestamp('actual_end'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Maintenance window affected components junction table
export const maintenanceComponentsTable = pgTable('maintenance_components', {
  id: serial('id').primaryKey(),
  maintenance_window_id: integer('maintenance_window_id').notNull().references(() => maintenanceWindowsTable.id),
  component_id: integer('component_id').notNull().references(() => componentsTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// User subscriptions table
export const subscriptionsTable = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').references(() => usersTable.id),
  status_page_id: integer('status_page_id').notNull().references(() => statusPagesTable.id),
  email: text('email').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  subscribed_to_incidents: boolean('subscribed_to_incidents').notNull().default(true),
  subscribed_to_maintenance: boolean('subscribed_to_maintenance').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Metrics table for uptime tracking
export const metricsTable = pgTable('metrics', {
  id: serial('id').primaryKey(),
  component_id: integer('component_id').notNull().references(() => componentsTable.id),
  timestamp: timestamp('timestamp').notNull(),
  status: componentStatusEnum('status').notNull(),
  response_time: integer('response_time'), // in milliseconds
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Define relations
export const organizationsRelations = relations(organizationsTable, ({ many }) => ({
  members: many(organizationMembersTable),
  statusPages: many(statusPagesTable),
}));

export const usersRelations = relations(usersTable, ({ many }) => ({
  organizationMemberships: many(organizationMembersTable),
  subscriptions: many(subscriptionsTable),
}));

export const organizationMembersRelations = relations(organizationMembersTable, ({ one }) => ({
  organization: one(organizationsTable, {
    fields: [organizationMembersTable.organization_id],
    references: [organizationsTable.id],
  }),
  user: one(usersTable, {
    fields: [organizationMembersTable.user_id],
    references: [usersTable.id],
  }),
}));

export const statusPagesRelations = relations(statusPagesTable, ({ one, many }) => ({
  organization: one(organizationsTable, {
    fields: [statusPagesTable.organization_id],
    references: [organizationsTable.id],
  }),
  componentGroups: many(componentGroupsTable),
  components: many(componentsTable),
  incidents: many(incidentsTable),
  maintenanceWindows: many(maintenanceWindowsTable),
  subscriptions: many(subscriptionsTable),
}));

export const componentGroupsRelations = relations(componentGroupsTable, ({ one, many }) => ({
  statusPage: one(statusPagesTable, {
    fields: [componentGroupsTable.status_page_id],
    references: [statusPagesTable.id],
  }),
  components: many(componentsTable),
}));

export const componentsRelations = relations(componentsTable, ({ one, many }) => ({
  statusPage: one(statusPagesTable, {
    fields: [componentsTable.status_page_id],
    references: [statusPagesTable.id],
  }),
  componentGroup: one(componentGroupsTable, {
    fields: [componentsTable.component_group_id],
    references: [componentGroupsTable.id],
  }),
  incidentComponents: many(incidentComponentsTable),
  maintenanceComponents: many(maintenanceComponentsTable),
  metrics: many(metricsTable),
}));

export const incidentsRelations = relations(incidentsTable, ({ one, many }) => ({
  statusPage: one(statusPagesTable, {
    fields: [incidentsTable.status_page_id],
    references: [statusPagesTable.id],
  }),
  updates: many(incidentUpdatesTable),
  affectedComponents: many(incidentComponentsTable),
}));

export const incidentUpdatesRelations = relations(incidentUpdatesTable, ({ one }) => ({
  incident: one(incidentsTable, {
    fields: [incidentUpdatesTable.incident_id],
    references: [incidentsTable.id],
  }),
}));

export const incidentComponentsRelations = relations(incidentComponentsTable, ({ one }) => ({
  incident: one(incidentsTable, {
    fields: [incidentComponentsTable.incident_id],
    references: [incidentsTable.id],
  }),
  component: one(componentsTable, {
    fields: [incidentComponentsTable.component_id],
    references: [componentsTable.id],
  }),
}));

export const maintenanceWindowsRelations = relations(maintenanceWindowsTable, ({ one, many }) => ({
  statusPage: one(statusPagesTable, {
    fields: [maintenanceWindowsTable.status_page_id],
    references: [statusPagesTable.id],
  }),
  affectedComponents: many(maintenanceComponentsTable),
}));

export const maintenanceComponentsRelations = relations(maintenanceComponentsTable, ({ one }) => ({
  maintenanceWindow: one(maintenanceWindowsTable, {
    fields: [maintenanceComponentsTable.maintenance_window_id],
    references: [maintenanceWindowsTable.id],
  }),
  component: one(componentsTable, {
    fields: [maintenanceComponentsTable.component_id],
    references: [componentsTable.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptionsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [subscriptionsTable.user_id],
    references: [usersTable.id],
  }),
  statusPage: one(statusPagesTable, {
    fields: [subscriptionsTable.status_page_id],
    references: [statusPagesTable.id],
  }),
}));

export const metricsRelations = relations(metricsTable, ({ one }) => ({
  component: one(componentsTable, {
    fields: [metricsTable.component_id],
    references: [componentsTable.id],
  }),
}));

// Export all tables for relation queries
export const tables = {
  users: usersTable,
  organizations: organizationsTable,
  organizationMembers: organizationMembersTable,
  statusPages: statusPagesTable,
  componentGroups: componentGroupsTable,
  components: componentsTable,
  incidents: incidentsTable,
  incidentUpdates: incidentUpdatesTable,
  incidentComponents: incidentComponentsTable,
  maintenanceWindows: maintenanceWindowsTable,
  maintenanceComponents: maintenanceComponentsTable,
  subscriptions: subscriptionsTable,
  metrics: metricsTable,
};

// TypeScript types for the tables
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type Organization = typeof organizationsTable.$inferSelect;
export type NewOrganization = typeof organizationsTable.$inferInsert;
export type StatusPage = typeof statusPagesTable.$inferSelect;
export type NewStatusPage = typeof statusPagesTable.$inferInsert;
export type ComponentGroup = typeof componentGroupsTable.$inferSelect;
export type NewComponentGroup = typeof componentGroupsTable.$inferInsert;
export type Component = typeof componentsTable.$inferSelect;
export type NewComponent = typeof componentsTable.$inferInsert;
export type Incident = typeof incidentsTable.$inferSelect;
export type NewIncident = typeof incidentsTable.$inferInsert;
export type IncidentUpdate = typeof incidentUpdatesTable.$inferSelect;
export type NewIncidentUpdate = typeof incidentUpdatesTable.$inferInsert;
export type MaintenanceWindow = typeof maintenanceWindowsTable.$inferSelect;
export type NewMaintenanceWindow = typeof maintenanceWindowsTable.$inferInsert;
export type Subscription = typeof subscriptionsTable.$inferSelect;
export type NewSubscription = typeof subscriptionsTable.$inferInsert;
export type Metric = typeof metricsTable.$inferSelect;
export type NewMetric = typeof metricsTable.$inferInsert;