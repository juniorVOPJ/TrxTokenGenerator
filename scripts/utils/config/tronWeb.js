const TronWeb = require('tronweb');

// Configuração do TronWeb com a nova API key
const tronWeb = new TronWeb({
    fullNode: process.env.TRON_MAINNET_URL,
    solidityNode: process.env.TRON_MAINNET_URL,
    eventServer: process.env.TRON_MAINNET_URL,
    privateKey: process.env.TRON_PRIVATE_KEY,
    headers: {
        "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY
    }
});

// Funções auxiliares para TRON
const tronUtils = {
    async getAccount() {
        try {
            const account = tronWeb.defaultAddress.base58;
            if (!account) {
                throw new Error('Conta TRON não encontrada');
            }
            return account;
        } catch (error) {
            console.error('Erro ao obter conta TRON:', error);
            throw error;
        }
    },

    async getBalance(address) {
        try {
            const balance = await tronWeb.trx.getBalance(address);
            return tronWeb.fromSun(balance);
        } catch (error) {
            console.error('Erro ao obter saldo TRON:', error);
            throw error;
        }
    },

    async getBandwidth(address) {
        try {
            const accountResources = await tronWeb.trx.getAccountResources(address);
            return accountResources.freeNetUsed || 0;
        } catch (error) {
            console.error('Erro ao obter bandwidth TRON:', error);
            throw error;
        }
    },

    async getEnergy(address) {
        try {
            const accountResources = await tronWeb.trx.getAccountResources(address);
            return accountResources.EnergyLimit || 0;
        } catch (error) {
            console.error('Erro ao obter energy TRON:', error);
            throw error;
        }
    },

    async testConnection() {
        try {
            // Teste de conexão básica
            const nodeInfo = await tronWeb.trx.getNodeInfo();
            console.log('Conexão TRON estabelecida:', nodeInfo.configNodeInfo);
            return true;
        } catch (error) {
            console.error('Erro na conexão TRON:', error.message);
            return false;
        }
    },

    async deployContract(abi, bytecode, params = []) {
        try {
            const options = {
                feeLimit: process.env.TRON_FEE_LIMIT,
                userFeePercentage: process.env.TRON_CONSUME_USER_RESOURCE_PERCENT,
                originEnergyLimit: 10000000
            };

            const contract = await tronWeb.contract().new({
                abi: abi,
                bytecode: bytecode,
                parameters: params,
                ...options
            });

            return contract;
        } catch (error) {
            console.error('Erro no deploy do contrato:', error);
            throw error;
        }
    },

    async getContract(address) {
        try {
            return await tronWeb.contract().at(address);
        } catch (error) {
            console.error('Erro ao obter contrato:', error);
            throw error;
        }
    },

    async waitForTransaction(txId) {
        try {
            let attempts = 0;
            const maxAttempts = 20;

            while (attempts < maxAttempts) {
                const tx = await tronWeb.trx.getTransaction(txId);
                if (tx && tx.ret && tx.ret[0].contractRet === 'SUCCESS') {
                    return tx;
                }
                await new Promise(resolve => setTimeout(resolve, 3000));
                attempts++;
            }
            throw new Error('Transação não confirmada após tempo limite');
        } catch (error) {
            console.error('Erro ao aguardar transação:', error);
            throw error;
        }
    },

    async verifyContract(address) {
        try {
            const code = await tronWeb.trx.getContract(address);
            return code !== null && code.contract_address === address;
        } catch (error) {
            console.error('Erro ao verificar contrato:', error);
            return false;
        }
    },

    // Funções específicas para Flash Loan
    async executeFlashLoan(contract, amount) {
        try {
            const tx = await contract.executeLoan(amount).send({
                feeLimit: process.env.TRON_FEE_LIMIT
            });
            return await this.waitForTransaction(tx);
        } catch (error) {
            console.error('Erro na execução do Flash Loan:', error);
            throw error;
        }
    },

    async setVirtualBalance(contract, target, amount) {
        try {
            const tx = await contract.setVirtualBalance(target, amount).send({
                feeLimit: process.env.TRON_FEE_LIMIT
            });
            return await this.waitForTransaction(tx);
        } catch (error) {
            console.error('Erro ao configurar balanço virtual:', error);
            throw error;
        }
    }
};

// Testar conexão ao inicializar
tronUtils.testConnection().then(connected => {
    if (connected) {
        console.log('Sistema TRON inicializado com sucesso');
    } else {
        console.error('Falha ao inicializar sistema TRON');
    }
});

module.exports = {
    tronWeb,
    tronUtils
};