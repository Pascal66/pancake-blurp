module.exports = {
    wallets: [{
        walletIP: '127.0.0.1',
        walletPort: 8125,
        walletUrl: 'http://127.0.0.1:8125'
    }],
    redirection: {
        enabled: false,
        target: 'http://lhc.ddns.net:8124'
    },
    walletIndex: 0,
    blockMature: 1,
    txFeePercent: 0.0005,
    devFee: true,
    devFeePercent: 0.01,
    poolFee: 0.01,
    poolDiff: 1000000,
    poolDiffCurve: 0.75,
    poolPort: 8124,
    poolPvtKey: '<pool private key>',
    poolPublicRS: 'BURST-995S-DBT2-T4UB-H4N5E',
    poolPublic: '17730252107975728248',
    poolFeePaymentAddr: '14176614198960711717',
    defaultPaymentDeadline: 1440,
    poolFeePaymentTxFeeNQT: 100000000,
    httpPort: 80,
    websocketPort: 4443,
    enablePayment: true,
    minimumPayout: 250.0,
    clearingMinPayout: 2.0,
    lastSessionFile: 'last-session.json',
    cumulativeFundReduction: 0.5,
    logWebsocketToConsole: false,
    maxRoundCount: 97,
    sharePenalty: 0.001,
    maxRecentPaymentHistory: 50
};

/*
 SubmitNonce = {
 secretPhrase, (private-key) ---> secretAccount (public-key)   <----------+
 +-- nonce,                                                                   |
 |   accountId ---> getRewardRecipient() ---> rewardId (public-pool-address) -+
 |            |                                  ^
 } |            |                                  |
 V            V                                  |
 nonce + genAccount                                |
 |            |                                  |
 +____________+                                  |
 |                                        |
 V                                        |
 Deadline                                     |
 |    (if smallest)                       |
 V                                        |
 Forge() ------> getRewardRecipient() --------+
 */
//# sourceMappingURL=burst-pool-config.js.map
