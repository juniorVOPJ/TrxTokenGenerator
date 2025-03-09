// scripts/utils/menu/configure.js
const inquirer = require('inquirer');
const chalk = require('chalk');
const { tronWeb, tronUtils } = require('../config/tronWeb');
const logger = require('../helpers/logger');
const { loadData, saveData } = require('../data/loader');
const { returnToMenu } = require('../helpers/menuHelper');

async function configureProtocol(mainMenuRef) {
    logger.info('\nConfigurar Protocolo TRON Existente\n');

    const data = loadData();
    if (data.protocols.length === 0) {
        logger.warning('Nenhum protocolo TRON encontrado. Execute um deploy primeiro.');
        await returnToMenu(mainMenuRef);
        return;
    }

    const protocolChoices = data.protocols.map(p => ({
        name: `${p.tokenData.symbol} - ${p.address}`,
        value: p.address
    }));

    const answers = await inquirer.prompt([
        {
            type: 'list',
            name: 'protocolAddress',
            message: 'Selecione o protocolo TRON:',
            choices: protocolChoices
        },
        {
            type: 'list',
            name: 'action',
            message: 'O que deseja configurar?',
            choices: [
                {
                    name: 'Configurar balanço virtual',
                    value: 'setVirtualBalance'
                },
                {
                    name: 'Configurar alvo',
                    value: 'configureTarget'
                },
                {
                    name: 'Configurar limites',
                    value: 'configureLimits'
                },
                {
                    name: 'Configurar recursos TRON',
                    value: 'configureResources'
                },
                {
                    name: 'Voltar',
                    value: 'back'
                }
            ]
        }
    ]);

    if (answers.action === 'back') {
        await returnToMenu(mainMenuRef);
        return;
    }

    try {
        const contract = await tronWeb.contract().at(answers.protocolAddress);

        switch (answers.action) {
            case 'setVirtualBalance':
                await configureVirtualBalance(contract, answers.protocolAddress, data, mainMenuRef);
                break;
            case 'configureTarget':
                await configureTarget(contract, answers.protocolAddress, data, mainMenuRef);
                break;
            case 'configureLimits':
                await configureLimits(contract, answers.protocolAddress, data, mainMenuRef);
                break;
            case 'configureResources':
                await configureResources(contract, answers.protocolAddress, data, mainMenuRef);
                break;
        }

    } catch (error) {
        logger.error('\nErro durante a configuração TRON:');
        logger.error(error.message);

        data.operations.push({
            id: `config_error_tron_${Date.now()}`,
            type: 'CONFIGURE_ERROR_TRON',
            timestamp: new Date().toISOString(),
            status: 'failed',
            error: error.message
        });
        saveData(data);
        await returnToMenu(mainMenuRef);
    }
}

async function configureVirtualBalance(contract, protocolAddress, data, mainMenuRef) {
    const balanceAnswers = await inquirer.prompt([
        {
            type: 'input',
            name: 'targetAddress',
            message: 'Endereço alvo TRON:',
            validate: (input) => tronWeb.isAddress(input) || 'Endereço TRON inválido'
        },
        {
            type: 'input',
            name: 'amount',
            message: 'Quantidade de tokens:',
            default: '5000'
        }
    ]);

    logger.warning('\nConfigurando balanço virtual TRON...');

    try {
        const amount = tronWeb.toSun(balanceAnswers.amount);
        const tx = await contract.setVirtualBalance(
            balanceAnswers.targetAddress,
            amount
        ).send({
            feeLimit: process.env.TRON_FEE_LIMIT
        });

        await tronUtils.waitForTransaction(tx);

        // Registrar operação
        data.operations.push({
            id: `config_vb_tron_${Date.now()}`,
            type: 'CONFIGURE_VIRTUAL_BALANCE_TRON',
            timestamp: new Date().toISOString(),
            status: 'completed',
            protocolAddress,
            targetAddress: balanceAnswers.targetAddress,
            amount: amount.toString(),
            transaction: {
                txID: tx,
                energyUsed: await tronUtils.getTransactionEnergy(tx),
                bandwidthUsed: await tronUtils.getTransactionBandwidth(tx)
            }
        });
        saveData(data);

        logger.success('\nBalanço virtual TRON configurado com sucesso!');
        logger.info(`TX Hash: ${tx}`);
    } catch (error) {
        throw error;
    }

    await returnToMenu(mainMenuRef);
}

async function configureTarget(contract, protocolAddress, data, mainMenuRef) {
    const targetAnswers = await inquirer.prompt([
        {
            type: 'input',
            name: 'targetAddress',
            message: 'Endereço alvo TRON:',
            validate: (input) => tronWeb.isAddress(input) || 'Endereço TRON inválido'
        },
        {
            type: 'input',
            name: 'description',
            message: 'Descrição do alvo:',
        },
        {
            type: 'confirm',
            name: 'isWhitelisted',
            message: 'Incluir na whitelist?',
            default: true
        },
        {
            type: 'input',
            name: 'energyLimit',
            message: 'Limite de Energy:',
            default: '1000000'
        },
        {
            type: 'input',
            name: 'bandwidthLimit',
            message: 'Limite de Bandwidth:',
            default: '1000000'
        }
    ]);

    // Registrar alvo
    const targetData = {
        id: `target_tron_${Date.now()}`,
        address: targetAnswers.targetAddress,
        description: targetAnswers.description,
        isWhitelisted: targetAnswers.isWhitelisted,
        createdAt: new Date().toISOString(),
        protocolAddress,
        resources: {
            energyLimit: targetAnswers.energyLimit,
            bandwidthLimit: targetAnswers.bandwidthLimit
        }
    };

    if (!data.targets) data.targets = [];
    data.targets.push(targetData);
    saveData(data);

    logger.success('\nAlvo TRON configurado com sucesso!');
    logger.info(`Endereço: ${targetAnswers.targetAddress}`);

    await returnToMenu(mainMenuRef);
}

async function configureLimits(contract, protocolAddress, data, mainMenuRef) {
    const limitAnswers = await inquirer.prompt([
        {
            type: 'input',
            name: 'maxLoanAmount',
            message: 'Valor máximo de empréstimo (TRX):',
            default: '10000'
        },
        {
            type: 'input',
            name: 'minLoanAmount',
            message: 'Valor mínimo de empréstimo (TRX):',
            default: '100'
        },
        {
            type: 'input',
            name: 'maxVirtualBalance',
            message: 'Balanço virtual máximo (TRX):',
            default: '50000'
        },
        {
            type: 'input',
            name: 'maxEnergyLimit',
            message: 'Limite máximo de Energy:',
            default: '5000000'
        },
        {
            type: 'input',
            name: 'maxBandwidthLimit',
            message: 'Limite máximo de Bandwidth:',
            default: '5000000'
        }
    ]);

    // Registrar limites
    const limitsData = {
        id: `limits_tron_${Date.now()}`,
        maxLoanAmount: tronWeb.toSun(limitAnswers.maxLoanAmount).toString(),
        minLoanAmount: tronWeb.toSun(limitAnswers.minLoanAmount).toString(),
        maxVirtualBalance: tronWeb.toSun(limitAnswers.maxVirtualBalance).toString(),
        maxEnergyLimit: limitAnswers.maxEnergyLimit,
        maxBandwidthLimit: limitAnswers.maxBandwidthLimit,
        updatedAt: new Date().toISOString(),
        protocolAddress
    };

    if (!data.limits) data.limits = [];
    data.limits.push(limitsData);
    saveData(data);

    logger.success('\nLimites TRON configurados com sucesso!');

    await returnToMenu(mainMenuRef);
}

async function configureResources(contract, protocolAddress, data, mainMenuRef) {
    const resourceAnswers = await inquirer.prompt([
        {
            type: 'input',
            name: 'energyLimit',
            message: 'Limite de Energy para o contrato:',
            default: '10000000'
        },
        {
            type: 'input',
            name: 'bandwidthLimit',
            message: 'Limite de Bandwidth para o contrato:',
            default: '10000000'
        },
        {
            type: 'input',
            name: 'userEnergyPercent',
            message: 'Porcentagem de Energy do usuário (%):',
            default: '30'
        }
    ]);

    try {
        // Configurar recursos
        const tx = await contract.updateResourceLimits(
            resourceAnswers.energyLimit,
            resourceAnswers.bandwidthLimit,
            resourceAnswers.userEnergyPercent
        ).send({
            feeLimit: process.env.TRON_FEE_LIMIT
        });

        await tronUtils.waitForTransaction(tx);

        // Registrar configuração
        data.operations.push({
            id: `config_resources_tron_${Date.now()}`,
            type: 'CONFIGURE_RESOURCES_TRON',
            timestamp: new Date().toISOString(),
            status: 'completed',
            protocolAddress,
            resources: {
                energyLimit: resourceAnswers.energyLimit,
                bandwidthLimit: resourceAnswers.bandwidthLimit,
                userEnergyPercent: resourceAnswers.userEnergyPercent
            },
            transaction: {
                txID: tx,
                energyUsed: await tronUtils.getTransactionEnergy(tx),
                bandwidthUsed: await tronUtils.getTransactionBandwidth(tx)
            }
        });
        saveData(data);

        logger.success('\nRecursos TRON configurados com sucesso!');
        logger.info(`TX Hash: ${tx}`);

    } catch (error) {
        throw error;
    }

    await returnToMenu(mainMenuRef);
}

module.exports = {
    configureProtocol
};