// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OmniumAnchor
 * @notice Anchors Omnium state to the blockchain for trustless verification
 *
 * Features:
 * - Head CID resolution (permanent, on-chain IPNS alternative)
 * - State checkpoints with timestamps (provable history)
 * - Temporal locks for T2/T∞ conversions
 * - Merkle root storage for provenance proofs
 */
contract OmniumAnchor {
    // =========================================================================
    // TYPES
    // =========================================================================

    struct Checkpoint {
        bytes32 headCid;        // CID of the ChainStore head
        bytes32 snapshotCid;    // CID of the LedgerSnapshot
        bytes32 provenanceRoot; // Merkle root of all unit provenance
        uint64 height;          // Monotonic height from ChainStore
        uint64 timestamp;       // Block timestamp when anchored
        uint64 totalSupply;     // Total Ω in circulation (scaled by 1e18)
        uint32 unitCount;       // Number of units
    }

    struct TemporalLock {
        bytes32 unitCid;        // CID of the locked unit
        address owner;          // Who can unlock
        uint64 amount;          // Locked magnitude (scaled by 1e18)
        uint64 lockTime;        // When locked
        uint64 unlockTime;      // When unlockable
        uint8 fromStratum;      // Original temporal stratum (0=T0, 1=T1, 2=T2, 3=T∞)
        uint8 toStratum;        // Target temporal stratum
        bool released;          // Whether already released
    }

    // =========================================================================
    // STATE
    // =========================================================================

    // Node registry: nodeId => current head CID
    mapping(bytes32 => bytes32) public heads;

    // Node => checkpoint history
    mapping(bytes32 => Checkpoint[]) public checkpoints;

    // Node => latest checkpoint index
    mapping(bytes32 => uint256) public latestCheckpoint;

    // Temporal locks: lockId => TemporalLock
    mapping(bytes32 => TemporalLock) public temporalLocks;

    // Owner => their lock IDs
    mapping(address => bytes32[]) public ownerLocks;

    // Provenance inclusion proofs: provenanceHash => checkpoint index where proven
    mapping(bytes32 => mapping(bytes32 => uint256)) public provenanceProofs;

    // Node operators (can publish for a node)
    mapping(bytes32 => mapping(address => bool)) public operators;

    // Node owners
    mapping(bytes32 => address) public nodeOwners;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event HeadUpdated(
        bytes32 indexed nodeId,
        bytes32 indexed headCid,
        uint64 height,
        uint64 timestamp
    );

    event CheckpointCreated(
        bytes32 indexed nodeId,
        uint256 indexed checkpointIndex,
        bytes32 headCid,
        bytes32 provenanceRoot,
        uint64 height
    );

    event TemporalLockCreated(
        bytes32 indexed lockId,
        bytes32 indexed nodeId,
        address indexed owner,
        bytes32 unitCid,
        uint64 amount,
        uint64 unlockTime,
        uint8 toStratum
    );

    event TemporalLockReleased(
        bytes32 indexed lockId,
        address indexed owner,
        uint64 amount
    );

    event ProvenanceAnchored(
        bytes32 indexed nodeId,
        bytes32 indexed provenanceHash,
        uint256 checkpointIndex
    );

    event NodeRegistered(
        bytes32 indexed nodeId,
        address indexed owner
    );

    event OperatorUpdated(
        bytes32 indexed nodeId,
        address indexed operator,
        bool authorized
    );

    // =========================================================================
    // MODIFIERS
    // =========================================================================

    modifier onlyNodeOperator(bytes32 nodeId) {
        require(
            nodeOwners[nodeId] == msg.sender || operators[nodeId][msg.sender],
            "Not authorized for this node"
        );
        _;
    }

    modifier onlyNodeOwner(bytes32 nodeId) {
        require(nodeOwners[nodeId] == msg.sender, "Not node owner");
        _;
    }

    // =========================================================================
    // NODE MANAGEMENT
    // =========================================================================

    /**
     * @notice Register a new node
     * @param nodeId Unique identifier for the node (e.g., hash of libp2p peer ID)
     */
    function registerNode(bytes32 nodeId) external {
        require(nodeOwners[nodeId] == address(0), "Node already registered");
        nodeOwners[nodeId] = msg.sender;
        operators[nodeId][msg.sender] = true;
        emit NodeRegistered(nodeId, msg.sender);
    }

    /**
     * @notice Update operator authorization
     */
    function setOperator(bytes32 nodeId, address operator, bool authorized)
        external
        onlyNodeOwner(nodeId)
    {
        operators[nodeId][operator] = authorized;
        emit OperatorUpdated(nodeId, operator, authorized);
    }

    // =========================================================================
    // HEAD CID RESOLUTION (IPNS Alternative)
    // =========================================================================

    /**
     * @notice Update the head CID for a node
     * @param nodeId The node identifier
     * @param headCid The new head CID (as bytes32)
     * @param height The monotonic height
     */
    function updateHead(bytes32 nodeId, bytes32 headCid, uint64 height)
        external
        onlyNodeOperator(nodeId)
    {
        // Ensure height is monotonically increasing
        if (checkpoints[nodeId].length > 0) {
            require(
                height > checkpoints[nodeId][latestCheckpoint[nodeId]].height,
                "Height must increase"
            );
        }

        heads[nodeId] = headCid;
        emit HeadUpdated(nodeId, headCid, height, uint64(block.timestamp));
    }

    /**
     * @notice Resolve a node's current head CID
     * @param nodeId The node to resolve
     * @return headCid The current head CID
     */
    function resolveHead(bytes32 nodeId) external view returns (bytes32) {
        return heads[nodeId];
    }

    // =========================================================================
    // CHECKPOINTS (Provable History)
    // =========================================================================

    /**
     * @notice Create a full checkpoint with provenance root
     */
    function createCheckpoint(
        bytes32 nodeId,
        bytes32 headCid,
        bytes32 snapshotCid,
        bytes32 provenanceRoot,
        uint64 height,
        uint64 totalSupply,
        uint32 unitCount
    ) external onlyNodeOperator(nodeId) {
        // Validate height increase
        uint256 numCheckpoints = checkpoints[nodeId].length;
        if (numCheckpoints > 0) {
            require(
                height > checkpoints[nodeId][numCheckpoints - 1].height,
                "Height must increase"
            );
        }

        Checkpoint memory cp = Checkpoint({
            headCid: headCid,
            snapshotCid: snapshotCid,
            provenanceRoot: provenanceRoot,
            height: height,
            timestamp: uint64(block.timestamp),
            totalSupply: totalSupply,
            unitCount: unitCount
        });

        checkpoints[nodeId].push(cp);
        latestCheckpoint[nodeId] = numCheckpoints;
        heads[nodeId] = headCid;

        emit CheckpointCreated(nodeId, numCheckpoints, headCid, provenanceRoot, height);
        emit HeadUpdated(nodeId, headCid, height, uint64(block.timestamp));
    }

    /**
     * @notice Get checkpoint count for a node
     */
    function getCheckpointCount(bytes32 nodeId) external view returns (uint256) {
        return checkpoints[nodeId].length;
    }

    /**
     * @notice Get a specific checkpoint
     */
    function getCheckpoint(bytes32 nodeId, uint256 index)
        external
        view
        returns (Checkpoint memory)
    {
        require(index < checkpoints[nodeId].length, "Checkpoint not found");
        return checkpoints[nodeId][index];
    }

    /**
     * @notice Get the latest checkpoint
     */
    function getLatestCheckpoint(bytes32 nodeId)
        external
        view
        returns (Checkpoint memory)
    {
        uint256 count = checkpoints[nodeId].length;
        require(count > 0, "No checkpoints");
        return checkpoints[nodeId][count - 1];
    }

    // =========================================================================
    // PROVENANCE PROOFS
    // =========================================================================

    /**
     * @notice Verify a provenance entry exists in a checkpoint's Merkle tree
     * @param nodeId The node
     * @param checkpointIndex Which checkpoint
     * @param provenanceHash Hash of the provenance entry
     * @param proof Merkle proof (array of sibling hashes)
     * @param index Position in the tree
     */
    function verifyProvenance(
        bytes32 nodeId,
        uint256 checkpointIndex,
        bytes32 provenanceHash,
        bytes32[] calldata proof,
        uint256 index
    ) external view returns (bool) {
        require(checkpointIndex < checkpoints[nodeId].length, "Checkpoint not found");

        bytes32 root = checkpoints[nodeId][checkpointIndex].provenanceRoot;
        return _verifyMerkleProof(proof, root, provenanceHash, index);
    }

    /**
     * @notice Anchor a provenance hash to a checkpoint (for indexing)
     */
    function anchorProvenance(
        bytes32 nodeId,
        uint256 checkpointIndex,
        bytes32 provenanceHash,
        bytes32[] calldata proof,
        uint256 index
    ) external {
        require(
            this.verifyProvenance(nodeId, checkpointIndex, provenanceHash, proof, index),
            "Invalid proof"
        );

        provenanceProofs[nodeId][provenanceHash] = checkpointIndex;
        emit ProvenanceAnchored(nodeId, provenanceHash, checkpointIndex);
    }

    /**
     * @notice Check if a provenance hash has been anchored
     */
    function isProvenanceAnchored(bytes32 nodeId, bytes32 provenanceHash)
        external
        view
        returns (bool anchored, uint256 checkpointIndex)
    {
        uint256 idx = provenanceProofs[nodeId][provenanceHash];
        // Index 0 could be valid, so we check if there are any checkpoints
        if (checkpoints[nodeId].length == 0) {
            return (false, 0);
        }
        // If stored index is 0, verify it's actually anchored vs default value
        if (idx == 0 && provenanceProofs[nodeId][provenanceHash] == 0) {
            // Check if it was explicitly set by seeing if checkpoint exists
            return (checkpoints[nodeId].length > 0 && provenanceProofs[nodeId][provenanceHash] == 0, 0);
        }
        return (true, idx);
    }

    // =========================================================================
    // TEMPORAL LOCKS
    // =========================================================================

    /**
     * @notice Create a temporal lock (T0 → T2/T∞ conversion)
     * @param nodeId The Omnium node
     * @param unitCid CID of the unit being locked
     * @param amount Amount to lock (scaled by 1e18)
     * @param lockDuration How long to lock (seconds)
     * @param toStratum Target stratum (2=T2, 3=T∞)
     */
    function createTemporalLock(
        bytes32 nodeId,
        bytes32 unitCid,
        uint64 amount,
        uint64 lockDuration,
        uint8 toStratum
    ) external returns (bytes32 lockId) {
        require(toStratum >= 2, "Must lock to T2 or higher");
        require(amount > 0, "Amount must be positive");

        // T2 = 20 years minimum, T∞ = forever (max uint64)
        uint64 minDuration = toStratum == 2 ? 20 * 365 days : type(uint64).max;
        require(lockDuration >= minDuration, "Duration too short for stratum");

        lockId = keccak256(abi.encodePacked(
            nodeId,
            unitCid,
            msg.sender,
            block.timestamp,
            amount
        ));

        require(temporalLocks[lockId].lockTime == 0, "Lock already exists");

        uint64 unlockTime = toStratum == 3
            ? type(uint64).max  // T∞ never unlocks
            : uint64(block.timestamp) + lockDuration;

        temporalLocks[lockId] = TemporalLock({
            unitCid: unitCid,
            owner: msg.sender,
            amount: amount,
            lockTime: uint64(block.timestamp),
            unlockTime: unlockTime,
            fromStratum: 0, // Always from T0
            toStratum: toStratum,
            released: false
        });

        ownerLocks[msg.sender].push(lockId);

        emit TemporalLockCreated(
            lockId,
            nodeId,
            msg.sender,
            unitCid,
            amount,
            unlockTime,
            toStratum
        );

        return lockId;
    }

    /**
     * @notice Release a temporal lock (T2 → T0 conversion)
     * @param lockId The lock to release
     */
    function releaseTemporalLock(bytes32 lockId) external {
        TemporalLock storage lock = temporalLocks[lockId];

        require(lock.lockTime > 0, "Lock not found");
        require(lock.owner == msg.sender, "Not lock owner");
        require(!lock.released, "Already released");
        require(lock.toStratum != 3, "T-infinity cannot be released");
        require(block.timestamp >= lock.unlockTime, "Lock not expired");

        lock.released = true;

        emit TemporalLockReleased(lockId, msg.sender, lock.amount);
    }

    /**
     * @notice Check if a lock can be released
     */
    function canRelease(bytes32 lockId) external view returns (bool) {
        TemporalLock storage lock = temporalLocks[lockId];
        return lock.lockTime > 0
            && !lock.released
            && lock.toStratum != 3
            && block.timestamp >= lock.unlockTime;
    }

    /**
     * @notice Get all locks for an owner
     */
    function getOwnerLocks(address owner) external view returns (bytes32[] memory) {
        return ownerLocks[owner];
    }

    /**
     * @notice Get lock details
     */
    function getLock(bytes32 lockId) external view returns (TemporalLock memory) {
        return temporalLocks[lockId];
    }

    // =========================================================================
    // INTERNAL HELPERS
    // =========================================================================

    /**
     * @notice Verify a Merkle proof
     */
    function _verifyMerkleProof(
        bytes32[] calldata proof,
        bytes32 root,
        bytes32 leaf,
        uint256 index
    ) internal pure returns (bool) {
        bytes32 computedHash = leaf;

        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];

            if (index % 2 == 0) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }

            index = index / 2;
        }

        return computedHash == root;
    }
}
