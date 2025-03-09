const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { tronWeb, tronUtils } = require('../config/tronWeb');
const logger = require('../helpers/logger');
const { loadData, saveData } = require('../data/loader');
const { returnToMenu } = require('../helpers/menuHelper');
const solc = require('solc');
const BigNumber = require('bignumber.js');

async function deployNewProtocol(mainMenuRef) {
    logger.info('\nDeploy de Novo Protocolo na TRON\n');

    try {
        // Verificar conta e recursos
        const account = await tronUtils.getAccount();
        const balance = await tronUtils.getBalance(account);
        const bandwidth = await tronUtils.getBandwidth(account);
        const energy = await tronUtils.getEnergy(account);

        logger.info('\nInformações da Conta TRON:');
        logger.info(`Endereço: ${account}`);
        logger.info(`Saldo: ${balance} TRX`);
        logger.info(`Bandwidth: ${bandwidth}`);
        logger.info(`Energy: ${energy}`);
        logger.info(`Provider URL: ${process.env.TRON_MAINNET_URL}`);

        if (balance < 100) {
            throw new Error('Saldo TRX insuficiente para deploy (mínimo 100 TRX)');
        }

        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'description',
                message: 'Descrição do protocolo:',
                default: 'Flash Protocol TRON'
            },
            {
                type: 'input',
                name: 'tokenName',
                message: 'Nome do token:',
                default: 'Tether USD'
            },
            {
                type: 'input',
                name: 'tokenSymbol',
                message: 'Símbolo do token:',
                default: 'USDT'
            },
            {
                type: 'number',
                name: 'decimals',
                message: 'Número de decimais:',
                default: 6,
                validate: (value) => {
                    if (value < 0 || value > 18) return 'Decimais devem estar entre 0 e 18';
                    return true;
                }
            },
            {
                type: 'input',
                name: 'initialSupply',
                message: 'Supply inicial (em tokens):',
                default: '27000000000',
                validate: (value) => {
                    if (isNaN(value) || value <= 0) return 'Supply deve ser um número positivo';
                    return true;
                }
            },
            {
                type: 'input',
                name: 'targetAddress',
                message: 'Endereço alvo:',
                validate: (input) => tronWeb.isAddress(input) || 'Endereço TRON inválido'
            }
        ]);

        // Cálculo correto do supply com decimais
        const decimals = answers.decimals;
        const rawInitialSupply = answers.initialSupply;
        const initialSupply = new BigNumber(rawInitialSupply)
            .multipliedBy(new BigNumber(10).pow(decimals))
            .toString();

        logger.info('\nCálculo do Supply:');
        logger.info(`Supply bruto: ${rawInitialSupply}`);
        logger.info(`Decimais: ${decimals}`);
        logger.info(`Supply ajustado: ${initialSupply}`);

        // Compilação e preparação do contrato
        logger.info('\nCompilando contrato TRON...');
        const contractPath = path.join(process.cwd(), 'contracts', 'FlashProtocol.sol');
        if (!fs.existsSync(contractPath)) {
            throw new Error(`Contrato não encontrado em: ${contractPath}`);
        }

        const contractSource = fs.readFileSync(contractPath, 'utf8');
        const input = {
            language: 'Solidity',
            sources: {
                'FlashProtocol.sol': {
                    content: contractSource
                }
            },
            settings: {
                outputSelection: {
                    '*': {
                        '*': ['*']
                    }
                },
                optimizer: {
                    enabled: true,
                    runs: 200
                },
                evmVersion: "london"
            }
        };

        const output = JSON.parse(solc.compile(JSON.stringify(input)));

        if (output.errors) {
            const errors = output.errors.filter(error => error.severity === 'error');
            if (errors.length > 0) {
                throw new Error(`Erros de compilação: ${JSON.stringify(errors, null, 2)}`);
            }
        }

        const contract = output.contracts['FlashProtocol.sol']['FlashProtocol'];
        const abi = contract.abi;
        const bytecode = contract.evm.bytecode.object;

        logger.info('Contrato compilado com sucesso');
        logger.info(`Tamanho do Bytecode: ${bytecode.length} bytes`);
        logger.info(`Número de funções no ABI: ${abi.length}`);

        // Confirmação final com valores ajustados
        const { confirmDeploy } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirmDeploy',
                message: `\nConfirma o deploy com as seguintes configurações?\n` +
                    `Nome: ${answers.tokenName}\n` +
                    `Símbolo: ${answers.tokenSymbol}\n` +
                    `Decimais: ${decimals}\n` +
                    `Supply Bruto: ${rawInitialSupply}\n` +
                    `Supply Ajustado: ${initialSupply}\n` +
                    `Fee Limit: 1000000000\n` +
                    `Rede: TRON Mainnet\n`,
                default: false
            }
        ]);

        if (!confirmDeploy) {
            logger.warning('Deploy cancelado pelo usuário');
            await returnToMenu(mainMenuRef);
            return;
        }

        // Deploy do contrato
        logger.info('\nIniciando deploy na TRON...');
        const cleanBytecode = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;

        // Parâmetros do construtor com supply ajustado
        const constructorParams = [
            answers.tokenName,
            answers.tokenSymbol,
            decimals,
            initialSupply // Usando o valor ajustado com decimais
        ];

        logger.info('Parâmetros do construtor:', constructorParams);

        const transaction = await tronWeb.transactionBuilder.createSmartContract({
            abi: abi,
            bytecode: cleanBytecode,
            feeLimit: 1000000000,
            callValue: 0,
            consumeUserResourcePercent: 100,
            originEnergyLimit: 10000000,
            name: answers.tokenName,
            parameters: constructorParams
        }, account);

        logger.info('Transação criada, assinando...');
        const signedTx = await tronWeb.trx.sign(transaction);

        logger.info('Transação assinada, enviando...');
        const receipt = await tronWeb.trx.sendRawTransaction(signedTx);

        if (!receipt.result) {
            throw new Error('Falha ao enviar transação: ' + JSON.stringify(receipt));
        }

        // Polling para confirmação
        logger.info('Aguardando confirmação da transação...');
        let attempts = 0;
        let txInfo = null;
        const maxAttempts = 40;
        const delayBetweenAttempts = 5000;

        while (attempts < maxAttempts && (!txInfo || !txInfo.contract_address)) {
            try {
                txInfo = await tronWeb.trx.getTransactionInfo(receipt.txid);
                if (txInfo && txInfo.contract_address) break;
                logger.info(`Aguardando confirmação... Tentativa ${attempts + 1} de ${maxAttempts}`);
            } catch (error) {
                logger.info(`Tentativa ${attempts + 1} falhou, tentando novamente...`);
            }
            await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
            attempts++;
        }

        if (!txInfo || !txInfo.contract_address) {
            throw new Error(`Deploy não confirmado após ${maxAttempts} tentativas`);
        }

        const contractAddress = tronWeb.address.fromHex(txInfo.contract_address);
        logger.info(`Contrato deployado em: ${contractAddress}`);

        // Transferência inicial com valor ajustado
        const transferAnswers = await inquirer.prompt([
            {
                type: 'input',
                name: 'transferAddress',
                message: 'Endereço para receber a transferência inicial:',
                validate: (input) => tronWeb.isAddress(input) || 'Endereço TRON inválido'
            }
        ]);

        logger.info('\nIniciando transferência inicial...');
        try {
            const deployedContract = await tronWeb.contract().at(contractAddress);

            logger.info(`Endereço para transferência: ${transferAnswers.transferAddress}`);
            logger.info(`Quantidade (com decimais): ${initialSupply}`);

            const transferTx = await deployedContract.transfer(
                transferAnswers.transferAddress,
                initialSupply
            ).send({
                feeLimit: 1000000000
            });

            logger.success('Transferência inicial realizada com sucesso!');
            logger.info(`TX Hash da transferência: ${transferTx}`);

            // Verificação do saldo
            await new Promise(resolve => setTimeout(resolve, 10000));
            const transferBalance = await deployedContract.balanceOf(transferAnswers.transferAddress).call();
            const formattedBalance = new BigNumber(transferBalance.toString())
                .dividedBy(new BigNumber(10).pow(decimals))
                .toString();

            logger.info(`Saldo do endereço após transferência: ${formattedBalance} tokens`);

        } catch (error) {
            logger.warning('\nAviso: Erro na transferência inicial');
            logger.warning(error.message);
        }

        // Registro da operação
        const data = loadData();
        const operationData = {
            id: `deploy_tron_${Date.now()}`,
            type: 'DEPLOY_TRON',
            timestamp: new Date().toISOString(),
            status: 'completed',
            description: answers.description,
            deployer: account,
            protocolAddress: contractAddress,
            tokenData: {
                name: answers.tokenName,
                symbol: answers.tokenSymbol,
                decimals: decimals,
                rawInitialSupply: rawInitialSupply,
                adjustedInitialSupply: initialSupply,
                transferAddress: transferAnswers.transferAddress
            },
            targetAddress: answers.targetAddress,
            deployment: {
                txHash: receipt.txid,
                contractAddress: contractAddress,
                abi: abi,
                bytecode: cleanBytecode,
                attempts: attempts,
                confirmationTime: attempts * delayBetweenAttempts / 1000
            }
        };

        if (!data.protocols) data.protocols = [];
        if (!data.operations) data.operations = [];

        data.protocols.push({
            address: contractAddress,
            ...operationData
        });
        data.operations.push(operationData);
        saveData(data);

        logger.success('\nDeploy completado com sucesso na TRON!');
        logger.info(`Endereço do Contrato: ${contractAddress}`);
        logger.info(`TX Hash: ${receipt.txid}`);
        logger.info(`Tempo total de confirmação: ${attempts * delayBetweenAttempts / 1000} segundos`);
        logger.info(`\nLinks Úteis:`);
        logger.info(`Tronscan: https://tronscan.org/#/contract/${contractAddress}`);
        logger.info(`Transação: https://tronscan.org/#/transaction/${receipt.txid}`);

    } catch (error) {
        logger.error('\nErro durante o deploy TRON:');
        logger.error(error.message);
        if (error.stack) logger.error(error.stack);

        const data = loadData();
        data.operations.push({
            id: `deploy_error_tron_${Date.now()}`,
            type: 'DEPLOY_ERROR_TRON',
            timestamp: new Date().toISOString(),
            status: 'failed',
            error: error.message,
            stack: error.stack
        });
        saveData(data);
    }

    await returnToMenu(mainMenuRef);
}

module.exports = {
    deployNewProtocol
};