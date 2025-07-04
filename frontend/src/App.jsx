import React, { useState } from 'react';
import './App.css';

function App() {
    const [address, setAddress] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCheck = async () => {
        if (!address) {
            setError('Please enter a Bitcoin address.');
            return;
        }
        setIsLoading(true);
        setError('');
        setResults([]);

        try {
            // The backend is running on localhost:3001
            const res = await fetch(`http://localhost:3001/check/${address}`);
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || `HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            setResults(data);
        } catch (e) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="App">
            <header className="App-header">
                <h1>Bitcoin Quantum Vulnerability Checker</h1>
                <p>Enter a Bitcoin address to check its UTXOs for quantum vulnerability.</p>
            </header>
            <main>
                <div className="input-section">
                    <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Enter Bitcoin Address"
                    />
                    <button onClick={handleCheck} disabled={isLoading}>
                        {isLoading ? 'Checking...' : 'Check Address'}
                    </button>
                </div>
                {error && <p className="error">{error}</p>}
                <div className="results-section">
                    {results.length > 0 && (
                        <table>
                            <thead>
                                <tr>
                                    <th>TXID</th>
                                    <th>Value (BTC)</th>
                                    <th>Script Type</th>
                                    <th>Quantum Safety</th>
                                    <th>Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((utxo, index) => (
                                    <tr key={index} className={utxo.isVulnerable ? 'vulnerable' : 'safe'}>
                                        <td>{`${utxo.txid.substring(0, 10)}...`}</td>
                                        <td>{(utxo.value / 100000000).toFixed(8)}</td>
                                        <td>{utxo.scriptType.toUpperCase().replace('V0_', '')}</td>
                                        <td>{utxo.isVulnerable ? 'Vulnerable' : 'Safe'}</td>
                                        <td>{utxo.reason}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </main>
        </div>
    );
}

export default App;
