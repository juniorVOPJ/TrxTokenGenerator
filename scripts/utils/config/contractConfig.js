// scripts/utils/config/contractConfig.js
module.exports = {
    deployment: {
        feeLimit: 100000000,
        userFeePercentage: 100,
        originEnergyLimit: 10000000,
        callValue: 0
    },
    compiler: {
        version: '0.8.20',
        optimizer: {
            enabled: true,
            runs: 200
        }
    }
};