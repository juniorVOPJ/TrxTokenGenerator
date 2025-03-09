// scripts/utils/config/constants.js
const path = require('path');

module.exports = {
    DATA_DIR: path.join(__dirname, '../../../data'),

    NETWORK: {
        TRON: {
            name: 'TRON Mainnet',
            chainId: 1,
            rpc: process.env.TRON_MAINNET_URL,
            explorer: 'https://tronscan.org'
        }
    },

    OPERATION_TYPES: {
        DEPLOY: 'DEPLOY',
        CONFIGURE: 'CONFIGURE',
        EXECUTE: 'EXECUTE',
        FLASH_LOAN: 'FLASH_LOAN',
        VIRTUAL_BALANCE: 'VIRTUAL_BALANCE',
        CHECK: 'CHECK',
        ERROR: 'ERROR'
    },

    STATUS: {
        PENDING: 'pending',
        COMPLETED: 'completed',
        FAILED: 'failed'
    },

    PROTOCOL: {
        DEFAULT_DECIMALS: 6, // TRON geralmente usa 6 decimais
        DEFAULT_SYMBOL: 'USDT',
        DEFAULT_NAME: 'Tether USD',
        DEFAULT_SUPPLY: '1000000000'
    },

    TRON: {
        MIN_ENERGY: 10000,
        MIN_BANDWIDTH: 1000,
        FEE_LIMIT: parseInt(process.env.TRON_FEE_LIMIT),
        CONSUME_USER_RESOURCE_PERCENT: parseInt(process.env.TRON_CONSUME_USER_RESOURCE_PERCENT)
    }
};