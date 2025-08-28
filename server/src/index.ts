import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createUserInputSchema,
  createOrganizationInputSchema,
  createStatusPageInputSchema,
  createComponentGroupInputSchema,
  createComponentInputSchema,
  updateComponentStatusInputSchema,
  createIncidentInputSchema,
  updateIncidentInputSchema,
  createIncidentUpdateInputSchema,
  createMaintenanceWindowInputSchema,
  createSubscriptionInputSchema,
  createMetricInputSchema
} from './schema';

// Import handlers
import { createUser } from './handlers/create_user';
import { getUsers } from './handlers/get_users';
import { createOrganization } from './handlers/create_organization';
import { getOrganizations } from './handlers/get_organizations';
import { createStatusPage } from './handlers/create_status_page';
import { getStatusPages } from './handlers/get_status_pages';
import { getPublicStatusPage } from './handlers/get_public_status_page';
import { createComponentGroup } from './handlers/create_component_group';
import { createComponent } from './handlers/create_component';
import { updateComponentStatus } from './handlers/update_component_status';
import { getComponents } from './handlers/get_components';
import { createIncident } from './handlers/create_incident';
import { updateIncident } from './handlers/update_incident';
import { createIncidentUpdate } from './handlers/create_incident_update';
import { getIncidents } from './handlers/get_incidents';
import { createMaintenanceWindow } from './handlers/create_maintenance_window';
import { getMaintenanceWindows } from './handlers/get_maintenance_windows';
import { createSubscription } from './handlers/create_subscription';
import { createMetric } from './handlers/create_metric';
import { getComponentMetrics } from './handlers/get_component_metrics';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User management
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),

  getUsers: publicProcedure
    .query(() => getUsers()),

  // Organization management
  createOrganization: publicProcedure
    .input(createOrganizationInputSchema)
    .mutation(({ input }) => createOrganization(input)),

  getOrganizations: publicProcedure
    .query(() => getOrganizations()),

  // Status page management
  createStatusPage: publicProcedure
    .input(createStatusPageInputSchema)
    .mutation(({ input }) => createStatusPage(input)),

  getStatusPages: publicProcedure
    .input(z.object({ organizationId: z.number().optional() }))
    .query(({ input }) => getStatusPages(input.organizationId)),

  // Public status page (no auth required)
  getPublicStatusPage: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(({ input }) => getPublicStatusPage(input.slug)),

  // Component group management
  createComponentGroup: publicProcedure
    .input(createComponentGroupInputSchema)
    .mutation(({ input }) => createComponentGroup(input)),

  // Component management
  createComponent: publicProcedure
    .input(createComponentInputSchema)
    .mutation(({ input }) => createComponent(input)),

  updateComponentStatus: publicProcedure
    .input(updateComponentStatusInputSchema)
    .mutation(({ input }) => updateComponentStatus(input)),

  getComponents: publicProcedure
    .input(z.object({ statusPageId: z.number() }))
    .query(({ input }) => getComponents(input.statusPageId)),

  // Incident management
  createIncident: publicProcedure
    .input(createIncidentInputSchema)
    .mutation(({ input }) => createIncident(input)),

  updateIncident: publicProcedure
    .input(updateIncidentInputSchema)
    .mutation(({ input }) => updateIncident(input)),

  createIncidentUpdate: publicProcedure
    .input(createIncidentUpdateInputSchema)
    .mutation(({ input }) => createIncidentUpdate(input)),

  getIncidents: publicProcedure
    .input(z.object({ statusPageId: z.number() }))
    .query(({ input }) => getIncidents(input.statusPageId)),

  // Maintenance window management
  createMaintenanceWindow: publicProcedure
    .input(createMaintenanceWindowInputSchema)
    .mutation(({ input }) => createMaintenanceWindow(input)),

  getMaintenanceWindows: publicProcedure
    .input(z.object({ statusPageId: z.number() }))
    .query(({ input }) => getMaintenanceWindows(input.statusPageId)),

  // Subscription management
  createSubscription: publicProcedure
    .input(createSubscriptionInputSchema)
    .mutation(({ input }) => createSubscription(input)),

  // Metrics and monitoring
  createMetric: publicProcedure
    .input(createMetricInputSchema)
    .mutation(({ input }) => createMetric(input)),

  getComponentMetrics: publicProcedure
    .input(z.object({ 
      componentId: z.number(),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional()
    }))
    .query(({ input }) => getComponentMetrics(input.componentId, input.startDate, input.endDate)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();