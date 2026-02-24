import { EXPLORE_CACHE_TTL } from '../../shared/constants.js';
import { api } from './api.js';

let _exploreCache = null;
let _chartsCache = null;
let _exploreCacheTime = 0;
let _chartsCacheTime = 0;

export async function fetchExploreData() {
  const now = Date.now();
  if (_exploreCache && now - _exploreCacheTime < EXPLORE_CACHE_TTL) return _exploreCache;
  _exploreCache = await api.explore();
  _exploreCacheTime = now;
  return _exploreCache;
}

export async function fetchChartsData() {
  const now = Date.now();
  if (_chartsCache && now - _chartsCacheTime < EXPLORE_CACHE_TTL) return _chartsCache;
  _chartsCache = await api.charts();
  _chartsCacheTime = now;
  return _chartsCache;
}

export function invalidateExploreCache() {
  _exploreCache = null;
  _chartsCache = null;
  _exploreCacheTime = 0;
  _chartsCacheTime = 0;
}
