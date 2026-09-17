import { setupWorker } from 'msw/browser'

import { handlers } from './handlers'

/** Service Worker, перехватывающий запросы к API в демо-режиме. */
export const worker = setupWorker(...handlers)
