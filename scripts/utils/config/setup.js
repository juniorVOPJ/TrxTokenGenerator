// scripts/utils/config/setup.js
const { ethers } = require('hardhat');
const chalk = require('chalk');
const { NETWORKS } = require('./constants');
const { loadData } = require('../data/loader');

async function initializeSystem() {
    console.clear();
    console.log(chalk.blue('====================================='));
    console.log(chalk.blue('    Sistema de Protocolo Flash TRON  '));
    console.log(chalk.blue('====================================='));

    try {
        // Testar conexão primeiro
        const connected = await tronUtils.testConnection();
        if (!connected) {
            throw new Error('Não foi possível estabelecer conexão com a rede TRON');
        }

        const account = await tronUtils.getAccount();
        const balance = await tronUtils.getBalance(account);
        const bandwidth = await tronUtils.getBandwidth(account);

        console.log(chalk.gray('\nAmbiente TRON:'));
        console.log('Rede:', chalk.cyan('TRON Mainnet'));
        console.log('Conta:', chalk.cyan(account));
        console.log('Saldo:', chalk.cyan(balance), 'TRX');
        console.log('Bandwidth:', chalk.cyan(bandwidth));
        console.log('API Key:', chalk.cyan(process.env.TRONSCAN_API_KEY ? 'Configurada' : 'Não configurada'));

        return {
            network: 'TRON',
            account,
            balance
        };
    } catch (error) {
        console.error(chalk.red('\nErro detalhado na inicialização TRON:'));
        console.error(chalk.red('Mensagem:', error.message));
        console.error(chalk.red('Código:', error.response?.status));
        console.error(chalk.red('Dados:', JSON.stringify(error.response?.data, null, 2)));

        throw new Error(`Erro ao inicializar TRON: ${error.message}`);
    }
}

module.exports = {
    initializeSystem
};