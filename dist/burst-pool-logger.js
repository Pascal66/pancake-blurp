const fs = require('fs');

const enabled = false;
const toConsole = false;
const toFile = true;
const toGeneralFile = false;
const generalLogFilename = 'log_general.txt';

/**
 * @return {string}
 */
function TimeStamp() {
    const date = new Date();
    let hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;
    let min = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;
    let sec = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;
    const year = date.getFullYear();
    let month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;
    let day = date.getDate();
    day = (day < 10 ? "0" : "") + day;
    return year + "-" + month + "-" + day + "_" + hour + "-" + min + "-" + sec;
}

/**
 * @return {string}
 */
function TimeStampFile() {
    const date = new Date();
    let hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;
    let min = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;
    let sec = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;
    const year = date.getFullYear();
    let month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;
    let day = date.getDate();
    day = (day < 10 ? "0" : "") + day;
    return day + "-" + month + "-" + year;
}

function write(name, text) {
    if (enabled) {
        if (toFile) {
            fs.appendFile('log_' + name + '.txt', TimeStamp() + ' ' + text + '\n', function (err) {
                if (err) throw err;
            });
        }
        if (toGeneralFile) {
            fs.appendFile(generalLogFilename, TimeStamp() + ' (' + name + ') ' + text + '\n', function (err) {
                if (err) throw err;
            });
        }
        if (toConsole) {
            console.log('(logger.' + name + ") " + text);
        }
    }
}

function writeDateLog(text) {
    if (enabled) {

        if (toFile) {
            fs.exists('./Logs/log_' + TimeStampFile() + '.txt', function (exists) {
                if (exists) {
                    fs.appendFile('./Logs/log_' + TimeStampFile() + '.txt', TimeStamp() + ' ' + text + '\n', function (err) {
                        if (err) throw err;
                    });
                } else {
                    fs.writeFile('./Logs/log_' + TimeStampFile() + '.txt', TimeStamp() + ' ' + text + '\n', function (err) {
                        if (err) {
                            return console.log(err);
                        }

                        //  console.log("The file was saved!");
                    });
                }
            });
        }
    }
}

module.exports = {
    write: write,
    writeDateLog: writeDateLog,
    TimeStamp: TimeStamp
};
//# sourceMappingURL=burst-pool-logger.js.map
