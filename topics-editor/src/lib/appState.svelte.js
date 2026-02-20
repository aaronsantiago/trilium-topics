import { get, set } from 'idb-keyval';
import { page } from '$app/state';
import {topicsDbState} from './topicsDb.svelte.js';

let appState = $state({
  selectedTopic: ''
});

function generateBreadcrumbs() {
  let breadcrumbs = page.url.pathname.split('/').filter(Boolean); // Remove leading slash

  breadcrumbs.unshift(topicsDbState.triliumUrl);
  if (breadcrumbs.includes('topic')) {
    breadcrumbs.splice(breadcrumbs.indexOf('topic'), 1, appState.selectedTopic);
  }

  return breadcrumbs;
}

export { appState, generateBreadcrumbs };
