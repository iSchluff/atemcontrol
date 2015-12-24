/*
 * TCP-Tally Server
 *
 * Sends Tally info to connected clients.
 */
var connected = false;
var net = require('net');
var EventEmitter = require('events');
var events = new EventEmitter();
var socket;

var connectionInterval;
var connectSocket = function () {
    socket = new net.Socket();
    socket.connect({port: 8124, host: config.tallyPi});

    socket.on('connect', function () {
        clearInterval(connectionInterval);
        log.tally('Connected to PI');
        connected = true;
    })

    socket.on('error', function (err) {
        if(err.code != 'ECONNREFUSED')
            log.tally('Error:', err.code);
        // log.tally('err', err)
    })

    socket.on('end', function () {
        log.tally('Disconnected');
    })

    socket.on('close', function (had_error) {
        if(had_error)
            socket.destroy();
        clearInterval(connectionInterval);
        connectionInterval = setInterval(connectSocket, 1000);
    })
}
connectionInterval = setInterval(connectSocket, 1000);

atem.events.on('tallyBySource', function (count, sources, tally) {
    if(connected){
        socket.write(JSON.stringify({
            count: count,
            sources: sources,
            tally: tally
        }));
    }
});

exports.on= events.on.bind(events);
exports.trigger= function (name, data) {
    console.log('tcptally trigger');
}
