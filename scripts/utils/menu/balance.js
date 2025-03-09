// scripts/utils/menu/balance.js
const inquirer = require('inquirer');
const chalk = require('chalk');
const { tronWeb, tronUtils } = require('../config/tronWeb');
const logger = require('../helpers/logger');
const { loadData, saveData } = require('../data/loader');
const { returnToMenu } = require('../helpers/menuHelper');

async function checkBalances(mainMenuRef) {
    logger.info('\nVerificar Saldos TRON\n');

    const data = loadData();
    if (!data.protocols || data.protocols.length === 0) {
        logger.warning('Nenhum protocolo TRON encontrado. Execute um deploy primeiro.');
        await returnToMenu(mainMenuRef);
        return;
    }

    try {
        logger.info('Protocolos disponíveis:');
        data.protocols.forEach(p => {
            logger.info(`Endereço: ${p.address}`);
            logger.info(`Symbol: ${p.tokenData?.symbol}`);
            logger.info('---');
        });

        const checkType = await inquirer.prompt([
            {
                type: 'list',
                name: 'type',
                message: 'Que tipo de verificação deseja fazer?',
                choices: [
                    {
                        name: 'Verificar endereço específico',
                        value: 'specific'
                    },
                    {
                        name: 'Verificar todos os alvos',
                        value: 'allTargets'
                    },
                    {
                        name: 'Verificar protocolo completo',
                        value: 'fullProtocol'
                    },
                    {
                        name: 'Monitoramento em tempo real',
                        value: 'monitor'
                    },
                    {
                        name: 'Verificar recursos TRON',
                        value: 'resources'
                    },
                    {
                        name: 'Voltar',
                        value: 'back'
                    }
                ]
            }
        ]);

        if (checkType.type === 'back') {
            await returnToMenu(mainMenuRef);
            return;
        }

        const protocolChoices = data.protocols
            .filter(p => p.address && p.tokenData)
            .map(p => ({
                name: `${p.tokenData.symbol} - ${p.address}`,
                value: p.address
            }));

        const { protocolAddress } = await inquirer.prompt([
            {
                type: 'list',
                name: 'protocolAddress',
                message: 'Selecione o protocolo TRON:',
                choices: protocolChoices
            }
        ]);

        const selectedProtocol = data.protocols.find(p => p.address === protocolAddress);
        if (!selectedProtocol) {
            throw new Error('Protocolo não encontrado nos dados');
        }

        const contract = await tronWeb.contract().at(protocolAddress);

        const protocol = {
            address: protocolAddress,
            symbol: selectedProtocol.tokenData.symbol,
            decimals: selectedProtocol.tokenData.decimals
        };

        switch (checkType.type) {
            case 'specific':
                await checkSpecificAddress(contract, protocol, data, mainMenuRef);
                break;
            case 'allTargets':
                await checkAllTargets(contract, protocol, data, mainMenuRef);
                break;
            case 'fullProtocol':
                await checkFullProtocol(contract, protocol, data, mainMenuRef);
                break;
            case 'monitor':
                await monitorBalances(contract, protocol, data, mainMenuRef);
                break;
            case 'resources':
                await checkTronResources(contract, protocol, data, mainMenuRef);
                break;
        }

    } catch (error) {
        logger.error('\nErro ao verificar saldos TRON:');
        logger.error(error.message);
        if (error.stack) {
            logger.error('Stack trace:');
            logger.error(error.stack);
        }

        data.operations.push({
            id: `check_error_tron_${Date.now()}`,
            type: 'BALANCE_CHECK_ERROR_TRON',
            timestamp: new Date().toISOString(),
            status: 'failed',
            error: error.message,
            stack: error.stack
        });
        saveData(data);
    }

    await returnToMenu(mainMenuRef);
}

async function checkSpecificAddress(contract, protocol, data, mainMenuRef) {
    const { address } = await inquirer.prompt([
        {
            type: 'input',
            name: 'address',
            message: 'Digite o endereço TRON para verificar:',
            validate: (input) => tronWeb.isAddress(input) || 'Endereço TRON inválido'
        }
    ]);

    try {
        logger.info(`\nVerificando endereço TRON: ${address}`);

        // Verificar saldos
        const [virtualBalance, actualBalance] = await Promise.all([
            contract.balanceOf(address).call(),
            contract.getActualBalance(address).call()
        ]);

        // Verificar recursos TRON
        const accountResources = await tronWeb.trx.getAccountResources(address);

        console.log(chalk.yellow('\nBalanço Virtual:'),
            tronWeb.fromSun(virtualBalance),
            protocol.symbol);

        console.log(chalk.yellow('Balanço Real:'),
            tronWeb.fromSun(actualBalance),
            protocol.symbol);

        console.log(chalk.yellow('\nRecursos TRON:'));
        console.log('Energy:', accountResources.EnergyLimit || 0);
        console.log('Bandwidth:', accountResources.NetLimit || 0);
        console.log('TRX Congelado:', tronWeb.fromSun(accountResources.TotalEnergyWeight || 0));

        if (virtualBalance > actualBalance) {
            console.log(chalk.red('\n⚠️ Balanço virtual maior que o real'));
            const diff = virtualBalance - actualBalance;
            console.log(chalk.gray('Diferença:'),
                chalk.red(`${tronWeb.fromSun(diff)} ${protocol.symbol}`));
        }

        // Registrar verificação
        data.operations.push({
            id: `check_balance_tron_${Date.now()}`,
            type: 'BALANCE_CHECK_TRON',
            timestamp: new Date().toISOString(),
            status: 'completed',
            address,
            protocolAddress: protocol.address,
            balances: {
                virtual: virtualBalance.toString(),
                actual: actualBalance.toString()
            },
            resources: {
                energy: accountResources.EnergyLimit || 0,
                bandwidth: accountResources.NetLimit || 0,
                frozenTrx: accountResources.TotalEnergyWeight || 0
            }
        });
        saveData(data);

        console.log(chalk.gray('\n------------------------'));

    } catch (error) {
        logger.error(`\nErro ao verificar endereço TRON ${address}:`);
        logger.error(error.message);
    }
}

async function checkAllTargets(contract, protocol, data, mainMenuRef) {
    const targets = new Set();
    data.operations.forEach(op => {
        if (op.targetAddress && op.protocolAddress === protocol.address) {
            targets.add(op.targetAddress);
        }
    });

    const uniqueTargets = Array.from(targets);
    logger.info(`\nVerificando ${uniqueTargets.length} alvos TRON...\n`);

    for (const target of uniqueTargets) {
        try {
            logger.info(`Verificando alvo TRON: ${target}`);

            const [virtualBalance, actualBalance, accountResources] = await Promise.all([
                contract.balanceOf(target).call(),
                contract.getActualBalance(target).call(),
                tronWeb.trx.getAccountResources(target)
            ]);

            console.log(chalk.yellow('\nBalanço Virtual:'),
                tronWeb.fromSun(virtualBalance),
                protocol.symbol);

            console.log(chalk.yellow('Balanço Real:'),
                tronWeb.fromSun(actualBalance),
                protocol.symbol);

            console.log(chalk.yellow('\nRecursos TRON:'));
            console.log('Energy:', accountResources.EnergyLimit || 0);
            console.log('Bandwidth:', accountResources.NetLimit || 0);

            if (virtualBalance > actualBalance) {
                console.log(chalk.red('\n⚠️ Balanço virtual maior que o real'));
                const diff = virtualBalance - actualBalance;
                console.log(chalk.gray('Diferença:'),
                    chalk.red(`${tronWeb.fromSun(diff)} ${protocol.symbol}`));
            }

            console.log(chalk.gray('\n------------------------'));

        } catch (error) {
            logger.error(`\nErro ao verificar alvo TRON ${target}:`);
            logger.error(error.message);
        }
    }
}

async function checkFullProtocol(contract, protocol, data, mainMenuRef) {
    try {
        const account = await tronUtils.getAccount();

        logger.info('\nInformações do Protocolo TRON:');
        logger.info(`Endereço: ${protocol.address}`);
        logger.info(`Symbol: ${protocol.symbol}`);

        // Obter informações do contrato
        const [
            totalSupply,
            ownerBalance,
            ownerActualBalance,
            contractResources
        ] = await Promise.all([
            contract.totalSupply().call(),
            contract.balanceOf(account).call(),
            contract.getActualBalance(account).call(),
            tronWeb.trx.getAccountResources(protocol.address)
        ]);

        logger.info(`\nSupply Total: ${tronWeb.fromSun(totalSupply)} ${protocol.symbol}`);

        logger.info('\nSaldos do Owner:');
        logger.info(`Endereço: ${account}`);
        logger.info(`Virtual: ${tronWeb.fromSun(ownerBalance)} ${protocol.symbol}`);
        logger.info(`Real: ${tronWeb.fromSun(ownerActualBalance)} ${protocol.symbol}`);

        logger.info('\nRecursos do Contrato:');
        logger.info(`Energy Total: ${contractResources.EnergyLimit || 0}`);
        logger.info(`Bandwidth Total: ${contractResources.NetLimit || 0}`);
        logger.info(`TRX Congelado: ${tronWeb.fromSun(contractResources.TotalEnergyWeight || 0)}`);

        // Registrar verificação
        data.operations.push({
            id: `check_full_tron_${Date.now()}`,
            type: 'FULL_PROTOCOL_CHECK_TRON',
            timestamp: new Date().toISOString(),
            status: 'completed',
            protocolAddress: protocol.address,
            results: {
                totalSupply: totalSupply.toString(),
                ownerBalance: ownerBalance.toString(),
                ownerActualBalance: ownerActualBalance.toString(),
                resources: contractResources
            }
        });
        saveData(data);

    } catch (error) {
        logger.error('\nErro ao verificar protocolo TRON:');
        logger.error(error.message);
    }
}

async function monitorBalances(contract, protocol, data, mainMenuRef) {
    logger.info('\nIniciando monitoramento TRON em tempo real...');
    logger.info('Pressione Ctrl+C para parar\n');

    const targets = new Set();
    data.operations.forEach(op => {
        if (op.targetAddress && op.protocolAddress === protocol.address) {
            targets.add(op.targetAddress);
        }
    });

    try {
        // Monitorar eventos TRON
        contract.Transfer().watch((err, event) => {
            if (err) return console.error('Erro no evento:', err);

            const timestamp = new Date().toISOString();
            logger.info(`\n[${timestamp}] Transferência TRON Detectada:`);
            logger.info(`De: ${tronWeb.address.fromHex(event.result.from)}`);
            logger.info(`Para: ${tronWeb.address.fromHex(event.result.to)}`);
            logger.info(`Valor: ${tronWeb.fromSun(event.result.value)} ${protocol.symbol}`);
        });

        // Manter processo ativo
        await new Promise((resolve) => {
            process.on('SIGINT', () => {
                logger.warning('\nMonitoramento TRON encerrado');
                resolve();
            });
        });

    } catch (error) {
        logger.error('\nErro no monitoramento TRON:');
        logger.error(error.message);
    }
}

async function checkTronResources(contract, protocol, data, mainMenuRef) {
    try {
        const account = await tronUtils.getAccount();

        logger.info('\nVerificando recursos TRON...');

        const [
            accountResources,
            accountBandwidth,
            accountEnergy
        ] = await Promise.all([
            tronWeb.trx.getAccountResources(account),
            tronUtils.getBandwidth(account),
            tronUtils.getEnergy(account)
        ]);

        logger.info('\nRecursos da Conta:');
        logger.info(`Energy Disponível: ${accountEnergy}`);
        logger.info(`Bandwidth Disponível: ${accountBandwidth}`);
        logger.info(`TRX Congelado para Energy: ${tronWeb.fromSun(accountResources.TotalEnergyWeight || 0)}`);
        logger.info(`TRX Congelado para Bandwidth: ${tronWeb.fromSun(accountResources.TotalNetWeight || 0)}`);

        // Registrar verificação
        data.operations.push({
            id: `check_resources_tron_${Date.now()}`,
            type: 'RESOURCES_CHECK_TRON',
            timestamp: new Date().toISOString(),
            status: 'completed',
            account,
            resources: {
                energy: accountEnergy,
                bandwidth: accountBandwidth,
                frozenForEnergy: accountResources.TotalEnergyWeight || 0,
                frozenForBandwidth: accountResources.TotalNetWeight || 0
            }
        });
        saveData(data);

    } catch (error) {
        logger.error('\nErro ao verificar recursos TRON:');
        logger.error(error.message);
    }
}

module.exports = {
    checkBalances
};