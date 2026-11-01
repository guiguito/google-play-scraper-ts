import { constants } from '../constants';

// ponytail: Play's /store/apps stopped rendering its category menu (Nov 2026) and no page lists them all,
// so return the known list (all verified live). Re-check constants.category if Google adds categories.
export async function categories(): Promise<string[]> {
  return Object.values(constants.category);
}

export default categories;
