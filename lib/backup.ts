// lib/backup.ts
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'

const execAsync = promisify(exec)

export interface BackupResult {
  filename: string
  path: string
  sizeBytes: number
  createdAt: Date
}

export async function createBackup(): Promise<BackupResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename  = `genomiclab-backup-${timestamp}.sql`
  const gzName    = `${filename}.gz`
  const backupDir = path.join(process.cwd(), 'backups')
  const outPath   = path.join(backupDir, gzName)

  // Parse connection string from DATABASE_URL
  const url     = new URL(process.env.DATABASE_URL!)
  const host    = url.hostname
  const port    = url.port || '5432'
  const dbName  = url.pathname.replace('/', '')
  const user    = url.username
  const pass    = url.password

  const env = { ...process.env, PGPASSWORD: pass }

  // Dump to raw SQL
  const rawPath = path.join(backupDir, filename)
  await execAsync(
    `pg_dump -h ${host} -p ${port} -U ${user} -F p -f "${rawPath}" ${dbName}`,
    { env }
  )

  // Gzip compress the dump
  await new Promise<void>((resolve, reject) => {
    const input  = fs.createReadStream(rawPath)
    const output = fs.createWriteStream(outPath)
    const gzip   = zlib.createGzip()
    input.pipe(gzip).pipe(output)
    output.on('finish', resolve)
    output.on('error', reject)
  })

  // Remove uncompressed dump
  fs.unlinkSync(rawPath)

  const stats = fs.statSync(outPath)
  return {
    filename: gzName,
    path: outPath,
    sizeBytes: stats.size,
    createdAt: new Date(),
  }
}

export function listBackups(): BackupResult[] {
  const backupDir = path.join(process.cwd(), 'backups')
  if (!fs.existsSync(backupDir)) return []
  return fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.sql.gz'))
    .map(f => {
      const full  = path.join(backupDir, f)
      const stats = fs.statSync(full)
      return { filename: f, path: full, sizeBytes: stats.size, createdAt: stats.birthtime }
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export async function restoreBackup(filename: string): Promise<void> {
  const backupDir = path.join(process.cwd(), 'backups')
  const gzPath    = path.join(backupDir, filename)
  const sqlPath   = gzPath.replace('.gz', '')

  if (!fs.existsSync(gzPath)) throw new Error('Backup file not found')

  // Decompress
  await new Promise<void>((resolve, reject) => {
    const input  = fs.createReadStream(gzPath)
    const output = fs.createWriteStream(sqlPath)
    const gunzip = zlib.createGunzip()
    input.pipe(gunzip).pipe(output)
    output.on('finish', resolve)
    output.on('error', reject)
  })

  const url    = new URL(process.env.DATABASE_URL!)
  const host   = url.hostname
  const port   = url.port || '5432'
  const dbName = url.pathname.replace('/', '')
  const user   = url.username
  const pass   = url.password
  const env    = { ...process.env, PGPASSWORD: pass }

  // Drop and recreate the database, then restore
  await execAsync(
    `psql -h ${host} -p ${port} -U ${user} -c "DROP DATABASE IF EXISTS ${dbName};" postgres`,
    { env }
  )
  await execAsync(
    `psql -h ${host} -p ${port} -U ${user} -c "CREATE DATABASE ${dbName};" postgres`,
    { env }
  )
  await execAsync(
    `psql -h ${host} -p ${port} -U ${user} -f "${sqlPath}" ${dbName}`,
    { env }
  )
  fs.unlinkSync(sqlPath)
}
