/*
 * TCP-Tally Server
 *
 * Sends Tally info to connected clients.
 */
var connected = false;
var net = require('net');
var EventEmitter = require('events');
var events = new EventEmitter();
var log = require('../libs/log.js')('Tally');
var clients = [];
var lastState = null;

var server = net.createServer((client) => {
    clients.push(client);
    log("Client connected, Total:", clients.length)
    client.write(lastState);
    client.on('end', () => {
        console.log('Client disconnected, Total:', clients.length);
        clients.splice(clients.indexOf(client), 1);
    });
});

server.on("error", (err) => {
    log(err.message)
});

server.listen(5800, () => {
    log('Listening on port 5800');
});

const atemHandlers = {
    tallyBySource: function (count, sources, tally) {
        log("sending tally", tally, "to", clients.length, "clients")
        var state = JSON.stringify({
            count: count,
            sources: sources,
            tally: tally
        })

        for (let i = 0; i < clients.length; i++) {
            clients[i].write(state);
        }
        lastState = state;
    }
}


module.exports = {
  on: events.on.bind(events),
  trigger: function(name, ...rest) {
    if (atemHandlers[name])
      atemHandlers[name].apply(null, rest);
  }
}

