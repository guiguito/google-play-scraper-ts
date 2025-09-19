import * as cheerio from 'cheerio';
import { BASE_URL } from '../constants';
import { request } from '../http/client';

const PLAYSTORE_URL = `${BASE_URL}/store/apps`;
const CATEGORY_URL_PREFIX = '/store/apps/category/';

export async function categories() {
  const html = await request({ url: PLAYSTORE_URL, method: 'GET' });
  const $ = cheerio.load(html);
  const categoryIds = $('ul li a')
    .toArray()
    .map((el) => $(el).attr('href') || '')
    .filter((url) => url.startsWith(CATEGORY_URL_PREFIX) && !url.includes('?age='))
    .map((url) => url.substr(CATEGORY_URL_PREFIX.length));
  categoryIds.push('APPLICATION');
  return categoryIds;
}

export default categories;

