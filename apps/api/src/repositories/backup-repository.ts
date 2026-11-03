import type { Banco } from '../db/connection'

export interface BackupRepository {
  // Grava uma cópia consistente do banco em destino (mesmo com o app em uso).
  copiarPara(destino: string): void
}

export class SqliteBackupRepository implements BackupRepository {
  constructor(private readonly db: Banco) {}

  copiarPara(destino: string) {
    this.db.$client.prepare('VACUUM INTO ?').run(destino)
  }
}
