burst-pool
==========

pool-config.js

"blockMature" amount of blocks the pool goes back and checks for block winner

"txFeePercent" Currently not implemented. tx fee is currently added to block reward and then a pool fee is applied to that total - 0.01 = 1%

"poolFee" the percent a pool owner charges for hosting etc. 0.01 = 1%

"poolPort" the port the pool is run on. default 8124

"poolPvtKey" pool private key

"poolPublicRS" pool public BURST- Address

"poolPublic" Pool numerical burst address

"poolFeePaymentAddr" where the fees for Pool Fee should get sent

"cumulativeFundReduction" % to reserve for each prior round.

"logWebsocketToConsole" output whats sent to peoples browsers into the console window

"maxRoundCount" max rounds to display in all round shares. any that exceed this are deleted

"maxRecentPaymentHistory" max lines to show in payment history

In the pool config.js a useful feature if you ever have to swap hosts is

redirection : {

      enabled : false,
      
      target : 'http://8.8.8.8:8124'
      
  },
  
so change the 8.8.8.8 on the old server config to the new servers ip and enabled to true then it should forward all the requests.

tip - make sure you also change a few characters in the old servers passphase so the pool doesnt accidentally pay out twice
