// scripts/utils/menu/execute.js
const inquirer = require('inquirer');
const chalk = require('chalk');
const { tronWeb, tronUtils } = require('../config/tronWeb');
const logger = require('../helpers/logger');
const { loadData, saveData } = require('../data/loader');
const { returnToMenu } = require('../helpers/menuHelper');

async function executeOperation(mainMenuRef) {
    logger.info('\nExecutar Operação em Protocolo TRON\n');

    const data = loadData();
    if (data.protocols.length === 0) {
        logger.warning('Nenhum protocolo TRON encontrado. Execute um deploy primeiro.');
        await returnToMenu(mainMenuRef);
        return;
    }

    const protocolChoices = data.protocols.map(p => ({
        name: `${p.tokenData.symbol} - ${p.address}`,
        value: {
            address: p.address,
            symbol: p.tokenData.symbol,
            decimals: p.tokenData.decimals
        }
    }));

    try {
        const operationAnswers = await inquirer.prompt([
            {
                type: 'list',
                name: 'protocol',
                message: 'Selecione o protocolo TRON:',
                choices: protocolChoices
            },
            {
                type: 'list',
                name: 'operationType',
                message: 'Tipo de operação:',
                choices: [
                    {
                        name: 'Flash Loan com Balanço Virtual',
                        value: 'FLASH_LOAN_VIRTUAL'
                    },
                    {
                        name: 'Flash Loan Simples',
                        value: 'FLASH_LOAN_SIMPLE'
                    },
                    {
                        name: 'Operação com Energy',
                        value: 'ENERGY_OPERATION'
                    },
                    {
                        name: 'Operação com Bandwidth',
                        value: 'BANDWIDTH_OPERATION'
                    },
                    {
                        name: 'Voltar',
                        value: 'back'
                    }
                ]
            }
        ]);

        if (operationAnswers.operationType === 'back') {
            await returnToMenu(mainMenuRef);
            return;
        }

        const contract = await tronWeb.contract().at(operationAnswers.protocol.address);

        switch (operationAnswers.operationType) {
            case 'FLASH_LOAN_VIRTUAL':
                await executeVirtualFlashLoan(contract, operationAnswers.protocol, data, mainMenuRef);
                break;
            case 'FLASH_LOAN_SIMPLE':
                await executeSimpleFlashLoan(contract, operationAnswers.protocol, data, mainMenuRef);
                break;
            case 'ENERGY_OPERATION':
                await executeEnergyOperation(contract, operationAnswers.protocol, data, mainMenuRef);
                break;
            case 'BANDWIDTH_OPERATION':
                await executeBandwidthOperation(contract, operationAnswers.protocol, data, mainMenuRef);
                break;
        }

    } catch (error) {
        logger.error('\nErro durante a execução TRON:');
        logger.error(error.message);

        data.operations.push({
            id: `execute_error_tron_${Date.now()}`,
            type: 'EXECUTE_ERROR_TRON',
            timestamp: new Date().toISOString(),
            status: 'failed',
            error: error.message
        });
        saveData(data);
        await returnToMenu(mainMenuRef);
    }
}

async function executeVirtualFlashLoan(contract, protocolInfo, data, mainMenuRef) {
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'targetAddress',
            message: 'Endereço alvo TRON:',
            validate: (input) => tronWeb.isAddress(input) || 'Endereço TRON inválido'
        },
        {
            type: 'input',
            name: 'virtualBalance',
            message: 'Balanço virtual (em TRX):',
            default: '5000'
        },
        {
            type: 'input',
            name: 'loanAmount',
            message: 'Quantidade do empréstimo (em TRX):',
            default: '1000'
        }
    ]);

    logger.warning('\nExecutando operação TRON...');

    try {
        // Verificar recursos disponíveis
        const account = await tronUtils.getAccount();
        const energy = await tronUtils.getEnergy(account);
        const bandwidth = await tronUtils.getBandwidth(account);

        logger.info('\nRecursos disponíveis:');
        logger.info(`Energy: ${energy}`);
        logger.info(`Bandwidth: ${bandwidth}`);

        // Configurar balanço virtual
        const virtualAmount = tronWeb.toSun(answers.virtualBalance);
        const virtualTx = await contract.setVirtualBalance(
            answers.targetAddress,
            virtualAmount
        ).send({
            feeLimit: process.env.TRON_FEE_LIMIT
        });

        await tronUtils.waitForTransaction(virtualTx);

        // Executar Flash Loan
        const loanAmount = tronWeb.toSun(answers.loanAmount);
        const loanTx = await contract.executeLoan(loanAmount).send({
            feeLimit: process.env.TRON_FEE_LIMIT
        });

        await tronUtils.waitForTransaction(loanTx);

        // Registrar operação
        data.operations.push({
            id: `flash_loan_virtual_tron_${Date.now()}`,
            type: 'FLASH_LOAN_VIRTUAL_TRON',
            timestamp: new Date().toISOString(),
            status: 'completed',
            protocolAddress: protocolInfo.address,
            targetAddress: answers.targetAddress,
            virtualBalance: virtualAmount.toString(),
            loanAmount: loanAmount.toString(),
            transactions: {
                virtualBalance: {
                    txID: virtualTx,
                    energyUsed: await tronUtils.getTransactionEnergy(virtualTx),
                    bandwidthUsed: await tronUtils.getTransactionBandwidth(virtualTx)
                },
                flashLoan: {
                    txID: loanTx,
                    energyUsed: await tronUtils.getTransactionEnergy(loanTx),
                    bandwidthUsed: await tronUtils.getTransactionBandwidth(loanTx)
                }
            }
        });
        saveData(data);

        logger.success('\nOperação TRON completada com sucesso!');
        logger.info(`Virtual Balance TX: ${virtualTx}`);
        logger.info(`Flash Loan TX: ${loanTx}`);

        await returnToMenu(mainMenuRef);
    } catch (error) {
        throw error;
    }
}

async function executeSimpleFlashLoan(contract, protocolInfo, data, mainMenuRef) {
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'amount',
            message: 'Quantidade do empréstimo (em TRX):',
            default: '1000'
        }
    ]);

    logger.warning('\nExecutando Flash Loan TRON...');

    try {
        const amount = tronWeb.toSun(answers.amount);
        const tx = await contract.executeLoan(amount).send({
            feeLimit: process.env.TRON_FEE_LIMIT
        });

        await tronUtils.waitForTransaction(tx);

        // Registrar operação
        data.operations.push({
            id: `flash_loan_simple_tron_${Date.now()}`,
            type: 'FLASH_LOAN_SIMPLE_TRON',
            timestamp: new Date().toISOString(),
            status: 'completed',
            protocolAddress: protocolInfo.address,
            amount: amount.toString(),
            transaction: {
                txID: tx,
                energyUsed: await tronUtils.getTransactionEnergy(tx),
                bandwidthUsed: await tronUtils.getTransactionBandwidth(tx)
            }
        });
        saveData(data);

        logger.success('\nFlash Loan TRON executado com sucesso!');
        logger.info(`TX Hash: ${tx}`);

        await returnToMenu(mainMenuRef);
    } catch (error) {
        throw error;
    }
}

async function executeEnergyOperation(contract, protocolInfo, data, mainMenuRef) {
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'energyAmount',
            message: 'Quantidade de Energy a usar:',
            default: '1000000'
        }
    ]);

    try {
        const tx = await contract.freezeBalance(
            tronWeb.toSun('10'), // Valor mínimo para congelar
            3, // Duração em dias
            1 // Tipo: Energy
        ).send({
            feeLimit: process.env.TRON_FEE_LIMIT
        });

        await tronUtils.waitForTransaction(tx);

        // Registrar operação
        data.operations.push({
            id: `energy_operation_tron_${Date.now()}`,
            type: 'ENERGY_OPERATION_TRON',
            timestamp: new Date().toISOString(),
            status: 'completed',
            protocolAddress: protocolInfo.address,
            energyAmount: answers.energyAmount,
            transaction: {
                txID: tx,
                energyUsed: await tronUtils.getTransactionEnergy(tx),
                bandwidthUsed: await tronUtils.getTransactionBandwidth(tx)
            }
        });
        saveData(data);

        logger.success('\nOperação de Energy TRON executada com sucesso!');
        logger.info(`TX Hash: ${tx}`);

        await returnToMenu(mainMenuRef);
    } catch (error) {
        throw error;
    }
}

async function executeBandwidthOperation(contract, protocolInfo, data, mainMenuRef) {
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'bandwidthAmount',
            message: 'Quantidade de Bandwidth a usar:',
            default: '1000000'
        }
    ]);

    try {
        const tx = await contract.freezeBalance(
            tronWeb.toSun('10'), // Valor mínimo para congelar
            3, // Duração em dias
            0 // Tipo: Bandwidth
        ).send({
            feeLimit: process.env.TRON_FEE_LIMIT
        });

        await tronUtils.waitForTransaction(tx);

        // Registrar operação
        data.operations.push({
            id: `bandwidth_operation_tron_${Date.now()}`,
            type: 'BANDWIDTH_OPERATION_TRON',
            timestamp: new Date().toISOString(),
            status: 'completed',
            protocolAddress: protocolInfo.address,
            bandwidthAmount: answers.bandwidthAmount,
            transaction: {
                txID: tx,
                energyUsed: await tronUtils.getTransactionEnergy(tx),
                bandwidthUsed: await tronUtils.getTransactionBandwidth(tx)
            }
        });
        saveData(data);

        logger.success('\nOperação de Bandwidth TRON executada com sucesso!');
        logger.info(`TX Hash: ${tx}`);

        await returnToMenu(mainMenuRef);
    } catch (error) {
        throw error;
    }
}

module.exports = {
    executeOperation
};