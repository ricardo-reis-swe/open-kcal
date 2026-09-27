// App services (ARCH-07 scoped context "services/DB"): repositories + credentials, created once at startup.
import { createContext, useContext, type ReactNode } from 'react';

import type { IdGenerator } from '@/data/db/ids';
import { createDiaryRepository, createRecentsRepository } from '@/data/db/repositories/diaryRepository';
import { createFoodsRepository } from '@/data/db/repositories/foodsRepository';
import { createGoalsRepository } from '@/data/db/repositories/goalsRepository';
import { createMealsRepository } from '@/data/db/repositories/mealsRepository';
import { createSettingsRepository } from '@/data/db/repositories/settingsRepository';
import { createWeightRepository } from '@/data/db/repositories/weightRepository';
import { OpenFoodFactsClient } from '@/data/api/open-food-facts/client';
import { UsdaClient } from '@/data/api/usda/client';
import type { SqlDatabase } from '@/data/db/sql';
import { createCredentialsService, type CredentialsService } from '@/data/secure-storage/credentialsService';
import type { AppConfig } from '@/shared/config/env';
import type { Clock } from '@/shared/dates';

export function createServices({
  db,
  clock,
  ids,
  config,
  credentials,
}: {
  db: SqlDatabase;
  clock: Clock;
  ids: IdGenerator;
  config: AppConfig;
  credentials?: CredentialsService;
}) {
  const deps = { db, clock, ids };
  const resolvedCredentials = credentials ?? createCredentialsService();
  return {
    db,
    clock,
    config,
    settings: createSettingsRepository(deps),
    goals: createGoalsRepository(deps),
    meals: createMealsRepository(deps),
    foods: createFoodsRepository(deps),
    diary: createDiaryRepository(deps),
    recents: createRecentsRepository(deps),
    weight: createWeightRepository(deps),
    credentials: resolvedCredentials,
    openFoodFacts: new OpenFoodFactsClient(config),
    usda: new UsdaClient(config, resolvedCredentials),
  };
}

export type AppServices = ReturnType<typeof createServices>;

const ServicesContext = createContext<AppServices | null>(null);

export function ServicesProvider({ services, children }: { services: AppServices; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

/** Screens reach data only through services/query hooks, never SQL (DATA-18). */
export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside ServicesProvider');
  return services;
}
