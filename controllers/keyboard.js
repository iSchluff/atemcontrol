/*
 * Keyboard-Controller
 *
 * Map keyboard-keys to atem commands
 */
var EventEmitter = require('events');
var events = new EventEmitter();
var stdin = process.stdin;

/* ATEM command helper */
var cmd = events.emit.bind(events, 'cmd');

/* Only enable if we have raw access and aren't a child process */
if (process.stdin.setRawMode && !process.connected) {
    process.stdin.setRawMode(true);
    process.stdin.on('data', function (buffer) {
        var s = "";
        for (var i=0; i<buffer.length; i++) {
            s += String(buffer[i]) + " ";
        }

        console.log(s);
        if (buffer.length == 1) {
            if (buffer[0] == 3)
                process.exit(0);
            else if (buffer[0] > 48 && buffer[0] < 58)
                cmd('setPreview', buffer[0] - 48);
            else if (buffer[0] == 99)
                cmd('cut');
            else if (buffer[0] == 97)
                cmd('auto');
        }

        // process.stdout.write('Get Chunk: ' + buffer.toString() + '\n');
        // if (key && key.ctrl && key.name == 'c') process.exit();
    });
} else {
    console.log('ATEM - Child Mode, disabling keyboard control');
}

exports.on= events.on.bind(events);
// exports.trigger= function(name, data){}
