const poolSession = require('./burst-pool-session');
const poolConfig = require('./burst-pool-config');
const jsonMarkup = require('json-markup');
const jsonFormat = require('prettyjson');
let url = require('url');
const request = require('request');
const compression = require('compression');
const express = require('express');
const httpProxy = require('http-proxy');
const path = require('path');
const http = require('http');
const bodyParser = require('body-parser');
const io = require('socket.io')();
let ioSocket = null;

function duplicate(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function clientLogFormatted(str) {
    ioSocket.emit('log', str);
}

function initWalletProxy() {
    for (let i = 0; i < poolConfig.wallets.length; i++) {
        poolConfig.wallets[i].proxy = httpProxy.createProxyServer({});
        poolConfig.wallets[i].proxy.on('error', (err, req, res) => {
            console.log(err);
            res.writeHead(500, {'Content-Type': 'text/plain'});
            res.end('Internal Server Error, or Resource Temporary Unavailable');
        });
    }
}

function proxify(req, res) {
    if (poolConfig.walletIndex < poolConfig.wallets.length) {
        try {
            const proxy = poolConfig.wallets[poolSession.getWalletNdx()].proxy;
            proxy.web(req, res, {target: poolConfig.wallets[poolSession.getWalletNdx()].walletUrl});
        } catch (e) {
            console.log('exception while proxify');
            console.log(e);
            console.trace();
        }
    }
}

function doRedirection(req, body) {
    if (poolConfig.redirection.enabled === true) {
        const redirectUrl = poolConfig.redirection.target + req.url;
        request({
            url: redirectUrl,
            method: 'POST',
            body: body
        }, () => {
        });
    }
}

function transformRequest(req, res, nonceSubmitReqHandler) {
    let reqBody = '';
    req.on('data', reqChunk => {
        if (req.isSubmitNonce === true) {
            reqBody += reqChunk;
            if (reqBody.length > 1024) {
                req.connection.destroy();
            }
        }
    });

    req.on('end', () => {
        if (req.isSubmitNonce === true) {
            if (reqBody.length > 0) {
                req.url = `/burst?${reqBody}`;
                nonceSubmitReqHandler(req);
            }
            reqBody = '';
        }
        doRedirection(req, reqBody);
    });
    nonceSubmitReqHandler(req);
}

function transformResponse(req, res, nonceSubmitedHandler) {
    let recvBuffer = '';
    const _write = res.write;
    res.write = data => {
        if (typeof data != 'undefined') {
            recvBuffer += data.toString();
        }
    };

    const _end = res.end;
    res.end = () => {
        try {
            if (recvBuffer.length > 0) {
                if (recvBuffer[0] != '{') {
                    //console.log(recvBuffer);
                } else {
                    const response = JSON.parse(recvBuffer);
                    if (req.isSubmitNonce === true) {
                        nonceSubmitedHandler(req, response);
                    }
                    //else if(req.isMiningInfo === true){
                    //    recvBuffer = miningInfoHandler(response);
                    //}
                }
            }
        } catch (e) {
            console.log(e);
            console.trace();
        }
        _write.call(res, recvBuffer);
        _end.call(res);
    };
}

function respondToGetMiningInfo(req, res) {
    res.writeHead(200, {"Content-Type": "application/json"});
    res.end(JSON.stringify(poolSession.getMiningInfoCache()));
}

function initHttpAPIServer(nonceSubmitReqHandler, nonceSubmitedHandler) {

    const poolHttpServer = http.createServer((req, res) => {
        transformRequest(req, res, nonceSubmitReqHandler);
        if (req.hasOwnProperty('isMiningInfo') && req.isMiningInfo) {
            respondToGetMiningInfo(req, res);
        } else {
            transformResponse(req, res, nonceSubmitedHandler);
            proxify(req, res);
        }
    });

    poolHttpServer.listen(poolConfig.poolPort, "0.0.0.0");
    console.log(`burst pool running on port ${poolConfig.poolPort}`);
}

function initWebsocketServer(newClientHandler) {
    const ioOption = {
        origins: '*:*',
        'pingTimeout': 60000,
        'allowUpgrades': true,
        'transports': ['polling', 'websocket']
    };

    ioSocket = io.listen(poolConfig.websocketPort, ioOption);
    console.log(`websocket running on port ${poolConfig.websocketPort}`);
    ioSocket.on('connection', newClientHandler);

    function sendHeartbeat() {
        setTimeout(sendHeartbeat, 5000);
        ioSocket.emit('ping', {beat: 1});
    }

    setTimeout(sendHeartbeat, 5000);
}

function initWebserver() {
    const app = express();

    app.use(compression({
        threshold: 64
    }));
    app.use(express.static(path.join(__dirname, 'client')));
    app.use(bodyParser.urlencoded({
        extended: true
    }));

    app.get('/burst', (req, res) => {
        //setTimeout(function(){
        request.get({
            url: `http://127.0.0.1:${poolConfig.poolPort}${req.url}`,
            method: 'GET'
        }).pipe(res);
        //}, Math.random()*500);
    });

    app.post('/burst', (req, res) => {
        //setTimeout(function(){
        request({
            url: `http://127.0.0.1:${poolConfig.poolPort}${req.url}`,
            method: 'POST',
            form: req.body
        }, (err, response, body) => {
            if (typeof body != 'undefined' && body != null && body.length > 0) {
                res.write(body);
            }
            res.end();
        });
        //}, Math.random()*500);
    });

    app.use((req, res, next) => {
        res.send('404 Not Found');
    });

    app.listen(poolConfig.httpPort, () => {
        console.log(`http server running on port ${poolConfig.httpPort}`);
    });
}

function consoleJson(json) {
    try {
        console.log(jsonFormat.render(json));
    } catch (e) {
        console.log('jsonFormat error');
        console.trace();
    }
}

function clientLogJson(json) {
    try {
        const str = jsonMarkup(json);
        ioSocket.emit('log', str);
        if (poolConfig.logWebsocketToConsole === true) {
            consoleJson(json);
        }
    } catch (e) {
        console.log("jsonMarkup error");
        console.trace();
    }
}

function clientUnicastLogJson(socket, json) {
    try {
        const str = jsonMarkup(json);
        socket.emit('log', str);
    } catch (e) {
        console.log("jsonMarkup error");
        console.trace();
    }
}

function clientLog(str) {
    ioSocket.emit('log', `<span class="json-text">${str}</span>`);
    if (poolConfig.logWebsocketToConsole === true) {
        console.log(str);
    }
}

function clientUnicastLog(socket, str) {
    socket.emit('log', `<span class="json-text">${str}</span>`);
    if (poolConfig.logWebsocketToConsole === true) {
        console.log(str);
    }
}

module.exports = {
    start: (nonceSubmitReqHandler, nonceSubmitedHandler, newClientHandler) => {
        try {
            http.globalAgent.maxSockets = 100;
            initWebserver();
            initWalletProxy();
            initHttpAPIServer(nonceSubmitReqHandler, nonceSubmitedHandler);
            initWebsocketServer(newClientHandler);
        } catch (e) {
            console.log(e);
            console.trace();
        }
    },
    getWebsocket: () => ioSocket,
    clientLogJson: clientLogJson,
    clientUnicastLogJson: clientUnicastLogJson,
    clientLog: clientLog,
    clientLogFormatted: clientLogFormatted,
    clientUnicastLog: clientUnicastLog,
    consoleJson: consoleJson,
    httpPostForm: (req, formData, done) => {
        try {
            const form = duplicate(formData);
            form.requestType = req;
            request.post({
                url: poolSession.getWalletUrl(),
                form: form
            }, done);
        } catch (e) {
            console.log(e);
            console.trace();
        }
    }
};
//# sourceMappingURL=burst-pool-protocol.js.map
