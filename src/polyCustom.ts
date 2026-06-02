import { AsyncLocalStorage } from 'node:async_hooks';

export const asyncLocalStorage = new AsyncLocalStorage({ defaultValue: {} });

type AuthData = {
  apiKeyId: string;
  apiKeyName: string;
  ssoUserId: string | null;
  identityProviderId: string | null;
  canSwitchEnvironments: boolean;
  createdAt: string;
  expiresAt: string | null;
  tenant: {
    id: string;
    name: string;
    email: string;
    ssoId: string;
    publicVisibilityAllowed: boolean;
    tierId: string;
    publicNamespace: string;
    enabled: boolean;
  };
  environment: {
    id: string;
    name: string;
    context: string;
    contextName: string;
    description: string;
    subdomain: string;
    logsDefault: boolean;
    metricsEnabled: boolean;
  };
  application: {
    id: string;
    name: string;
    subpath: string;
    description: string;
    visibility: 'ENVIRONMENT' | 'TENANT' | 'PUBLIC';
    config: {
      name: string;
      subpath?: string;
      icon?: string;
      collections: Record<string, unknown>[];
      login?: Record<string, unknown>;
      signUp?: Record<string, unknown>;
    };
  } | null;
  user: {
    id: string;
    name: string;
    email: string;
    ssoId: string;
    role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  } | null;
  permissions: {
    execute?: boolean;
    libraryGenerate?: boolean;
    useApplications?: boolean;
    manageApiFunctions?: boolean;
    manageWebhooks?: boolean;
    manageTriggers?: boolean;
    customDev?: boolean;
    manageGraphQLSubscriptions?: boolean;
    manageApplications?: boolean;
    manageSchemas?: boolean;
    authConfig?: boolean;
    manageSnippets?: boolean;
    manageVariables?: boolean;
    manageSecretVariables?: boolean;
    manageJobs?: boolean;
    manageUsers?: boolean;
    manageTenant?: boolean;
    manageTables?: boolean;
    queryTables?: boolean;
    [k: string]: unknown;
  };
  claims: Record<string, any>;
};

type PolyCustom = {
  readonly executionId: string;
  readonly functionId: string;
  readonly functionEnvironmentId: string;
  readonly functionTenantId: string;
  readonly executionApiKey: string | undefined | null;
  readonly userSessionId: string | undefined;
  readonly authData: Partial<AuthData>;
  readonly logsEnabled: boolean;
  readonly logRetentionGroup?: string;
  readonly baseUrl: string;
  readonly polyApiVersion: string;
  // Fields the user can use to customize their response
  responseStatusCode: number;
  responseContentType: string;
  responseHeaders: Record<string, string | string[]>;
};

export const polyCustom = new Proxy({} as PolyCustom, {
  get(_, prop) {
    const state = asyncLocalStorage.getStore();
    return state[prop];
  },
  set(_, prop, value) {
    const state = asyncLocalStorage.getStore();
    return (state[prop] = value);
  },
});

export async function executeWithPolyCustom(
  fn: () => Promise<unknown>,
  init: Partial<PolyCustom>,
) {
  return await asyncLocalStorage.run(init, () => {
    try {
      return Promise.resolve(fn())
        .then((data) => {
          const state = asyncLocalStorage.getStore() as PolyCustom;
          return {
            data,
            error: undefined,
            polyCustom: state,
          };
        });
    } catch (error) {
      const state = asyncLocalStorage.getStore() as PolyCustom;
      return {
        data: undefined,
        error,
        polyCustom: state,
      };
    }
  },
  );
}
