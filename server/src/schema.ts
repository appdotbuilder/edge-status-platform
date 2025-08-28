import { z } from 'zod';

// Enums
export const subscriptionTierEnum = z.enum(['free', 'starter', 'pro', 'enterprise']);
export const componentStatusEnum = z.enum(['operational', 'degraded_performance', 'partial_outage', 'major_outage', 'under_maintenance']);
export const incidentStatusEnum = z.enum(['investigating', 'identified', 'monitoring', 'resolved']);
export const incidentImpactEnum = z.enum(['none', 'minor', 'major', 'critical']);
export const maintenanceStatusEnum = z.enum(['scheduled', 'in_progress', 'completed']);
export const userRoleEnum = z.enum(['admin', 'editor', 'viewer']);

// User schemas
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  role: userRoleEnum,
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

export const createUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string(),
  last_name: z.string(),
  role: userRoleEnum.default('viewer')
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

// Organization schemas
export const organizationSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  subscription_tier: subscriptionTierEnum,
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Organization = z.infer<typeof organizationSchema>;

export const createOrganizationInputSchema = z.object({
  name: z.string(),
  slug: z.string(),
  subscription_tier: subscriptionTierEnum.default('free')
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationInputSchema>;

// Status page schemas
export const statusPageSchema = z.object({
  id: z.number(),
  organization_id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  domain: z.string().nullable(),
  custom_css: z.string().nullable(),
  logo_url: z.string().nullable(),
  is_public: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type StatusPage = z.infer<typeof statusPageSchema>;

export const createStatusPageInputSchema = z.object({
  organization_id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  domain: z.string().nullable().optional(),
  is_public: z.boolean().default(true)
});

export type CreateStatusPageInput = z.infer<typeof createStatusPageInputSchema>;

// Component group schemas
export const componentGroupSchema = z.object({
  id: z.number(),
  status_page_id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  sort_order: z.number().int(),
  is_collapsed: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type ComponentGroup = z.infer<typeof componentGroupSchema>;

export const createComponentGroupInputSchema = z.object({
  status_page_id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
  is_collapsed: z.boolean().default(false)
});

export type CreateComponentGroupInput = z.infer<typeof createComponentGroupInputSchema>;

// Component schemas
export const componentSchema = z.object({
  id: z.number(),
  status_page_id: z.number(),
  component_group_id: z.number().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  status: componentStatusEnum,
  sort_order: z.number().int(),
  is_visible: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Component = z.infer<typeof componentSchema>;

export const createComponentInputSchema = z.object({
  status_page_id: z.number(),
  component_group_id: z.number().nullable().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  status: componentStatusEnum.default('operational'),
  sort_order: z.number().int().default(0),
  is_visible: z.boolean().default(true)
});

export type CreateComponentInput = z.infer<typeof createComponentInputSchema>;

export const updateComponentStatusInputSchema = z.object({
  component_id: z.number(),
  status: componentStatusEnum
});

export type UpdateComponentStatusInput = z.infer<typeof updateComponentStatusInputSchema>;

// Incident schemas
export const incidentSchema = z.object({
  id: z.number(),
  status_page_id: z.number(),
  name: z.string(),
  description: z.string(),
  status: incidentStatusEnum,
  impact: incidentImpactEnum,
  started_at: z.coerce.date(),
  resolved_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Incident = z.infer<typeof incidentSchema>;

export const createIncidentInputSchema = z.object({
  status_page_id: z.number(),
  name: z.string(),
  description: z.string(),
  status: incidentStatusEnum.default('investigating'),
  impact: incidentImpactEnum,
  started_at: z.coerce.date().optional(),
  component_ids: z.array(z.number()).optional()
});

export type CreateIncidentInput = z.infer<typeof createIncidentInputSchema>;

export const updateIncidentInputSchema = z.object({
  incident_id: z.number(),
  name: z.string().optional(),
  description: z.string().optional(),
  status: incidentStatusEnum.optional(),
  impact: incidentImpactEnum.optional()
});

export type UpdateIncidentInput = z.infer<typeof updateIncidentInputSchema>;

// Incident update schemas
export const incidentUpdateSchema = z.object({
  id: z.number(),
  incident_id: z.number(),
  title: z.string(),
  body: z.string(),
  status: incidentStatusEnum,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type IncidentUpdate = z.infer<typeof incidentUpdateSchema>;

export const createIncidentUpdateInputSchema = z.object({
  incident_id: z.number(),
  title: z.string(),
  body: z.string(),
  status: incidentStatusEnum
});

export type CreateIncidentUpdateInput = z.infer<typeof createIncidentUpdateInputSchema>;

// Maintenance window schemas
export const maintenanceWindowSchema = z.object({
  id: z.number(),
  status_page_id: z.number(),
  name: z.string(),
  description: z.string(),
  status: maintenanceStatusEnum,
  scheduled_start: z.coerce.date(),
  scheduled_end: z.coerce.date(),
  actual_start: z.coerce.date().nullable(),
  actual_end: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type MaintenanceWindow = z.infer<typeof maintenanceWindowSchema>;

export const createMaintenanceWindowInputSchema = z.object({
  status_page_id: z.number(),
  name: z.string(),
  description: z.string(),
  scheduled_start: z.coerce.date(),
  scheduled_end: z.coerce.date(),
  component_ids: z.array(z.number()).optional()
});

export type CreateMaintenanceWindowInput = z.infer<typeof createMaintenanceWindowInputSchema>;

// Subscription schemas
export const subscriptionSchema = z.object({
  id: z.number(),
  user_id: z.number().nullable(),
  status_page_id: z.number(),
  email: z.string().email(),
  is_active: z.boolean(),
  subscribed_to_incidents: z.boolean(),
  subscribed_to_maintenance: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Subscription = z.infer<typeof subscriptionSchema>;

export const createSubscriptionInputSchema = z.object({
  status_page_id: z.number(),
  email: z.string().email(),
  subscribed_to_incidents: z.boolean().default(true),
  subscribed_to_maintenance: z.boolean().default(true)
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionInputSchema>;

// Metric schemas for uptime tracking
export const metricSchema = z.object({
  id: z.number(),
  component_id: z.number(),
  timestamp: z.coerce.date(),
  status: componentStatusEnum,
  response_time: z.number().nullable(),
  created_at: z.coerce.date()
});

export type Metric = z.infer<typeof metricSchema>;

export const createMetricInputSchema = z.object({
  component_id: z.number(),
  timestamp: z.coerce.date(),
  status: componentStatusEnum,
  response_time: z.number().nullable().optional()
});

export type CreateMetricInput = z.infer<typeof createMetricInputSchema>;

// Public status page response schema
export const publicStatusPageSchema = z.object({
  status_page: statusPageSchema,
  overall_status: componentStatusEnum,
  component_groups: z.array(componentGroupSchema),
  components: z.array(componentSchema),
  active_incidents: z.array(incidentSchema),
  upcoming_maintenance: z.array(maintenanceWindowSchema)
});

export type PublicStatusPage = z.infer<typeof publicStatusPageSchema>;