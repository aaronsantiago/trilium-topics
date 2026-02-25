import { get, set } from 'idb-keyval';
import { page } from '$app/state';
import {topicsDbState} from './topicsDb.svelte.js';

let appState = $state({
  selectedTopic: '',
  selectedNoteName: '',
  selectedNoteId: ''
});

// initialize appState
(async () => {
  // load the initial values from idb
  appState.selectedTopic = await get('selectedTopic') || '';
  appState.selectedNoteName = await get('selectedNoteName') || '';
  appState.selectedNoteId = await get('selectedNoteId') || '';
})();

function initializeAppState() {
  $effect(() => {
    if (appState.selectedTopic) set('selectedTopic', appState.selectedTopic);
  });

  $effect(() => {
    if (appState.selectedNoteName) set('selectedNoteName', appState.selectedNoteName);
  });

  $effect(() => {
    if (appState.selectedNoteId) set('selectedNoteId', appState.selectedNoteId);
  });
}

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

export { appState, generateBreadcrumbs, initializeAppState };
