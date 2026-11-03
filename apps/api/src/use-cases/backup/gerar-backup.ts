import { readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BackupRepository } from '../../repositories/backup-repository'

// Cópia do banco inteiro (.db do SQLite) para baixar.
export class GerarBackupUseCase {
  constructor(private readonly backup: BackupRepository) {}

  execute(agora = new Date()) {
    const temporario = join(
      tmpdir(),
      `financas-backup-${process.pid}-${agora.getTime()}.db`,
    )
    try {
      this.backup.copiarPara(temporario)
      return {
        nome: `financas-${agora.toISOString().slice(0, 10)}.db`,
        conteudo: readFileSync(temporario),
      }
    } finally {
      rmSync(temporario, { force: true })
    }
  }
}
