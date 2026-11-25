import { dashboard } from '@/mocks/data'
import { fetchResource } from './api'

export const dashboardService = { get: () => fetchResource('/dashboard', () => dashboard) }
