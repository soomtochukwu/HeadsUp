// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title FlipenMessenger
 * @dev A gasless on-chain messaging system using Meta-Transactions and Session Keys.
 */
contract FlipenMessenger is Initializable {
    struct Message {
        address sender;
        string content;
        uint256 timestamp;
    }

    // Storage for all global messages
    Message[] public messages;
    
    // Delegation: Mapping user address to their authorized session key
    mapping(address => address) public authorizedSessionKeys;
    
    // Nonces to prevent replay attacks
    mapping(address => uint256) public nonces;

    event NewMessage(address indexed sender, string content, uint256 timestamp);
    event SessionKeyAuthorized(address indexed user, address indexed sessionKey);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() initializer public {
        // Initialization logic if needed in the future
    }

    /**
     * @dev Authorize a session key to speak on your behalf.
     * This is the "one-time" handshake that enables one-click chatting.
     */
    function authorizeSessionKey(address _sessionKey) external {
        authorizedSessionKeys[msg.sender] = _sessionKey;
        emit SessionKeyAuthorized(msg.sender, _sessionKey);
    }

    /**
     * @dev Post a message on behalf of a user. 
     * This is called by the relayer (Admin) who pays the gas.
     * The signature must come from the AUTHORIZED session key.
     */
    function postMessageFor(
        address _user,
        string memory _content,
        bytes memory _signature
    ) external {
        address sessionKey = authorizedSessionKeys[_user];
        require(sessionKey != address(0), "No session key authorized");

        // Verification logic
        bytes32 messageHash = keccak256(abi.encodePacked(_user, _content, nonces[_user]));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        
        address signer = recoverSigner(ethSignedMessageHash, _signature);
        require(signer == sessionKey, "Invalid session signature");

        // Record the message
        messages.push(Message({
            sender: _user,
            content: _content,
            timestamp: block.timestamp
        }));

        nonces[_user]++;
        emit NewMessage(_user, _content, block.timestamp);
    }

    /**
     * @dev Simple view to get the latest 35 messages
     */
    function getLatestMessages(uint256 _count) external view returns (Message[] memory) {
        uint256 total = messages.length;
        uint256 start = 0;
        if (total > _count) {
            start = total - _count;
        }
        
        uint256 resultSize = total - start;
        Message[] memory result = new Message[](resultSize);
        
        for (uint256 i = 0; i < resultSize; i++) {
            result[i] = messages[start + i];
        }
        
        return result;
    }

    function recoverSigner(bytes32 _hash, bytes memory _signature) internal pure returns (address) {
        require(_signature.length == 65, "Invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := byte(0, mload(add(_signature, 96)))
        }
        return ecrecover(_hash, v, r, s);
    }
}
