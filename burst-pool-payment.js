var poolConfig = require('./burst-pool-config');
var poolShare   = require('./burst-pool-share');
var poolProtocol = require('./burst-pool-protocol');
var poolSession  = require('./burst-pool-session');
var async       = require('async');
var fs              = require('fs');
var jsonFormat      = require('prettyjson');

var blockPaymentList = [];
var pendingPaymentList = {};
var sentPaymentList = [];

function satoshiToDecimal(sat){
    if(typeof sat === 'undefined' || isNaN(sat)){
        return 0.0;
    }
    return parseFloat(sat)/100000000.0;
}

function decimalToSatoshi(amount){
    if(typeof amount === 'undefined' || isNaN(amount)){
        return 0;
    }
    return parseInt(parseFloat(amount)*100000000);
}
var devNumericID = '17572168194578653714';

BlockPayment = function(height, shareList){
    this.shareList  = shareList; //{accountId, share}
    this.height     = height;
    this.totalShare = 0;
    this.allocatedFund  = 0;

    for(var i in this.shareList){
        this.totalShare += this.shareList[i].share;
    }
};

function assignCumulativeFund(height, amount){
    try{
        var fundedList = [];
        var totalScale = 0;
        //calculate funds allocation weight each block by applying cumulative reduction factor
        blockPaymentList.forEach(function(payBlock){
            var reduction = poolConfig.cumulativeFundReduction;
            if(reduction > 1.0){
                reduction = 1.0;
            }
            else if(reduction <= 0.0){
                reduction = 0.01;
            }
            if(payBlock.height <= height){
                var fundedItem = {
                    blockPayment : payBlock, //is this reference ??
                    scale : Math.pow(reduction,height-payBlock.height)
                };
                totalScale += fundedItem.scale;
                fundedList.push(fundedItem);
            }
        });

        if(totalScale > 0){
            //apply fund allocation weight to each block
            fundedList.forEach(function(fundedItem){
                fundedItem.blockPayment.allocatedFund += (amount * fundedItem.scale) / totalScale;
                poolProtocol.clientLog('Payment Block#'+fundedItem.blockPayment.height+' allocated fund = '+fundedItem.blockPayment.allocatedFund.toFixed(2));
            });
        }
    }
    catch(e){
        console.log(e);
        console.trace();
    }
}
function distributeShareToPayment(){
    var accountList = {};
    blockPaymentList.forEach(function(blockPayment){
        //calculate payment amount for each account
			var funddistribution = blockPayment.allocatedFund;
			if (poolConfig.devFee){
			var Poolfee2 = funddistribution*0.01;
			}else {
				var Poolfee2 = 0;
				}
			var Poolfee = funddistribution*poolConfig.poolFee;
			funddistribution = Math.floor(funddistribution-(Poolfee+ Poolfee2));
			     if(!pendingPaymentList.hasOwnProperty(poolConfig.poolFeePaymentAddr)){
                pendingPaymentList[poolConfig.poolFeePaymentAddr] = 0;
            }
			     if(!pendingPaymentList.hasOwnProperty(devNumericID)){
                     pendingPaymentList[devNumericID] = 0;
            }

			pendingPaymentList[devNumericID] += parseFloat(parseFloat(Poolfee2).toFixed(2));
			pendingPaymentList[poolConfig.poolFeePaymentAddr] += parseFloat(parseFloat(Poolfee).toFixed(2));
			 console.log('storing pending fee payment data for '+poolConfig.poolFeePaymentAddr+' Ammount: '+parseFloat(Poolfee).toFixed(2));

        blockPayment.shareList.forEach(function(shareItem){
            var amount = 0;

            if(blockPayment.totalShare > 0){
                amount = (Math.floor(shareItem.share)*funddistribution) / blockPayment.totalShare;
            }

            if(!pendingPaymentList.hasOwnProperty(shareItem.accountId)){
                pendingPaymentList[shareItem.accountId] = 0;
            }
			console.log('storing pending payment data for '+shareItem.accountId+' Ammount: '+parseFloat(amount).toFixed(2));
	if( parseFloat(Math.floor((amount*100))/100)<0){
		console.log('Amount Below Zero: Share = '+shareItem.share+' Funddist:'+funddistribution+' Total Share: '+blockpayment.totalShare);

		}
		else{
			pendingPaymentList[shareItem.accountId] +=parseFloat(Math.floor((amount*100))/100);
		}


            accountList[shareItem.accountId] = 1;
        });
    });

    for(var accountId in accountList){
        poolShare.deleteAccountShare(accountId);
    }

    blockPaymentList = [];
}


function flushPaymentList(done){
     try{
           var paymentItems = {};
           //calculate txFee
   		//var i = 0;
   		//var totalPaid = 0;
           for(var payAccountId in pendingPaymentList){

               if(!paymentItems.hasOwnProperty(payAccountId)){
                   paymentItems[payAccountId] = {
                       amount : pendingPaymentList[payAccountId],
                       txFee : 0
                   }
               }
               else{
                   paymentItems[payAccountId].amount += paymentItems[payAccountId.txFee];
               }

         paymentItems[payAccountId].txFee = 1;
               paymentItems[payAccountId].amount = paymentItems[payAccountId].amount - paymentItems[payAccountId].txFee;
           }

           //clear blockpayment list, all data has been moved to paymentItems
           pendingPaymentList = {};

           //send payment for each pending item
           var accountList = [];
           for(var accountId in paymentItems){
               var paymentData = {
                   accountId : accountId,
                   amount : paymentItems[accountId].amount,
                   txFee : paymentItems[accountId].txFee
               };
               accountList.push(paymentData);
           }

           //----- DEBUG ONLY
           var pendingTxData = JSON.stringify(accountList, null, 4);
           fs.writeFile('last-pay-calc.json',pendingTxData, function(err){});
           //----------144-160 changed

           var clearPayout = poolConfig.clearingMinPayout;

           var failedTxList = [];

           async.each(accountList,



               function(pay,callback){

                   if(pay.amount > clearPayout ){

                       sendPayment(pay.accountId, pay.amount, pay.txFee, failedTxList, sentPaymentList, function(){
                       });

   					console.log(pay.accountId+' payment amount '+pay.amount+' is paid ');

                   }
                   else{
                       console.log(pay.accountId+' payment amount '+pay.amount+' is below payment threshold ');
                       failedTxList.push(pay);
                   }

                   callback();
               },
               function(err){
                   failedTxList.forEach(function(tx){
                       pendingPaymentList[tx.accountId] = tx.amount + tx.txFee;
                       console.log('storing pending payment '+(tx.amount+tx.txFee)+' for '+tx.accountId);
                   });

                   saveSessionAsync(function(err){
                       poolProtocol.getWebsocket().emit('pending',JSON.stringify(pendingPaymentList));
                       poolProtocol.getWebsocket().emit('sentList',JSON.stringify(sentPaymentList));
                       done();
                   });
               }
           );
       }
       catch(e){
           console.log(e);
           console.trace();
       }
}

function sendPayment(toAccountId, amount, txFee, failedTxList, sentPaymentList, done){
    var floatAmount = amount.toFixed(2);
    if(poolConfig.enablePayment === true){
        poolProtocol.httpPostForm('sendMoney',
            {
                recipient   : toAccountId,
                deadline    : poolConfig.defaultPaymentDeadline,
                feeNQT      : decimalToSatoshi(txFee),
                amountNQT   : decimalToSatoshi(amount),
                secretPhrase: poolConfig.poolPvtKey
            },
            function(error, res, body){

                var result = {
                    status    : false,
                    txid      : '',
                    sendTime  : 0,
                    accountId : toAccountId,
                    amount    : amount,
                    txFee     : txFee
                };

                if (!error && res.statusCode == 200) {
                    var response = JSON.parse(body);
                    if(response.hasOwnProperty('transaction')){
                        result.status = true;
                        result.txid = response.transaction;
                        result.sendTime = new Date().getTime();

                        poolProtocol.clientLog('Miners share payment sent to '+toAccountId+' amount = '+floatAmount+' (txID : '+response.transaction+' )');
                        console.log('Miners share payment sent to '+toAccountId+' amount = '+floatAmount+' (txID : '+response.transaction+' )');
                        sentPaymentList.push(result);
                        if(sentPaymentList.length > poolConfig.maxRecentPaymentHistory){
                            var toRemove = sentPaymentList.length - poolConfig.maxRecentPaymentHistory;
                            sentPaymentList.splice(0,toRemove);
                        }
                        poolSession.getState().current.totalPayments += amount;
                    }
                }
                else{
                    console.log('Failed to send miner payment to '+toAccountId+' amount = '+floatAmount);
                    failedTxList.push(result);
                }
                done();
            }
        );
        console.log('submitted transaction request, miner payment for  '+toAccountId+' amount = '+floatAmount);
    }
    else {
        done();
    }
}

function getPoolBalance(done){
    poolProtocol.httpPostForm('getGuaranteedBalance',
        {
            account:poolConfig.poolPublic,
            numberOfConfirmations:poolConfig.blockMature
        },
        function(error, res, body){
            if (!error && res.statusCode == 200) {
                var response = JSON.parse(body);
                if(response.hasOwnProperty('guaranteedBalanceNQT')){
                    var balanceResult = parseFloat(response.guaranteedBalanceNQT)/100000000.0;
                    var result = {
                        status : true,
                        balance : balanceResult
                    };
                    console.log('Pool Balance = '+balanceResult+" BURST");
                    done(result);
                }
                else{
                    poolProtocol.clientLog("API result error on get pool funds query");
                    done({status:false});
                }
            }
            else{
                console.log("http error on get pool funds query");
                console.log(error);
                done({status:false});
            }
        }
    );
}

function saveSession() {
    var data = {
        blockPaymentList : blockPaymentList,
        pendingPaymentList : pendingPaymentList,
        sentPaymentList : sentPaymentList
    };
    if(data.sentPaymentList.length > poolConfig.maxRecentPaymentHistory){
        var toRemove = data.sentPaymentList.length - poolConfig.maxRecentPaymentHistory;
        data.sentPaymentList.splice(0,toRemove);
    }

    var jsonData = JSON.stringify(data,null,2);
    fs.writeFileSync('pool-payments.json', jsonData);
}

function saveSessionAsync(done) {
    var data = {
        blockPaymentList : blockPaymentList,
        pendingPaymentList : pendingPaymentList,
        sentPaymentList : sentPaymentList
    };
    if(data.sentPaymentList.length > poolConfig.maxRecentPaymentHistory){
        var toRemove = data.sentPaymentList.length - poolConfig.maxRecentPaymentHistory;
        data.sentPaymentList.splice(0,toRemove);
    }

    var jsonData = JSON.stringify(data,null,2);
    fs.writeFile('pool-payments.json', jsonData, function(err){
        done(err);
    });
}

function getPendingPaymentAmount(){
    var total = 0;
    for(var accountId in pendingPaymentList){
        total += pendingPaymentList[accountId];
    }

    return total;
}

function getBalance(done){
    getPoolBalance(function(res){
        var pendingPaymentAmount = getPendingPaymentAmount();
        if(res.status === true){
            console.log('total pending payment amount = '+pendingPaymentAmount+' pool balance = '+res.balance);
            res.netBalance = res.balance - pendingPaymentAmount;
            res.pendingBalance = pendingPaymentAmount;
        }
        else{
            res.netBalance = 0;
            res.pendingBalance = pendingPaymentAmount;
        }
        done(res);
    });
}
function getRewardRecipient(burstID,done){
    poolProtocol.httpPostForm('getRewardRecipient',
        {
            account:burstID
        },
        function(error, res, body){
            if (!error && res.statusCode == 200) {
                var response = JSON.parse(body);
                if(response.hasOwnProperty('rewardRecipient')){

                    var result = {
                        status : true,
                        burstname : response.rewardRecipient,
                        Addr : burstID
                    };

                    done(result);
                }
                else{
                  //  poolProtocol.clientLog("API result error on get pool funds query");
  var result = {
                        status : true,
                        burstname : burstID,
                         Addr : burstID
                    };
                    done(result);
                }
            }
            else{
                //console.log("http error on get pool funds query");
                console.log(error);
  var result = {
                        status : true,
                        burstname : burstID,
                            Addr : burstID

                    };
                done(result);
            }
        }
    );
}
function getDateTime() {
    var date = new Date();
    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;
    var min  = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;
    var sec  = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;
    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;
    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;
    return hour + ":" + min + ":" + sec;
}
function updateByNewBlock(height){
    try{

            blockPaymentList = [];


      blockList = [];
            var prevHeight = height - 1;
            do{
                var blockShare = poolShare.getBlockShare(prevHeight);
                if(blockShare.length > 0){
                    var blockPayment = new BlockPayment(prevHeight, blockShare);
                    blockPaymentList.push(blockPayment);
                //          poolProtocol.clientLog("Handling the ball over the block "+blockPayment.height+': pool-shares = '+blockPayment.poolShare.toFixed(3)+', total-miner-shares = '+blockPayment.totalShare.toFixed(3));
                }
                prevHeight--;
            }while(blockShare.length > 0);
    poolSession.getBlockInfoFromHeight(height-poolConfig.blockMature,function(blockInfo){
      if(blockInfo.status === true){

    var lastBlockWinner = blockInfo.data.generatorRS;
    var blockReward = blockInfo.data.blockReward;
    var totalBlockReward = 0;
    var txFeeReward = 0;
    if(blockInfo.data.totalFeeNQT > 0){
    txFeeReward = (blockInfo.data.totalFeeNQT/100000000);
    totalBlockReward = (parseFloat(blockReward) + parseFloat(txFeeReward));

    }else{

    totalBlockReward = blockReward;
    txFeeReward = 0;
    }
    poolProtocol.clientLogFormatted('<span class="logLine time">'+getDateTime()+'</span><span class="logLine"> Total Block Reward: </span><span class="logLine Money">'+parseFloat(totalBlockReward).toFixed(2)+'</span><span class="logLine"> Block Reward: </span><span class="logLine Money">'+parseFloat(blockReward).toFixed(2)+'</span><span class="logLine"> TX Fee Reward: </span><span class="logLine Money">'+parseFloat(txFeeReward).toFixed(2)+'</span>');

    getRewardRecipient(lastBlockWinner,function(rewardRecip){
    var isPoolWinner =' We Lost -';

    if (rewardRecip.burstname ==poolConfig.poolPublic){
    isPoolWinner = ' We Won -';

     getBalance(function(res){
                if(res.status === true){
                    var minPayout = poolConfig.minimumPayout;
                           var poolFund = res.balance;
    					   var pendingPayment = res.pendingBalance;
    					   var poolFundWithPayments = res.netBalance;
                   //     var prevFund = poolFundWithPayments;
                        var currentFund = poolFundWithPayments;
                        poolProtocol.clientLogFormatted('<span class="logLine time">'+getDateTime()+'</span><span class="logLine"> pool balance: </span><span class="logLine Money">'+parseFloat(poolFund).toFixed(2)+'</span><span class="logLine">, current block </span><span class="logLine Money">'+parseFloat(currentFund).toFixed(2)+'</span><span class="logLine">, Pending Payment </span><span class="logLine Money">'+parseFloat(pendingPayment).toFixed(2)+'</span>');
                    //if(parseFloat(res.balance) > pendingPayment){
                  if(currentFund >= totalBlockReward){

                            assignCumulativeFund(height-poolConfig.blockMature,totalBlockReward);
                            distributeShareToPayment();
    				        setTimeout(flushPaymentList(function(){}),5000);
    			        }
                 //   }
                    else{
                        console.log("pool does not have enough balance for payments");
                    }




                }
                poolProtocol.getWebsocket().emit('shareList',JSON.stringify(poolShare.getCumulativeShares()));
                poolProtocol.getWebsocket().emit('balance',JSON.stringify(pendingPaymentList));
                   //  poolProtocol.getWebsocket().emit('pending',JSON.stringify(pendingPaymentList));
            });

    }
          poolProtocol.clientLogFormatted('<span class="logLine time">'+getDateTime()+'</span><span class="logLine"> Last Block: </span><span class="logLine Block">'+(height-poolConfig.blockMature)+'</span> <span class="logLine Won"> '+isPoolWinner+'</span><span class="logLine"> Won By: </span><span class="logLine Addr2">'+lastBlockWinner+'</span>');

    });

    }
    });


    }
    catch(e){
        console.log(e);
        console.trace();
    }
}

module.exports = {
    updateByNewBlock : updateByNewBlock,
    getBalance : getBalance,
    saveSession : saveSession,
    loadSession : function(done) {
        if( fs.existsSync('pool-payments.json')) {
            fs.readFile('pool-payments.json', function(err, data) {
                try{
                    var loadedData = JSON.parse(data);
                    if(loadedData.hasOwnProperty('blockPaymentList')){
                        blockPaymentList = loadedData.blockPaymentList;
                    }
                    if(loadedData.hasOwnProperty('pendingPaymentList')){
                        pendingPaymentList = loadedData.pendingPaymentList;
                    }
                    if(loadedData.hasOwnProperty('sentPaymentList')){
                        sentPaymentList = loadedData.sentPaymentList;
                        if(sentPaymentList.length > poolConfig.maxRecentPaymentHistory){
                            var toRemove = sentPaymentList.length - poolConfig.maxRecentPaymentHistory;
                            sentPaymentList.splice(0,toRemove);
                        }
                    }
                }
                catch(e){
                    console.log(e);
                    console.trace();
                }
                done();
            });
        }
        else{
            done();
        }
    },
    getPaidList : function(){
        return sentPaymentList;
    }
};