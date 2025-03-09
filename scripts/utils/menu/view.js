// scripts/utils/menu/view.js
const inquirer = require('inquirer');
const moment = require('moment-timezone');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const { tronWeb, tronUtils } = require('../config/tronWeb');
const logger = require('../helpers/logger');
const { loadData } = require('../data/loader');
const { returnToMenu } = require('../helpers/menuHelper');
const { DATA_DIR } = require('../config/constants');

async function viewOperations(mainMenuRef) {
    logger.info('\nVisualizar Operações TRON\n');

    const data = loadData();
    if (data.operations.length === 0) {
        logger.warning('Nenhuma operação TRON registrada.');
        await returnToMenu(mainMenuRef);
        return;
    }

    const viewChoice = await inquirer.prompt([
        {
            type: 'list',
            name: 'viewType',
            message: 'Como deseja visualizar as operações TRON?',
            choices: [
                {
                    name: 'Todas as operações',
                    value: 'all'
                },
                {
                    name: 'Por protocolo',
                    value: 'byProtocol'
                },
                {
                    name: 'Por tipo de operação',
                    value: 'byType'
                },
                {
                    name: 'Por status',
                    value: 'byStatus'
                },
                {
                    name: 'Últimas 24 horas',
                    value: 'recent'
                },
                {
                    name: 'Por recursos TRON',
                    value: 'byResources'
                },
                {
                    name: 'Exportar operações',
                    value: 'export'
                },
                {
                    name: 'Voltar',
                    value: 'back'
                }
            ]
        }
    ]);

    if (viewChoice.viewType === 'back') {
        await returnToMenu(mainMenuRef);
        return;
    }

    let operationsToShow = [];
    let filterInfo = '';

    try {
        switch (viewChoice.viewType) {
            case 'all':
                operationsToShow = data.operations;
                break;

            case 'byProtocol':
                const protocol = await selectProtocol(data);
                if (!protocol) {
                    await returnToMenu(mainMenuRef);
                    return;
                }
                operationsToShow = data.operations.filter(op => op.protocolAddress === protocol);
                filterInfo = `Protocolo TRON: ${protocol}`;
                break;

            case 'byType':
                const type = await selectOperationType(data);
                if (!type) {
                    await returnToMenu(mainMenuRef);
                    return;
                }
                operationsToShow = data.operations.filter(op => op.type === type);
                filterInfo = `Tipo: ${type}`;
                break;

            case 'byStatus':
                const status = await selectStatus();
                if (!status) {
                    await returnToMenu(mainMenuRef);
                    return;
                }
                operationsToShow = data.operations.filter(op => op.status === status);
                filterInfo = `Status: ${status}`;
                break;

            case 'byResources':
                const resource = await selectResource();
                if (!resource) {
                    await returnToMenu(mainMenuRef);
                    return;
                }
                operationsToShow = data.operations.filter(op =>
                    op.resources && op.resources[resource.toLowerCase()] > 0
                );
                filterInfo = `Recurso TRON: ${resource}`;
                break;

            case 'recent':
                const yesterday = moment().subtract(24, 'hours');
                operationsToShow = data.operations.filter(op =>
                    moment(op.timestamp).isAfter(yesterday)
                );
                filterInfo = 'Últimas 24 horas';
                break;

            case 'export':
                await exportOperations(data.operations, mainMenuRef);
                return;
        }

        await displayOperations(operationsToShow, filterInfo);
        await returnToMenu(mainMenuRef);

    } catch (error) {
        logger.error('\nErro ao visualizar operações TRON:');
        logger.error(error.message);
        await returnToMenu(mainMenuRef);
    }
}

async function selectProtocol(data) {
    const protocols = [...new Set(data.operations.map(op => op.protocolAddress))];
    const { protocol } = await inquirer.prompt([
        {
            type: 'list',
            name: 'protocol',
            message: 'Selecione o protocolo TRON:',
            choices: protocols
        }
    ]);
    return protocol;
}

async function selectOperationType(data) {
    const types = [...new Set(data.operations.map(op => op.type))];
    const { type } = await inquirer.prompt([
        {
            type: 'list',
            name: 'type',
            message: 'Selecione o tipo de operação TRON:',
            choices: types
        }
    ]);
    return type;
}

async function selectStatus() {
    const { status } = await inquirer.prompt([
        {
            type: 'list',
            name: 'status',
            message: 'Selecione o status:',
            choices: ['completed', 'pending', 'failed']
        }
    ]);
    return status;
}

async function selectResource() {
    const { resource } = await inquirer.prompt([
        {
            type: 'list',
            name: 'resource',
            message: 'Selecione o recurso TRON:',
            choices: ['Energy', 'Bandwidth', 'TRX']
        }
    ]);
    return resource;
}

async function displayOperations(operations, filterInfo = '') {
    logger.info(`\nMostrando ${operations.length} operações TRON ${filterInfo ? `(${filterInfo})` : ''}\n`);

    for (const op of operations) {
        console.log(chalk.cyan(`Operação TRON #${operations.indexOf(op) + 1}`));
        console.log(chalk.gray('ID:'), op.id);
        console.log(chalk.gray('Timestamp:'), moment(op.timestamp).format('DD/MM/YYYY HH:mm:ss'));
        console.log(chalk.gray('Tipo:'), op.type);
        console.log(chalk.gray('Status:'), getStatusColor(op.status)(op.status));

        if (op.protocolAddress) {
            console.log(chalk.gray('Protocolo TRON:'), op.protocolAddress);
        }

        if (op.targetAddress) {
            console.log(chalk.gray('Alvo:'), op.targetAddress);
        }

        if (op.amount) {
            console.log(chalk.gray('Quantidade:'),
                tronWeb.fromSun(op.amount));
        }

        if (op.transaction?.txID) {
            console.log(chalk.gray('TX Hash:'), op.transaction.txID);
            console.log(chalk.gray('Energy Usado:'), op.transaction.energyUsed || 'N/A');
            console.log(chalk.gray('Bandwidth Usado:'), op.transaction.bandwidthUsed || 'N/A');
        }

        if (op.resources) {
            console.log(chalk.cyan('\nRecursos TRON:'));
            if (op.resources.energy) console.log('Energy:', op.resources.energy);
            if (op.resources.bandwidth) console.log('Bandwidth:', op.resources.bandwidth);
            if (op.resources.frozenTrx) console.log('TRX Congelado:', tronWeb.fromSun(op.resources.frozenTrx));
        }

        if (op.error) {
            console.log(chalk.red('Erro:'), op.error);
        }

        console.log(chalk.gray('------------------------\n'));

        // Aguardar input do usuário para continuar se houver muitas operações
        if (operations.length > 10 && operations.indexOf(op) % 10 === 9) {
            await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'continue',
                    message: 'Pressione Enter para continuar...',
                    default: true
                }
            ]);
        }
    }
}

async function exportOperations(operations, mainMenuRef) {
    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    const exportPath = path.join(DATA_DIR, `operations_tron_export_${timestamp}.json`);

    // Preparar dados para exportação
    const exportData = {
        timestamp: new Date().toISOString(),
        totalOperations: operations.length,
        network: 'TRON',
        operations: operations.map(op => ({
            ...op,
            amounts: op.amount ? {
                sun: op.amount,
                trx: tronWeb.fromSun(op.amount)
            } : undefined,
            resources: op.resources ? {
                ...op.resources,
                frozenTrxFormatted: op.resources.frozenTrx ?
                    tronWeb.fromSun(op.resources.frozenTrx) : undefined
            } : undefined
        }))
    };

    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
    logger.success(`\nOperações TRON exportadas para: ${exportPath}`);

    await returnToMenu(mainMenuRef);
}

function getStatusColor(status) {
    switch (status) {
        case 'completed':
            return chalk.green;
        case 'pending':
            return chalk.yellow;
        case 'failed':
            return chalk.red;
        default:
            return chalk.white;
    }
}

module.exports = {
    viewOperations
};