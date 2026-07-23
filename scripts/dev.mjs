import { spawn } from 'node:child_process'

const children = [
  spawn('npm', ['run', 'dev:web'], { stdio: 'inherit' }),
  spawn('npm', ['run', 'dev:api'], { stdio: 'inherit' }),
]

function stop(signal = 'SIGTERM') {
  children.forEach((child) => child.kill(signal))
}
process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop())
children.forEach((child) => child.on('exit', (code) => {
  if (code && code !== 0) { stop(); process.exitCode = code }
}))
