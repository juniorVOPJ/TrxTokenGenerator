// scripts/menu.js
const inquirer = require('inquirer');
const fs = require('fs');
const moment = require('moment-timezone');
const chalk = require('chalk');
const path = require('path');
const { tronWeb, tronUtils } = require('./utils/config/tronWeb');

// Importar todas as funções dos módulos
const { deployNewProtocol } = require('./utils/menu/deploy');
const { configureProtocol } = require('./utils/menu/configure');
const { executeOperation } = require('./utils/menu/execute');
const { viewOperations } = require('./utils/menu/view');
const { checkBalances } = require('./utils/menu/balance');
const { listDeployedTokens } = require('./utils/menu/listTokens');
const { returnToMenu } = require('./utils/helpers/menuHelper');

// Configuração dos arquivos de dados
const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'operations.json');

// Estrutura inicial do arquivo de dados
const INITIAL_DATA = {
    operations: [],
    protocols: [],
    lastUpdate: moment().tz('America/Sao_Paulo').format(),
    metadata: {
        version: '1.0.0',
        created: moment().tz('America/Sao_Paulo').format()
    }
};

// Criar diretório e arquivo de dados se não existirem
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_DATA, null, 2));
}

// Funções auxiliares
const loadData = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return INITIAL_DATA;
        }
        const data = JSON.parse(fs.readFileSync(DATA_FILE));
        return {
            operations: data.operations || [],
            protocols: data.protocols || [],
            lastUpdate: data.lastUpdate || moment().tz('America/Sao_Paulo').format(),
            metadata: data.metadata || INITIAL_DATA.metadata,
            limits: data.limits || []
        };
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        return INITIAL_DATA;
    }
};

const saveData = (data) => {
    try {
        const dataToSave = {
            operations: data.operations || [],
            protocols: data.protocols || [],
            lastUpdate: moment().tz('America/Sao_Paulo').format(),
            metadata: data.metadata || INITIAL_DATA.metadata,
            limits: data.limits || []
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 2));
    } catch (error) {
        console.error('Erro ao salvar dados:', error);
    }
};

// Menu principal
async function mainMenu() {
    console.clear();
    console.log(chalk.blue('=== Sistema de Protocolo Flash TRON ===\n'));

    // Inicializar sistema TRON
    try {
        const account = await tronUtils.getAccount();
        const balance = await tronUtils.getBalance(account);
        const bandwidth = await tronUtils.getBandwidth(account);

        console.log(chalk.gray('Conta TRON:', account));
        console.log(chalk.gray('Saldo:', balance, 'TRX'));
        console.log(chalk.gray('Bandwidth:', bandwidth));
    } catch (error) {
        console.error(chalk.red('Erro ao inicializar TRON:', error.message));
    }

    // Carregar e mostrar estatísticas
    const data = loadData();
    console.log(chalk.gray('Última atualização:', data.lastUpdate));
    console.log(chalk.gray('Protocolos ativos:', (data.protocols || []).length));
    console.log(chalk.gray('Operações registradas:', (data.operations || []).length));
    console.log();

    // Menu principal
    const { choice } = await inquirer.prompt([
        {
            type: 'list',
            name: 'choice',
            message: 'Selecione uma operação:',
            choices: [
                'Deploy novo protocolo TRON',
                'Configurar protocolo TRON existente',
                'Executar operação TRON',
                'Visualizar operações TRON',
                'Verificar saldos TRON',
                'Listar Tokens TRON Deployados',
                'Gerenciar Limites TRON',
                'Monitoramento TRON',
                'Exportar Dados',
                'Sair'
            ]
        }
    ]);

    try {
        switch (choice) {
            case 'Deploy novo protocolo TRON':
                await deployNewProtocol(mainMenu);
                break;
            case 'Configurar protocolo TRON existente':
                await configureProtocol(mainMenu);
                break;
            case 'Executar operação TRON':
                await executeOperation(mainMenu);
                break;
            case 'Visualizar operações TRON':
                await viewOperations(mainMenu);
                break;
            case 'Verificar saldos TRON':
                await checkBalances(mainMenu);
                break;
            case 'Listar Tokens TRON Deployados':
                await listDeployedTokens(mainMenu);
                break;
            case 'Gerenciar Limites TRON':
                await manageLimits(mainMenu);
                break;
            case 'Monitoramento TRON':
                await monitoring(mainMenu);
                break;
            case 'Exportar Dados':
                await exportData(mainMenu);
                break;
            case 'Sair':
                console.log(chalk.yellow('\nEncerrando sistema TRON...'));
                process.exit(0);
        }
    } catch (error) {
        console.error(chalk.red('\nErro na operação TRON:'));
        console.error(error.message || error);
        await returnToMenu(mainMenu);
    }
}

// Função para gerenciar limites
async function manageLimits(mainMenuRef) {
    const data = loadData();
    if (!data.protocols || data.protocols.length === 0) {
        console.log(chalk.yellow('\nNenhum protocolo TRON encontrado para configurar limites.'));
        await returnToMenu(mainMenuRef);
        return;
    }

    const { protocol } = await inquirer.prompt([
        {
            type: 'list',
            name: 'protocol',
            message: 'Selecione o protocolo TRON:',
            choices: data.protocols.map(p => ({
                name: `${p.tokenData.symbol} - ${p.address}`,
                value: p.address
            }))
        }
    ]);

    const limits = await inquirer.prompt([
        {
            type: 'input',
            name: 'maxLoan',
            message: 'Limite máximo de empréstimo (TRX):',
            default: '10000'
        },
        {
            type: 'input',
            name: 'minLoan',
            message: 'Limite mínimo de empréstimo (TRX):',
            default: '100'
        },
        {
            type: 'input',
            name: 'maxVirtual',
            message: 'Limite máximo de balanço virtual (TRX):',
            default: '50000'
        }
    ]);

    // Converter para sun (menor unidade do TRON)
    const maxLoanSun = tronWeb.toSun(limits.maxLoan);
    const minLoanSun = tronWeb.toSun(limits.minLoan);
    const maxVirtualSun = tronWeb.toSun(limits.maxVirtual);

    // Salvar limites
    if (!data.limits) data.limits = [];
    data.limits.push({
        id: `limits_${Date.now()}`,
        protocolAddress: protocol,
        maxLoanAmount: maxLoanSun.toString(),
        minLoanAmount: minLoanSun.toString(),
        maxVirtualBalance: maxVirtualSun.toString(),
        updatedAt: new Date().toISOString()
    });

    saveData(data);
    console.log(chalk.green('\nLimites TRON configurados com sucesso!'));
    await returnToMenu(mainMenuRef);
}

// Função para monitoramento
async function monitoring(mainMenuRef) {
    console.log(chalk.yellow('\nIniciando monitoramento TRON...'));
    console.log('Pressione Ctrl+C para parar');

    const data = loadData();
    const protocols = data.protocols || [];

    for (const protocol of protocols) {
        try {
            const contract = await tronWeb.contract().at(protocol.address);

            // Monitorar eventos TRON
            contract.Transfer().watch((err, event) => {
                if (err) return console.error('Erro no evento:', err);
                console.log(chalk.cyan('\nTransferência TRON detectada:'));
                console.log('De:', tronWeb.address.fromHex(event.result.from));
                console.log('Para:', tronWeb.address.fromHex(event.result.to));
                console.log('Valor:', tronWeb.fromSun(event.result.value));
            });

            contract.LoanExecution().watch((err, event) => {
                if (err) return console.error('Erro no evento:', err);
                console.log(chalk.yellow('\nEmpréstimo TRON executado:'));
                console.log('Operador:', tronWeb.address.fromHex(event.result.operator));
                console.log('Valor:', tronWeb.fromSun(event.result.amount));
            });

        } catch (error) {
            console.error(`Erro ao monitorar protocolo ${protocol.address}:`, error);
        }
    }

    // Manter processo ativo
    await new Promise((resolve) => {
        process.on('SIGINT', () => {
            console.log(chalk.yellow('\nMonitoramento TRON encerrado'));
            resolve();
        });
    });

    await returnToMenu(mainMenuRef);
}

// Função para exportar dados
async function exportData(mainMenuRef) {
    const data = loadData();
    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    const exportPath = path.join(DATA_DIR, `export_tron_${timestamp}.json`);

    fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));
    console.log(chalk.green(`\nDados TRON exportados para: ${exportPath}`));

    await returnToMenu(mainMenuRef);
}

// Tratamento de erros global
process.on('unhandledRejection', (error) => {
    console.error(chalk.red('\nErro não tratado TRON:'));
    console.error(error.message || error);

    const data = loadData();
    data.operations.push({
        id: `error_tron_${Date.now()}`,
        type: 'SYSTEM_ERROR_TRON',
        timestamp: moment().tz('America/Sao_Paulo').format(),
        status: 'failed',
        error: error.message || 'Unknown error',
        stack: error.stack
    });
    saveData(data);
});

// Inicializar sistema
console.clear();
mainMenu().catch((error) => {
    console.error(chalk.red('\nErro fatal no sistema TRON:'));
    console.error(error);
    process.exit(1);
});

module.exports = {
    mainMenu
};