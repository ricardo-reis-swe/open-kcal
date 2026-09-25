// Canonical units and conversions (DATA-04). Storage is always kg / g / ml / kcal; convert only for input and
// display, at full precision (rounding is a display concern).

export type WeightUnit = 'kg' | 'lb';
export type FoodWeightUnit = 'g' | 'oz';
export type EnergyUnit = 'kcal' | 'kJ';
export type VolumeUnit = 'ml' | 'fl_oz';

export type UnitPreferences = {
  weightUnit: WeightUnit;
  foodWeightUnit: FoodWeightUnit;
  energyUnit: EnergyUnit;
  volumeUnit: VolumeUnit;
};

export const KG_PER_LB = 0.45359237;
export const G_PER_OZ = 28.349523125;
export const ML_PER_FL_OZ = 29.5735295625;
export const KJ_PER_KCAL = 4.184;

/** Body weight: canonical kg → display unit. */
export function weightFromKg(kg: number, unit: WeightUnit): number {
  switch (unit) {
    case 'kg':
      return kg;
    case 'lb':
      return kg / KG_PER_LB;
  }
}

/** Body weight: display unit → canonical kg. */
export function weightToKg(value: number, unit: WeightUnit): number {
  switch (unit) {
    case 'kg':
      return value;
    case 'lb':
      return value * KG_PER_LB;
  }
}

export function foodWeightFromG(g: number, unit: FoodWeightUnit): number {
  switch (unit) {
    case 'g':
      return g;
    case 'oz':
      return g / G_PER_OZ;
  }
}

export function foodWeightToG(value: number, unit: FoodWeightUnit): number {
  switch (unit) {
    case 'g':
      return value;
    case 'oz':
      return value * G_PER_OZ;
  }
}

export function volumeFromMl(ml: number, unit: VolumeUnit): number {
  switch (unit) {
    case 'ml':
      return ml;
    case 'fl_oz':
      return ml / ML_PER_FL_OZ;
  }
}

export function volumeToMl(value: number, unit: VolumeUnit): number {
  switch (unit) {
    case 'ml':
      return value;
    case 'fl_oz':
      return value * ML_PER_FL_OZ;
  }
}

export function energyFromKcal(kcal: number, unit: EnergyUnit): number {
  switch (unit) {
    case 'kcal':
      return kcal;
    case 'kJ':
      return kcal * KJ_PER_KCAL;
  }
}

export function energyToKcal(value: number, unit: EnergyUnit): number {
  switch (unit) {
    case 'kcal':
      return value;
    case 'kJ':
      return value / KJ_PER_KCAL;
  }
}

export const METRIC_UNITS: UnitPreferences = {
  weightUnit: 'kg',
  foodWeightUnit: 'g',
  energyUnit: 'kcal',
  volumeUnit: 'ml',
};
const US_UNITS: UnitPreferences = { weightUnit: 'lb', foodWeightUnit: 'oz', energyUnit: 'kcal', volumeUnit: 'fl_oz' };

/**
 * First-launch unit defaults from the device's measurement system (DATA-17). US customary → lb / oz / fl oz;
 * anything else, or unknown, falls back to metric. Energy defaults to kcal everywhere (the app's canonical unit).
 */
export function defaultUnitPreferences(measurementSystem: string | null | undefined): UnitPreferences {
  return measurementSystem === 'us' ? US_UNITS : METRIC_UNITS;
}
