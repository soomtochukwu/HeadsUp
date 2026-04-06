const fs = require('fs');

const data = JSON.parse(fs.readFileSync('smc/blockscout_resp.json', 'utf8'));
const result = data.result[0];

// Handle standard-json format directly if returned from blockscout
if (result.SourceCode.startsWith('{{') && result.SourceCode.endsWith('}}')) {
    // Etherscan standard json response
    fs.writeFileSync('smc/standard-input.json', result.SourceCode.substring(1, result.SourceCode.length - 1));
} else if (result.SourceCode.startsWith('{') && result.SourceCode.endsWith('}')) {
    // Sometimes it's a single brace json representation
    try {
        const parsed = JSON.parse(result.SourceCode);
        if (parsed.language === "Solidity") {
             fs.writeFileSync('smc/standard-input.json', result.SourceCode);
        }
    } catch(e) {
       // Proceed to custom building
    }
}

if (!fs.existsSync('smc/standard-input.json')) {
    const standardJson = {
      language: "Solidity",
      sources: {},
      settings: result.CompilerSettings || {
        optimizer: { enabled: true, runs: 200 },
        evmVersion: "paris",
        metadata: { bytecodeHash: "ipfs" },
        outputSelection: { "*": { "*": ["*"], "": ["*"] } }
      }
    };

    // Add main contract
    if (result.FileName && result.SourceCode) {
      standardJson.sources[result.FileName] = {
        content: result.SourceCode
      };
    }

    // Add additional sources
    if (result.AdditionalSources) {
      result.AdditionalSources.forEach(src => {
        standardJson.sources[src.Filename] = {
          content: src.SourceCode
        };
      });
    }
    
    fs.writeFileSync('smc/standard-input.json', JSON.stringify(standardJson, null, 2));
}

console.log("smc/standard-input.json generated successfully.");
