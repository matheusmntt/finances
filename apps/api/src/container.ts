// Monta repositórios e use-cases a partir do banco. As rotas recebem só os use-cases.
import type { Banco } from './db/connection'
import type { Env } from './env'
import { LimiteDeTentativas, Senha, Sessoes } from './lib/auth/sessoes'
import { DrizzleBackofficeRepository } from './repositories/backoffice-repository'
import { SqliteBackupRepository } from './repositories/backup-repository'
import { DrizzleCarroRepository } from './repositories/carro-repository'
import { DrizzleEstadoRepository } from './repositories/estado-repository'
import { DrizzleHoleritesRepository } from './repositories/holerites-repository'
import { DrizzleLancamentosRepository } from './repositories/lancamentos-repository'
import { DrizzleSegredosRepository } from './repositories/segredos-repository'
import { EntrarUseCase } from './use-cases/auth/entrar'
import { AtualizarConfigUseCase } from './use-cases/backoffice/atualizar-config'
import { AtualizarRegistroUseCase } from './use-cases/backoffice/atualizar-registro'
import { CriarRegistroUseCase } from './use-cases/backoffice/criar-registro'
import { RemoverRegistroUseCase } from './use-cases/backoffice/remover-registro'
import { ReordenarUseCase } from './use-cases/backoffice/reordenar'
import {
  AtualizarValorMesUseCase,
  CriarValoresMesUseCase,
  RemoverValorMesUseCase,
} from './use-cases/backoffice/valores-mes'
import { GerarBackupUseCase } from './use-cases/backup/gerar-backup'
import { ImportarBoletosUseCase } from './use-cases/carro/importar-boletos'
import { MarcarCustoPagoUseCase } from './use-cases/carro/marcar-custo-pago'
import { MarcarMultaPagaUseCase } from './use-cases/carro/marcar-multa-paga'
import { ObterPdfBoletoUseCase } from './use-cases/carro/obter-pdf'
import { CriarDespesaUseCase } from './use-cases/despesas/criar-despesa'
import { DefinirValorMesUseCase } from './use-cases/despesas/definir-valor-mes'
import { MarcarValorMesPagoUseCase } from './use-cases/despesas/marcar-valor-mes-pago'
import { RemoverDespesaUseCase } from './use-cases/despesas/remover-despesa'
import { CriarEmprestimoUseCase } from './use-cases/emprestimos/criar-emprestimo'
import { RemoverEmprestimoUseCase } from './use-cases/emprestimos/remover-emprestimo'
import { AtualizarEntradaUseCase } from './use-cases/entradas/atualizar-entrada'
import { CriarEntradaUseCase } from './use-cases/entradas/criar-entrada'
import { RemoverEntradaUseCase } from './use-cases/entradas/remover-entrada'
import { ObterEstadoUseCase } from './use-cases/estado/obter-estado'
import { AtualizarExtraUseCase } from './use-cases/extras/atualizar-extra'
import { CriarExtraUseCase } from './use-cases/extras/criar-extra'
import { RemoverExtraUseCase } from './use-cases/extras/remover-extra'
import { EnviarHoleriteUseCase } from './use-cases/holerites/enviar-holerite'
import { ObterPdfHoleriteUseCase } from './use-cases/holerites/obter-pdf-holerite'
import { RemoverHoleriteUseCase } from './use-cases/holerites/remover-holerite'

export function criarContainer(db: Banco, env: Pick<Env, 'APP_SENHA'>) {
  const estado = new DrizzleEstadoRepository(db)
  const lancamentos = new DrizzleLancamentosRepository(db)
  const carro = new DrizzleCarroRepository(db)
  const holerites = new DrizzleHoleritesRepository(db)
  const backoffice = new DrizzleBackofficeRepository(db)
  const sessoes = new Sessoes(new DrizzleSegredosRepository(db))

  return {
    sessoes,
    entrar: new EntrarUseCase(
      new Senha(env.APP_SENHA),
      sessoes,
      new LimiteDeTentativas(),
    ),
    obterEstado: new ObterEstadoUseCase(estado),
    gerarBackup: new GerarBackupUseCase(new SqliteBackupRepository(db)),

    criarDespesa: new CriarDespesaUseCase(lancamentos, estado),
    definirValorMes: new DefinirValorMesUseCase(lancamentos),
    marcarValorMesPago: new MarcarValorMesPagoUseCase(lancamentos),
    removerDespesa: new RemoverDespesaUseCase(lancamentos),

    criarEntrada: new CriarEntradaUseCase(lancamentos),
    atualizarEntrada: new AtualizarEntradaUseCase(lancamentos),
    removerEntrada: new RemoverEntradaUseCase(lancamentos),
    criarExtra: new CriarExtraUseCase(lancamentos),
    atualizarExtra: new AtualizarExtraUseCase(lancamentos),
    removerExtra: new RemoverExtraUseCase(lancamentos),
    criarEmprestimo: new CriarEmprestimoUseCase(lancamentos),
    removerEmprestimo: new RemoverEmprestimoUseCase(lancamentos),

    marcarMultaPaga: new MarcarMultaPagaUseCase(carro),
    marcarCustoPago: new MarcarCustoPagoUseCase(carro),
    obterPdfBoleto: new ObterPdfBoletoUseCase(carro),
    importarBoletos: new ImportarBoletosUseCase(carro),

    enviarHolerite: new EnviarHoleriteUseCase(holerites),
    removerHolerite: new RemoverHoleriteUseCase(holerites),
    obterPdfHolerite: new ObterPdfHoleriteUseCase(holerites),

    atualizarConfig: new AtualizarConfigUseCase(backoffice, lancamentos),
    atualizarRegistro: new AtualizarRegistroUseCase(backoffice, lancamentos),
    criarRegistro: new CriarRegistroUseCase(backoffice, lancamentos),
    removerRegistro: new RemoverRegistroUseCase(backoffice),
    reordenar: new ReordenarUseCase(backoffice),
    criarValoresMes: new CriarValoresMesUseCase(backoffice, lancamentos),
    atualizarValorMes: new AtualizarValorMesUseCase(backoffice, lancamentos),
    removerValorMes: new RemoverValorMesUseCase(backoffice, lancamentos),
  }
}

export type Container = ReturnType<typeof criarContainer>
