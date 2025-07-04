const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const API_BASE = 'https://blockstream.info/api';

// Helper function to check if a public key for an address has been revealed
const hasPublicKeyBeenRevealed = async (address) => {
    try {
        const res = await fetch(`${API_BASE}/address/${address}/txs`);
        if (!res.ok) {
            // If the address is new/has no transactions, the API might 404 or return error.
            // In this case, the public key has not been revealed.
            return false;
        }
        const txs = await res.json();
        // If there are no transactions, public key is not revealed.
        if (!txs || txs.length === 0) {
            return false;
        }
        // Check if the address has been used as an input in any transaction
        for (const tx of txs) {
            for (const vin of tx.vin) {
                if (vin.prevout && vin.prevout.scriptpubkey_address === address) {
                    return true; // Public key is revealed when spending
                }
            }
        }
        return false;
    } catch (error) {
        console.error('Error checking public key revelation:', error);
        // Fail safe: assume not revealed if there's an error.
        return false;
    }
};

app.get('/check/:address', async (req, res) => {
    const { address } = req.params;
    if (!address) {
        return res.status(400).json({ error: 'Bitcoin address is required' });
    }

    try {
        const publicKeyRevealed = await hasPublicKeyBeenRevealed(address);

        const utxoRes = await fetch(`${API_BASE}/address/${address}/utxo`);
        if (!utxoRes.ok) {
            if (utxoRes.status === 400) {
                 return res.status(400).json({ error: 'Invalid Bitcoin address format.' });
            }
            // If no UTXOs, it might return non-200 or an empty array.
            // If empty, it's not vulnerable as there's no funds.
            return res.json([]);
        }
        const utxos = await utxoRes.json();

        if (utxos.length === 0) {
            return res.json([]);
        }

        const results = [];
        for (const utxo of utxos) {
            const txRes = await fetch(`${API_BASE}/tx/${utxo.txid}`);
            const tx = await txRes.json();
            const vout = tx.vout[utxo.vout];
            
            if (!vout || vout.scriptpubkey_address !== address) continue;

            const scriptType = vout.scriptpubkey_type;
            let isVulnerable = false;
            let reason = '';

            switch (scriptType) {
                case 'p2pk':
                    isVulnerable = true;
                    reason = 'P2PK: Public key is directly in the script.';
                    break;
                case 'p2tr':
                    isVulnerable = true;
                    reason = 'P2TR (Taproot): Public key is part of the output script.';
                    break;
                case 'p2pkh':
                case 'v0_p2wpkh': // p2wpkh
                    if (publicKeyRevealed) {
                        isVulnerable = true;
                        reason = `${scriptType.toUpperCase().replace('V0_', '')}: Public key was revealed in a previous transaction from this address.`;
                    } else {
                        isVulnerable = false;
                        reason = `${scriptType.toUpperCase().replace('V0_', '')}: Safe, as long as no funds are spent from this address.`;
                    }
                    break;
                default:
                    isVulnerable = false; // Assume safe by default for unknown types
                    reason = `Script type '${scriptType}' is not checked or is considered safe.`;
                    break;
            }

            results.push({
                txid: utxo.txid,
                vout: utxo.vout,
                value: utxo.value,
                scriptType: scriptType,
                isVulnerable: isVulnerable,
                reason: reason,
            });
        }

        res.json(results);
    } catch (error) {
        console.error('Error processing address:', error);
        res.status(500).json({ error: 'Failed to fetch or process Bitcoin address data.' });
    }
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
