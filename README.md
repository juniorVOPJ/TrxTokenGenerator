# Flash Protocol System - TRON

Sistema de geração e análise de tokens TRC20 para investigação de golpes em criptomoedas.

## Descrição

Este sistema foi desenvolvido para auxiliar investigações de golpes sofisticados envolvendo tokens na rede TRON. Ele permite:

- Geração de tokens com comportamentos específicos
- Análise de vulnerabilidades
- Documentação de operações suspeitas 
- Monitoramento de transações

## Instalação

1. Clone o repositório:
```bash
git clone https://github.com/juniorVOPJ/TronTokenGenerator.git
cd TronTokenGenerator
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente (.env):
```bash
# Configurações TRON
TRON_MAINNET_URL=https://api.trongrid.io
TRON_PRIVATE_KEY=[chave-privada-trongrid]
TRONGRID_API_KEY=[chave-de-api-trongrid]
TRON_FEE_LIMIT=100000000
TRON_CONSUME_USER_RESOURCE_PERCENT=30
```

## Uso

### Comandos Principais

- Iniciar sistema na mainnet:
```bash
npm start
```

- Deploy na mainnet:
```bash
npm run deploy
```

- Compilar contratos:
```bash
npm run compile
```

- Limpar cache:
```bash
npm run clean
```

### Funcionalidades

1. Deploy de novos protocolos
2. Configuração de balanços virtuais
3. Execução de flash loans
4. Monitoramento de operações
5. Exportação de relatórios

## Estrutura do Projeto

```
├── contracts/
│   ├── FlashProtocol.sol
│   └── LendingProtocol.sol
├── scripts/
│   ├── menu.js
│   └── utils/
├── data/
├── test/
└── config/
```

## Dependências Principais

- hardhat: ^2.22.19
- ethers: ^6.13.5
- @openzeppelin/contracts: ^5.2.0
- inquirer: ^8.2.6
- moment-timezone: ^0.5.47
- chalk: ^4.1.2
- tronweb: ^5.3.0
- solc: ^0.8.20

## Configuração Hardhat

```javascript
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: "london"
    }
  },
  networks: {
    tron: {
      url: process.env.TRON_MAINNET_URL,
      network_id: "1",
      accounts: [process.env.TRON_PRIVATE_KEY],
      userFeePercentage: 100,
      feeLimit: 100000000,
      originEnergyLimit: 10000000,
      fullHost: process.env.TRON_MAINNET_URL,
      headers: {
        "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY
      }
    }
  }
}
```

## Configurações TRON

### Mainnet
- Nome: TRON Mainnet
- Network ID: 1
- Explorer: https://tronscan.org
- Saldo Mínimo: 100 TRX

### Recursos Necessários
- Energy: Mínimo 10,000
- Bandwidth: Mínimo 1,000
- Fee Limit: 100,000,000 Sun
- Resource Percent: 30%

## Configurações de Deploy

- Fee Limit: 100,000,000 Sun
- User Fee Percentage: 100
- Origin Energy Limit: 10,000,000
- Call Value: 0
- Compiler Version: 0.8.20
- Optimizer Runs: 200

## Segurança

- Este sistema deve ser usado apenas para fins de investigação legal
- As chaves privadas nunca devem ser compartilhadas
- Recomenda-se usar apenas em ambiente controlado
- Sempre verifique os custos de energia e bandwidth
- Mantenha saldo suficiente para operações (mínimo 100 TRX)

## Documentação

Para mais detalhes sobre cada módulo e funcionalidade, consulte:

- [Documentação dos Contratos](./docs/contracts.md)
- [Guia de Operações](./docs/operations.md)
- [Análise de Vulnerabilidades](./docs/security.md)

## Licença

MIT License - veja [LICENSE](LICENSE) para mais detalhes.