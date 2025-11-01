// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, ebool, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Encrypted Lucky Draw
/// @notice Participants register with encrypted identifiers. The contract draws a winner while keeping the
/// selection encrypted so each participant can privately verify whether they won.
/// @author GPT-5 Codex
contract EncryptedLuckyDraw is SepoliaConfig {
    address private immutable ADMIN_ADDRESS;
    uint256 private immutable MAX_PARTICIPANTS;

    address[] private _participants;
    mapping(address participant => bool isRegistered) private _registered;
    mapping(address participant => uint32 slot) private _indices;
    mapping(address participant => euint32 encryptedId) private _encryptedIds;
    mapping(address participant => ebool lastWin) private _winStatus;

    euint32 private _encryptedWinnerIndex;
    bool private _hasDrawn;
    uint256 private _lastDrawTimestamp;

    /// @notice Emitted whenever a participant successfully registers for the draw.
    /// @param participant The registering account.
    /// @param index The zero-based position assigned to the participant.
    event ParticipantRegistered(address indexed participant, uint32 indexed index);

    /// @notice Emitted after a draw completes.
    /// @param randomnessCommitment Hash of the randomness input used for the draw.
    /// @param participantCount Number of participants that were considered.
    event WinnerDrawn(bytes32 randomnessCommitment, uint256 indexed participantCount);

    error AlreadyRegistered();
    error NotRegistered();
    error NotAuthorized();
    error NoParticipants();

    /// @notice Sets the deployer as the administrator for future draws.
    /// @param maxParticipants Maximum number of participants allowed in the draw.
    constructor(uint256 maxParticipants) {
        ADMIN_ADDRESS = msg.sender;
        MAX_PARTICIPANTS = maxParticipants;
    }

    modifier onlyAdmin() {
        if (msg.sender != ADMIN_ADDRESS) {
            revert NotAuthorized();
        }
        _;
    }

    /// @notice Register for the lucky draw by submitting an encrypted participant identifier.
    /// @dev Users can only register once.
    /// @param encryptedIdInput Ciphertext handle containing the participant identifier.
    /// @param inputProof Zero-knowledge proof accompanying the ciphertext.
    function register(externalEuint32 encryptedIdInput, bytes calldata inputProof) external {
        if (_registered[msg.sender]) {
            revert AlreadyRegistered();
        }
        if (_participants.length >= MAX_PARTICIPANTS) {
            revert("Maximum participants reached");
        }

        euint32 encryptedId = FHE.fromExternal(encryptedIdInput, inputProof);

        _participants.push(msg.sender);
        uint32 participantIndex = uint32(_participants.length - 1);
        _indices[msg.sender] = participantIndex;
        _registered[msg.sender] = true;

        _encryptedIds[msg.sender] = encryptedId;
        FHE.allowThis(_encryptedIds[msg.sender]);
        FHE.allow(_encryptedIds[msg.sender], msg.sender);

        ebool initialWin = FHE.asEbool(false);
        _winStatus[msg.sender] = initialWin;
        FHE.allowThis(_winStatus[msg.sender]);
        FHE.allow(_winStatus[msg.sender], msg.sender);

        if (_hasDrawn) {
            FHE.allow(_encryptedWinnerIndex, msg.sender);
        }

        emit ParticipantRegistered(msg.sender, participantIndex);
    }

    /// @notice Draw a winner among the registered participants. Only the admin can trigger draws.
    /// @dev Pseudo-randomness derived from block data. For production deployments, integrate a verifiable source.
    function drawWinner() external onlyAdmin {
        uint256 count = _participants.length;
        if (count == 0) {
            revert NoParticipants();
        }

        uint256 randomSeed = uint256(
            keccak256(
                abi.encodePacked(
                    blockhash(block.number - 1),
                    block.prevrandao,
                    block.timestamp,
                    count,
                    _lastDrawTimestamp
                )
            )
        );
        uint32 winnerIndex = uint32(randomSeed % count);

        _encryptedWinnerIndex = FHE.asEuint32(winnerIndex);
        _lastDrawTimestamp = block.timestamp;
        _hasDrawn = true;

        FHE.allowThis(_encryptedWinnerIndex);

        bytes32 commitment = keccak256(abi.encode(randomSeed, block.number, blockhash(block.number - 1)));

        for (uint256 i = 0; i < count; ++i) {
            address participant = _participants[i];

            ebool isWinner = FHE.eq(_encryptedWinnerIndex, FHE.asEuint32(uint32(i)));
            _winStatus[participant] = isWinner;

            FHE.allowThis(_winStatus[participant]);
            FHE.allow(_winStatus[participant], participant);
            FHE.allow(_encryptedWinnerIndex, participant);
        }

        emit WinnerDrawn(commitment, count);
    }

    /// @notice Check whether an address has already registered.
    /// @param participant Address to query.
    /// @return True when the participant is registered.
    function isRegistered(address participant) external view returns (bool) {
        return _registered[participant];
    }

    /// @notice Get the number of registered participants.
    /// @return Total participant count.
    function participantCount() external view returns (uint256) {
        return _participants.length;
    }

    /// @notice Read the encrypted identifier for a participant.
    /// @dev Reverts if address is not registered.
    /// @param participant Address of the participant.
    /// @return Ciphertext representing the encrypted identifier.
    function getEncryptedId(address participant) external view returns (euint32) {
        if (!_registered[participant]) {
            revert NotRegistered();
        }
        return _encryptedIds[participant];
    }

    /// @notice Get the encrypted boolean indicating whether the participant won in the latest draw.
    /// @dev Reverts if address is not registered.
    /// @param participant Address of the participant.
    /// @return Ciphertext that resolves to true if the participant won.
    function getEncryptedWinStatus(address participant) external view returns (ebool) {
        if (!_registered[participant]) {
            revert NotRegistered();
        }
        return _winStatus[participant];
    }

    /// @notice Get the encrypted winner index for the most recent draw.
    /// @dev Returns zero ciphertext when no draw has occurred yet.
    /// @return Ciphertext identifying the winner slot.
    function getEncryptedWinnerIndex() external view returns (euint32) {
        return _encryptedWinnerIndex;
    }

    /// @notice Get the administrator address.
    /// @return Address of the contract administrator.
    function admin() external view returns (address) {
        return ADMIN_ADDRESS;
    }

    /// @notice Get the maximum number of participants allowed.
    /// @return Maximum participant count.
    function maxParticipants() external view returns (uint256) {
        return MAX_PARTICIPANTS;
    }

    /// @notice Returns the timestamp of the latest draw.
    /// @return Unix timestamp of the last draw execution.
    function lastDrawTimestamp() external view returns (uint256) {
        return _lastDrawTimestamp;
    }
}


