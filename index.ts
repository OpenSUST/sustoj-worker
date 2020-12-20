import io from 'socket.io-client'
import * as sandbox from 'simple-sandbox'
import { exec } from 'child_process'
import { join, resolve } from 'path'
import fs, { promises as fsp } from 'fs'

const terminationHandler = () => process.exit()

process.on('SIGTERM', terminationHandler)
process.on('SIGINT', terminationHandler)

interface Config {
  token: string
  master: string
  process: number
  user: string
  rootfs: string
  outputLimit: number
  environments: string[]
  language: Record<string, { name: string, compile?: string, args?: string[], exec: string, memory: number, time: number }>
}

if (!fs.existsSync('data')) fs.mkdirSync('data')
if (!fs.existsSync('config.json')) fs.writeFileSync('config.json', JSON.stringify({
  token: '',
  master: 'http://localhost:23333/',
  process: 2,
  user: 'sandbox',
  rootfs: '/opt/rootfs',
  outputLimit: 1024 * 100, // 100KB
  environments: [],
  language: {
    c: {
      name: 'main.c',
      compile: 'gcc main.c -o main -fno-asm -Wall -lm --static -DONLINE_JUDGE',
      exec: './main',
      memory: 128,
      time: 1
    },
    cpp: {
      name: 'main.cpp',
      compile: 'g++ -fno-asm -Wall -lm --static -DONLINE_JUDGE -o main main.cpp',
      exec: './main',
      memory: 128,
      time: 1
    },
    java: {
      name: 'Main.java',
      compile: 'javac Main.java',
      args: ['Main.class'],
      exec: 'java',
      memory: 512,
      time: 2
    },
    python: {
      name: 'main.py',
      args: ['main.py'],
      exec: 'pypy',
      memory: 512,
      time: 2
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
  }
  output: string
  input: string
  unformated: string
  description: string
}

const user = sandbox.getUidAndGidInSandbox(config.rootfs, config.user)

let problems: Problem[]
io(config.master)
  .on('run', async (id: number, lang: string, code: string, reply: (ret: string) => void) => {
    const problem = problems[id]
    const dir = resolve('data/' + Math.random().toString(36).slice(2) + Date.now().toString(36))
    await fsp.mkdir(dir)
    let ret = 'ERROR'
    try {
      const langCfg = config.language[lang]
      await fsp.writeFile(join(dir, langCfg.name), code)
      if (langCfg.compile) await execAsync(langCfg.compile, dir)
      const stdin = join(dir, 'stdin.txt')
      const stdout = join(dir, 'stdout.txt')
      await fsp.writeFile(stdin, problem.input)
      const sanboxProcess = sandbox.startSandbox({
        time: langCfg.time * 1000,
        memory: langCfg.memory * 1024 * 1024,
        hostname: 'SustOJ',
        chroot: config.rootfs,
        process: 1,
        mounts: [
          {
            src: dir,
            dst: '/sandbox',
            limit: -1
          }
        ],
        parameters: langCfg.args,
        environments: config.environments,
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
        case sandbox.SandboxStatus.MemoryLimitExceeded:
          ret = 'MEMORY'
          return
        case sandbox.SandboxStatus.TimeLimitExceeded:
          ret = 'TIME'
          return
        case sandbox.SandboxStatus.RuntimeError:
          ret = 'RUNTIME'
          return
        default:
          ret = 'ERROR'
          return
      }
      let stat: fs.Stats
      try {
        stat = await fsp.stat(stdout)
      } catch {
        ret = 'WRONG'
        return
      }
      if (stat.size > config.outputLimit) {
        ret = 'OUTPUT'
        return
      }
      const data = await fsp.readFile(stdout, 'utf-8')
      if (data.startsWith(problem.output)) {
        ret = 'ACCEPTED'
        return
      }
      ret = data.replace(/\s/g, '') === problem.unformated ? 'PRESENTATION' : 'WRONG'
    } catch (e) {
      console.log(e)
    } finally {
      reply(ret)
      await fsp.rmdir(dir, { recursive : true })
    }
  })
  .emit('worker-login', config.token, config.process, (it: Problem[]) => {
    it.forEach(prob => (prob.unformated.replace(/\s/g, '')))
    problems = it
  })
