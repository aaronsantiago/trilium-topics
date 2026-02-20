import { get, set } from 'idb-keyval';
import { page } from '$app/state';
import {topicsDbState} from './topicsDb.svelte.js';

let appState = $state({
  selectedTopic: '',
  selectedNoteName: '',
  selectedNoteId: '',
});

function generateBreadcrumbs() {
  let breadcrumbs = page.url.pathname.split('/').filter(Boolean); // Remove leading slash

  breadcrumbs.unshift(topicsDbState.triliumUrl);
  if (breadcrumbs.includes('topic')) {
    breadcrumbs.splice(breadcrumbs.indexOf('topic'), 1, appState.selectedTopic);
  }
  if (breadcrumbs.includes('note')) {
    breadcrumbs.splice(breadcrumbs.indexOf('note'), 0, appState.selectedTopic);
    breadcrumbs.splice(breadcrumbs.indexOf('note'), 1, appState.selectedNoteName);
  }

  return breadcrumbs;
}

export { appState, generateBreadcrumbs };
