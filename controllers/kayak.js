/*
 * Kayak-Controller
 *
 * Reads Grassvalley Kayak-DD Panel commands.
 */
var log= console.log.bind(console, 'KAYAK -');
var dgram = require('dgram');
var EventEmitter = require('events');
var events = new EventEmitter();
var socket = dgram.createSocket('udp4');

var PORT = 56629;
var HOST = '0.0.0.0';

/* ATEM command helper */
var cmd = events.emit.bind(events, 'cmd');

socket.on('listening', function () {
    var address = socket.address();
    log('Server listening on ' + address.address + ":" + address.port);
});

socket.on('message', function (message, remote) {
    var type, id, data, counter;
    if(message.length == 22){
        type = 'TypeA';
        id = message.readUInt32LE(2, 4);
        data = message.readInt16LE(6);
        counter = message.readInt16LE(18);

    }else if(message.length == 21){
        type = 'TypeB';
        id = message.readUInt32LE(2, 4);
        data = message.readInt16LE(6);
        counter = message.readInt16LE(17);
    }

    if (id) {
        log(type, 'id', id.toString(16), 'data', data.toString(16), 'counter', counter);

        switch (id) {
        case 0x60800e4:
            cmd('cut');
            break;

        case 0x50800e4:
            cmd('auto');
            break;
        }

        if (id == 0x1010025) {
            var btn = data & 0xff
            var isPressed = (data >> 4) & 0xff;
            if(isPressed && btn > 0)
                cmd('setProgram', btn)

        }else if (id == 0x2010025) {
            var btn = data & 0xff
            var isPressed = (data >> 4) & 0xff;
            if(isPressed && btn > 0)
                cmd('setPreview', btn)

        }else if (id == 0xb0800a5) {
            var pos = data / 0x7fff;
            cmd('setTransitionPosition', pos);

        }
    } else {
        log('unknown message', 'length:', message.length)
    }

    // console.log(message.length);
    // console.log(remote.address + ':' + remote.port +' - ' + message);
});

socket.bind(PORT, HOST);

exports.on= events.on.bind(events);

// TODO: send info back to the mixer panel
exports.trigger= function (name, data) {

}
