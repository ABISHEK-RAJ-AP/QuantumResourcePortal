import { qre } from '@/api/qre'

export type DemoSimulationStatus = {
  available?: boolean
  demo_data?: boolean
  enabled?: boolean
  paused?: boolean
  scenario?: number
  tick_count?: number
  last_tick_at?: string | null
  mode?: 'simulation' | 'static'
}

export async function fetchDemoSimulationStatus() {
  return qre<DemoSimulationStatus>('/demo-simulation/status')
}

export async function startDemoSimulation(scenario = 1) {
  return qre<DemoSimulationStatus>('/admin/demo-simulation/start', {
    method: 'POST',
    body: JSON.stringify({ scenario }),
  })
}

export async function pauseDemoSimulation() {
  return qre<DemoSimulationStatus>('/admin/demo-simulation/pause', { method: 'POST' })
}

export async function resumeDemoSimulation() {
  return qre<DemoSimulationStatus>('/admin/demo-simulation/resume', { method: 'POST' })
}

export async function stopDemoSimulation() {
  return qre<DemoSimulationStatus>('/admin/demo-simulation/stop', { method: 'POST' })
}

export async function tickDemoSimulation() {
  return qre<DemoSimulationStatus>('/admin/demo-simulation/tick', { method: 'POST' })
}