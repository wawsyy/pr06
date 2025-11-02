# FHEVM Hardhat Template

A FHEVM Hardhat-based template for developing Solidity smart contracts with privacy-preserving features.

## Contracts

### FHECounter
A simple fully homomorphic encrypted counter that allows incrementing and decrementing encrypted values while maintaining privacy.

### EncryptedLuckyDraw
A privacy-preserving lottery system where participants can register with encrypted identifiers and participate in draws where winners are determined using encrypted randomness. The system ensures that:
- Participant identities remain confidential
- Winner selection is fair and tamper-proof
- Participants can privately verify their win status

## Features

- **Privacy-First**: All sensitive data is encrypted using FHEVM
- **Verifiable**: Participants can verify lottery results without revealing their identity
- **Configurable**: Maximum participants limit can be set during deployment
- **Secure**: Only contract deployer can trigger draws and reset operations

For more information about how to use this template, please refer to the [FHEVM doc](https://docs.zama.ai/fhevm)
