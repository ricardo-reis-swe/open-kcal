#!/usr/bin/env node
// Dev-only PROV-13 recorder. It deliberately writes only fields read by the adapter.
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const key = process.env.USDA_CAPTURE_KEY;

const outputDirectory = new URL('../src/data/api/usda/__fixtures__/captured/', import.meta.url);
const baseUrl = 'https://api.nal.usda.gov/fdc/v1';
// PROV-05 energy/macros + PROV-14 catalog numbers.
const mappedNutrientNumbers = new Set([
  '208',
  '958',
  '957',
  '268',
  '203',
  '204',
  '205',
  '205.2',
  '291',
  '269',
  '269.3',
  '539',
  '606',
  '645',
  '646',
  '605',
  '601',
  '307',
  '306',
  '301',
  '303',
  '304',
  '305',
  '309',
  '320',
  '401',
  '328',
  '324',
  '323',
  '430',
  '404',
  '405',
  '406',
  '415',
  '418',
  '435',
  '417',
  '262',
]);

const scalar = (value) => (typeof value === 'string' || typeof value === 'number' ? value : undefined);
const text = (value) => (typeof value === 'string' ? value : undefined);
const object = (value) => (value && typeof value === 'object' ? value : {});

function searchNutrients(values) {
  return Array.isArray(values)
    ? values
        .map((value) => object(value))
        .map((value) => ({
          nutrientNumber: scalar(value.nutrientNumber),
          unitName: text(value.unitName),
          value: scalar(value.value),
        }))
        .filter(
          (value) =>
            value.nutrientNumber !== undefined &&
            mappedNutrientNumbers.has(String(value.nutrientNumber)) &&
            value.unitName !== undefined &&
            value.value !== undefined,
        )
    : [];
}

function detailNutrients(values) {
  return Array.isArray(values)
    ? values
        .map((value) => object(value))
        .map((value) => {
          const nutrient = object(value.nutrient);
          return {
            nutrient: { number: scalar(nutrient.number), unitName: text(nutrient.unitName) },
            ...(scalar(value.amount) === undefined ? {} : { amount: scalar(value.amount) }),
          };
        })
        .filter(
          (value) =>
            value.nutrient.number !== undefined &&
            mappedNutrientNumbers.has(String(value.nutrient.number)) &&
            value.nutrient.unitName !== undefined,
        )
    : [];
}

function common(value) {
  const item = object(value);
  const pick = (name) => scalar(item[name]);
  return Object.fromEntries(
    [
      ['fdcId', pick('fdcId')],
      ['description', text(item.description)],
      ['dataType', text(item.dataType)],
      ['brandOwner', text(item.brandOwner)],
      ['brandName', text(item.brandName)],
      ['servingSize', pick('servingSize')],
      ['servingSizeUnit', text(item.servingSizeUnit)],
      ['householdServingFullText', text(item.householdServingFullText)],
    ].filter(([, value]) => value !== undefined),
  );
}

function labelNutrients(value) {
  const labels = object(value);
  const result = {};
  for (const name of [
    'calories',
    'protein',
    'fat',
    'carbohydrates',
    'fiber',
    'sugars',
    'addedSugar',
    'saturatedFat',
    'transFat',
    'cholesterol',
    'sodium',
    'potassium',
    'calcium',
    'iron',
  ]) {
    const item = object(labels[name]);
    if (scalar(item.value) !== undefined) result[name] = { value: scalar(item.value) };
  }
  return Object.keys(result).length ? result : undefined;
}

function trimSearchFood(value) {
  const item = object(value);
  return { ...common(item), foodNutrients: searchNutrients(item.foodNutrients) };
}

function trimDetail(value) {
  const item = object(value);
  const portions = Array.isArray(item.foodPortions)
    ? item.foodPortions.map((value) => {
        const portion = object(value);
        const measure = object(portion.measureUnit);
        return Object.fromEntries(
          [
            ['amount', scalar(portion.amount)],
            ['gramWeight', scalar(portion.gramWeight)],
            ['modifier', text(portion.modifier)],
            ['portionDescription', text(portion.portionDescription)],
            ['measureUnit', text(measure.name) === undefined ? undefined : { name: text(measure.name) }],
          ].filter(([, value]) => value !== undefined),
        );
      })
    : [];
  return {
    ...common(item),
    foodNutrients: detailNutrients(item.foodNutrients),
    foodPortions: portions,
    ...(labelNutrients(item.labelNutrients) === undefined
      ? {}
      : { labelNutrients: labelNutrients(item.labelNutrients) }),
  };
}

async function request(path) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { 'X-Api-Key': key } });
  if (!response.ok) throw new Error(`USDA capture request failed (${response.status})`);
  return response.json();
}

await mkdir(outputDirectory, { recursive: true });
const ids = ['747997', '174980', '2705413', '2035482'];
if (process.argv.includes('--sanitize-existing')) {
  const search = object(JSON.parse(await readFile(new URL('search-egg.json', outputDirectory), 'utf8')));
  await writeFile(
    new URL('search-egg.json', outputDirectory),
    `${JSON.stringify({ foods: (Array.isArray(search.foods) ? search.foods : []).map(trimSearchFood), currentPage: scalar(search.currentPage), totalPages: scalar(search.totalPages) }, null, 2)}\n`,
  );
  for (const id of ids) {
    const food = JSON.parse(await readFile(new URL(`detail-${id}.json`, outputDirectory), 'utf8'));
    await writeFile(new URL(`detail-${id}.json`, outputDirectory), `${JSON.stringify(trimDetail(food), null, 2)}\n`);
  }
} else {
  if (!key || !key.trim()) throw new Error('USDA_CAPTURE_KEY is required');
  const search = object(
    await request(
      '/foods/search?query=egg&dataType=Foundation%2CSR%20Legacy%2CSurvey%20(FNDDS)%2CBranded&pageSize=20&pageNumber=1',
    ),
  );
  const searchFixture = {
    foods: (Array.isArray(search.foods) ? search.foods : []).map(trimSearchFood),
    currentPage: scalar(search.currentPage),
    totalPages: scalar(search.totalPages),
  };
  await writeFile(new URL('search-egg.json', outputDirectory), `${JSON.stringify(searchFixture, null, 2)}\n`);
  for (const id of ids) {
    const food = await request(`/food/${id}?format=full`);
    await writeFile(new URL(`detail-${id}.json`, outputDirectory), `${JSON.stringify(trimDetail(food), null, 2)}\n`);
  }
}
