// App services (ARCH-07 scoped context "services/DB"): repositories + credentials, created once at startup.
import { createContext, useContext, type ReactNode } from 'react';

import type { IdGenerator } from '@/data/db/ids';
import { createDiaryRepository, createRecentsRepository } from '@/data/db/repositories/diaryRepository';
import { createFoodsRepository } from '@/data/db/repositories/foodsRepository';
import { createGoalsRepository } from '@/data/db/repositories/goalsRepository';
import { createMealsRepository } from '@/data/db/repositories/mealsRepository';
import { createSettingsRepository } from '@/data/db/repositories/settingsRepository';
import { createWeightRepository } from '@/data/db/repositories/weightRepository';
import type { SqlDatabase } from '@/data/db/sql';
import { createCredentialsService, type CredentialsService } from '@/data/secure-storage/credentialsService';
import type { Clock } from '@/shared/dates';

export function createServices(db: SqlDatabase, clock: Clock, ids: IdGenerator, credentials?: CredentialsService) {
  const deps = { db, clock, ids };
  return {
    db,
    clock,
    settings: createSettingsRepository(deps),
    goals: createGoalsRepository(deps),
    meals: createMealsRepository(deps),
    foods: createFoodsRepository(deps),
    diary: createDiaryRepository(deps),
    recents: createRecentsRepository(deps),
    weight: createWeightRepository(deps),
    credentials: credentials ?? createCredentialsService(),
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
