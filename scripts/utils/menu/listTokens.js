// scripts/utils/menu/listTokens.js
const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const { tronWeb, tronUtils } = require('../config/tronWeb');
const logger = require('../helpers/logger');
const { loadData, saveData } = require('../data/loader');
const { returnToMenu } = require('../helpers/menuHelper');
const { DATA_DIR } = require('../config/constants');

async function listDeployedTokens(mainMenuRef) {
    logger.info('\nListando Tokens TRON Deployados\n');

    const data = loadData();
    if (!data.protocols || data.protocols.length === 0) {
        logger.warning('Nenhum token TRON encontrado.');
        await returnToMenu(mainMenuRef);
        return;
    }

    try {
        logger.info(chalk.cyan('=== Tokens TRON Deployados ===\n'));

        let inactiveTokens = [];

        for (const protocol of data.protocols) {
            console.log(chalk.yellow('\n----------------------------------------'));
            logger.info(`Token TRON #${data.protocols.indexOf(protocol) + 1}`);

            try {
                const contract = await tronWeb.contract().at(protocol.address);
                const isDeployed = await tronUtils.verifyContract(protocol.address);

                // Informações do registro
                console.log(chalk.cyan('\nInformações Registradas:'));
                console.log('Nome:', protocol.tokenData.name);
                console.log('Símbolo:', protocol.tokenData.symbol);
                console.log('Decimais:', protocol.tokenData.decimals);
                console.log('Supply Inicial:', tronWeb.fromSun(protocol.tokenData.initialSupply));
                console.log('Endereço:', protocol.address);
                console.log('Data Deploy:', new Date(protocol.timestamp).toLocaleString());
                console.log('Deployer:', protocol.deployer);

                console.log(chalk.cyan('\nStatus Atual na TRON:'));
                console.log('Contrato Ativo:', isDeployed ? chalk.green('Sim') : chalk.red('Não'));

                if (!isDeployed) {
                    inactiveTokens.push(protocol);
                } else {
                    // Obter informações atuais do contrato
                    const [
                        currentSupply,
                        deployerBalance,
                        name,
                        symbol,
                        decimals,
                        accountResources
                    ] = await Promise.all([
                        contract.totalSupply().call(),
                        contract.balanceOf(protocol.deployer).call(),
                        contract.name().call(),
                        contract.symbol().call(),
                        contract.decimals().call(),
                        tronWeb.trx.getAccountResources(protocol.address)
                    ]);

                    console.log('\nInformações Atuais:');
                    console.log('Nome:', name);
                    console.log('Símbolo:', symbol);
                    console.log('Decimais:', decimals);
                    console.log('Supply Total:', tronWeb.fromSun(currentSupply));
                    console.log('Balanço do Deployer:', tronWeb.fromSun(deployerBalance));

                    console.log(chalk.cyan('\nRecursos TRON:'));
                    console.log('Energy Limite:', accountResources.EnergyLimit || 0);
                    console.log('Bandwidth Limite:', accountResources.NetLimit || 0);
                    console.log('TRX Congelado:', tronWeb.fromSun(accountResources.TotalEnergyWeight || 0));

                    // Verificar balanços virtuais
                    const virtualBalanceOps = data.operations
                        .filter(op =>
                            op.type === 'CONFIGURE_VIRTUAL_BALANCE_TRON' &&
                            op.status === 'completed' &&
                            op.protocolAddress === protocol.address
                        )
                        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                    if (virtualBalanceOps.length > 0) {
                        console.log(chalk.cyan('\nBalanços Virtuais TRON:'));
                        const processedAddresses = new Set();

                        for (const op of virtualBalanceOps) {
                            if (!processedAddresses.has(op.targetAddress)) {
                                const virtualBalance = await contract.balanceOf(op.targetAddress).call();
                                const actualBalance = await contract.getActualBalance(op.targetAddress).call();

                                console.log(`\nAlvo: ${op.targetAddress}`);
                                console.log('Balanço Virtual:', tronWeb.fromSun(virtualBalance));
                                console.log('Balanço Real:', tronWeb.fromSun(actualBalance));

                                processedAddresses.add(op.targetAddress);
                            }
                        }
                    }

                    // Verificar limites
                    const protocolLimits = data.limits?.find(l => l.protocolAddress === protocol.address);
                    if (protocolLimits) {
                        console.log(chalk.cyan('\nLimites Configurados:'));
                        console.log('Máximo Loan:', tronWeb.fromSun(protocolLimits.maxLoanAmount));
                        console.log('Mínimo Loan:', tronWeb.fromSun(protocolLimits.minLoanAmount));
                        console.log('Máximo Virtual:', tronWeb.fromSun(protocolLimits.maxVirtualBalance));
                    }
                }

                // Histórico de redeployments
                if (protocol.redeployHistory?.length > 0) {
                    console.log(chalk.cyan('\nHistórico de Redeployments TRON:'));
                    protocol.redeployHistory.forEach((redeploy, index) => {
                        console.log(`\nRedeploy #${index + 1}:`);
                        console.log('Data:', new Date(redeploy.timestamp).toLocaleString());
                        console.log('Motivo:', redeploy.reason);
                        console.log('Endereço Original:', redeploy.originalAddress);
                        console.log('Novo Endereço:', redeploy.newAddress);
                        if (redeploy.recoveryResults) {
                            console.log('Recuperações Sucesso:', redeploy.recoveryResults.successful);
                            console.log('Recuperações Falhas:', redeploy.recoveryResults.failed);
                        }
                    });
                }

            } catch (error) {
                logger.error(`\nErro ao verificar token TRON ${protocol.address}:`);
                logger.error(error.message);
            }
        }

        // Opções após listar
        const choices = ['Voltar ao menu principal'];

        if (inactiveTokens.length > 0) {
            choices.unshift('Redeploy de tokens TRON inativos');
        }

        choices.push('Exportar relatório TRON', 'Sair');

        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'O que deseja fazer?',
                choices
            }
        ]);

        if (action === 'Redeploy de tokens TRON inativos') {
            await redeployInactiveTokens(inactiveTokens, data);
        } else if (action === 'Exportar relatório TRON') {
            await exportTokenReport(data.protocols);
        } else if (action === 'Sair') {
            process.exit(0);
        }

    } catch (error) {
        logger.error('\nErro ao listar tokens TRON:');
        logger.error(error.message);
    }

    await returnToMenu(mainMenuRef);
}

async function redeployInactiveTokens(inactiveTokens, data) {
    logger.info('\nIniciando redeploy de tokens TRON inativos...');

    for (const protocol of inactiveTokens) {
        try {
            logger.info(`\nRedeployando ${protocol.tokenData.symbol} (${protocol.address})`);

            // Deploy do novo contrato
            const contract = await tronWeb.contract().new({
                abi: protocol.tokenData.abi,
                bytecode: protocol.tokenData.bytecode,
                feeLimit: process.env.TRON_FEE_LIMIT,
                parameters: [
                    protocol.tokenData.name,
                    protocol.tokenData.symbol,
                    protocol.tokenData.decimals,
                    protocol.tokenData.initialSupply
                ]
            });

            const newAddress = contract.address;
            logger.success(`Novo contrato TRON deployado em: ${newAddress}`);

            // Recuperar configurações anteriores
            const virtualBalanceOps = data.operations
                .filter(op =>
                    op.type === 'CONFIGURE_VIRTUAL_BALANCE_TRON' &&
                    op.status === 'completed' &&
                    op.protocolAddress === protocol.address
                )
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            // Recuperar estado
            const processedAddresses = new Set();
            const recoveryResults = {
                successful: 0,
                failed: 0,
                balances: []
            };

            for (const op of virtualBalanceOps) {
                if (!processedAddresses.has(op.targetAddress)) {
                    try {
                        logger.info(`Recuperando balanço virtual TRON para ${op.targetAddress}`);
                        await contract.setVirtualBalance(
                            op.targetAddress,
                            op.amount
                        ).send({
                            feeLimit: process.env.TRON_FEE_LIMIT
                        });

                        const virtualBalance = await contract.balanceOf(op.targetAddress).call();
                        const actualBalance = await contract.getActualBalance(op.targetAddress).call();

                        recoveryResults.balances.push({
                            address: op.targetAddress,
                            expectedAmount: op.amount,
                            virtualBalance: virtualBalance.toString(),
                            actualBalance: actualBalance.toString(),
                            recovered: virtualBalance.toString() === op.amount
                        });

                        recoveryResults.successful++;
                        processedAddresses.add(op.targetAddress);
                    } catch (error) {
                        logger.error(`Erro ao recuperar balanço TRON para ${op.targetAddress}: ${error.message}`);
                        recoveryResults.failed++;
                    }
                }
            }

            // Registrar redeploy
            const redeployData = {
                id: `redeploy_tron_${Date.now()}`,
                type: 'REDEPLOY_TRON',
                timestamp: new Date().toISOString(),
                status: 'completed',
                originalAddress: protocol.address,
                newAddress,
                description: 'Redeploy automático TRON após inatividade',
                recoveryResults
            };

            data.operations.push(redeployData);

            // Atualizar protocolo
            const protocolIndex = data.protocols.findIndex(p => p.address === protocol.address);
            if (protocolIndex !== -1) {
                data.protocols[protocolIndex] = {
                    ...data.protocols[protocolIndex],
                    address: newAddress,
                    redeployHistory: [
                        ...(data.protocols[protocolIndex].redeployHistory || []),
                        {
                            originalAddress: protocol.address,
                            newAddress,
                            timestamp: new Date().toISOString(),
                            reason: 'TRON Network restart recovery',
                            recoveryResults
                        }
                    ]
                };
            }

            saveData(data);
            logger.success(`Token TRON ${protocol.tokenData.symbol} redeployado com sucesso!`);

        } catch (error) {
            logger.error(`\nErro ao redeployar token TRON ${protocol.tokenData.symbol}:`);
            logger.error(error.message);
        }
    }
}

async function exportTokenReport(protocols) {
    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    const reportPath = path.join(DATA_DIR, `tokens_report_tron_${timestamp}.json`);

    const report = {
        timestamp: new Date().toISOString(),
        totalTokens: protocols.length,
        tokens: await Promise.all(protocols.map(async (p) => {
            try {
                const contract = await tronWeb.contract().at(p.address);
                const isDeployed = await tronUtils.verifyContract(p.address);

                let currentData = {
                    registered: p.tokenData,
                    isDeployed,
                    address: p.address,
                    deployDate: p.timestamp
                };

                if (isDeployed) {
                    const [supply, name, symbol, decimals, resources] = await Promise.all([
                        contract.totalSupply().call(),
                        contract.name().call(),
                        contract.symbol().call(),
                        contract.decimals().call(),
                        tronWeb.trx.getAccountResources(p.address)
                    ]);

                    currentData.current = {
                        name,
                        symbol,
                        decimals: decimals.toString(),
                        totalSupply: supply.toString(),
                        resources: {
                            energy: resources.EnergyLimit || 0,
                            bandwidth: resources.NetLimit || 0,
                            frozenTrx: resources.TotalEnergyWeight || 0
                        }
                    };
                }

                return currentData;
            } catch (error) {
                return {
                    address: p.address,
                    error: error.message
                };
            }
        }))
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    logger.success(`\nRelatório TRON exportado para: ${reportPath}`);
}

module.exports = {
    listDeployedTokens
};