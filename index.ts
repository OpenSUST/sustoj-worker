import io from 'socket.io-client'
import del from 'del'
import * as sandbox from 'simple-sandbox'
import * as lzma from 'lzma-native'
import { exec } from 'child_process'
import { join, resolve } from 'path'
import fs, { promises as fsp } from 'fs'

const terminationHandler = () => process.exit()

process.on('SIGTERM', terminationHandler)
process.on('SIGINT', terminationHandler)

interface Language { name: string, compile?: string, args?: string[], exec: string, memory?: number, time?: number }

interface Config {
  token: string
  master: string
  process: number
  user: string
  rootfs: string
  outputLimit: number
  environments: string[]
  language: Record<string, Language>
}

if (!fs.existsSync('data')) fs.mkdirSync('data')
if (!fs.existsSync('config.json')) fs.writeFileSync('config.json', JSON.stringify({
  token: '',
  master: 'http://localhost:23333/',
  process: 2,
  user: 'sandbox',
  rootfs: '/opt/rootfs',
  outputLimit: 1024 * 1024 * 5, // 5MB
  environments: [],
  language: {
    c: {
      name: 'main.c',
      compile: 'gcc main.c -o main -fno-asm -Wall -lm --static -DONLINE_JUDGE',
      exec: './main'
    },
    cpp: {
      name: 'main.cpp',
      compile: 'g++ -fno-asm -Wall -lm --static -DONLINE_JUDGE -o main main.cpp',
      exec: './main'
    },
    java: {
      name: 'Main.java',
      compile: 'javac Main.java',
      args: ['', 'Main'],
      exec: 'java',
      memory: 2.5,
      time: 2
    },
    python: {
      name: 'main.py',
      args: ['-u', 'main.py'],
      exec: 'pypy3',
      memory: 2,
      time: 2.5
    }
  }
} as Config, null, 2))

const config: Config = JSON.parse(fs.readFileSync('config.json', 'utf-8'))

if (!fs.existsSync(config.rootfs)) throw new Error(`The path: ${config.rootfs} is not exists!`)
const sandboxPath = join(config.rootfs, 'sandbox')
if (!fs.existsSync(sandboxPath)) fs.mkdirSync(sandboxPath)

const execAsync = (cmd: string, cwd: string) => new Promise<void>((resolve, reject) => exec(cmd, { timeout: 5000, cwd }, (err, _, stderr) => {
  if (err || stderr) reject(err || new Error(stderr))
  else resolve()
}))

interface Problem {
  config: {
    title: string
    tags?: string[]
    memory: number
    time: number
  }
  outputs: string[]
  inputs: string[]
  unformateds: string[]
  description: string
}

const user = sandbox.getUidAndGidInSandbox(config.rootfs, config.user)

const run = async (problem: Problem, src: string, langCfg: Language, stdin: string, stdout: string, index: number) => {
  await fsp.writeFile(stdin, problem.inputs[index])
  const sanboxProcess = sandbox.startSandbox({
    time: problem.config.time * (langCfg.time || 1),
    memory: problem.config.memory * 1024 * 1024 * (langCfg.memory || 1),
    hostname: 'SustOJ',
    chroot: config.rootfs,
    process: 20,
    mounts: [
      {
        src,
        dst: '/sandbox',
        limit: -1
      }
    ],
    parameters: langCfg.args || [],
    environments: config.environments || [],
    redirectBeforeChroot: false,
    mountProc: true,
    executable: langCfg.exec,
    cgroup: 'asdf',
    workingDirectory: '/sandbox',
    stdin: './stdin.txt',
    stdout: './stdout.txt',
    stderr: './stdout.txt',
    user
  })
  switch ((await sanboxProcess.waitForStop()).status) {
    case sandbox.SandboxStatus.OK: break
    case sandbox.SandboxStatus.MemoryLimitExceeded: return 'MEMORY'
    case sandbox.SandboxStatus.TimeLimitExceeded: return 'TIMEOUT'
    case sandbox.SandboxStatus.RuntimeError: return 'RUNTIME'
    default: return 'ERROR'
  }
  let stat: fs.Stats
  try { stat = await fsp.stat(stdout) } catch { return 'WRONG' }
  if (stat.size > config.outputLimit) return 'OUTPUT'
  const data = await fsp.readFile(stdout, 'utf-8')
  if (data.startsWith(problem.outputs[index])) return 'ACCEPTED'
  return data.replace(/\s/g, '') === problem.unformateds[index] ? 'PRESENTATION' : 'WRONG'
}

let problems: Problem[]
let problemsHash = ''
const socket = io(config.master, { reconnection: true })
  .on('run', async (id: number, lang: string, code: string, reply: (ret: string, msg?: string) => void) => {
    const problem = problems[id]
    const dir = resolve('data/' + Math.random().toString(36).slice(2) + Date.now().toString(36))
    await fsp.mkdir(dir)
    let ret = 'ERROR'
    let index = 0
    try {
      const langCfg = config.language[lang]
      await fsp.writeFile(join(dir, langCfg.name), code)
      if (langCfg.compile) {
        try {
          await execAsync(langCfg.compile, dir)
        } catch (e) {
          ret = ''
          reply('COMPILE', e.message)
          console.log('COMPILE')
          return
        }
      }
      const stdin = join(dir, 'stdin.txt')
      const stdout = join(dir, 'stdout.txt')
      for (; index < problem.inputs.length; index++) if ((ret = await run(problem, dir, langCfg, stdin, stdout, index)) !== 'ACCEPTED') break
    } catch (e) {
      console.log(e)
    } finally {
      if (ret) {
        reply(ret, index + '/' + problem.inputs.length)
        console.log(ret)
      }
      await del(dir).catch(console.error)
    }
  })
  .on('connect', () => socket.emit('worker-login', config.token, config.process, (err: string | null, hash: string) => {
    if (err) {
      console.error(err)
      return
    }
    if (problemsHash === hash && problems) {
      console.log('Connected!')
      return
    }
    socket.emit('worker-getProblems', (pro: Buffer) => {
      console.log('Decompressing...')
      lzma.decompress(pro, undefined, data => {
        problems = JSON.parse(data.toString())
        problems.forEach(prob => (prob.unformateds = prob.outputs.map(it => it.replace(/\s/g, ''))))
        problemsHash = hash
        console.log('Connected!')
      })
    })
  }))
