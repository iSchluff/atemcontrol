var net = require('net');

var log= {
    net: console.log.bind(this, 'TCP -'),
    gpio: console.log.bind(this, 'GPIO -')
};

// maps camera tally to raspberry gpio (electrical numbering)
var GPIO_MAP = [11, 13, 15, 16, 18, 7, 12, 22, 29, 31];
var enabled = [];
var gpio;

try{
    gpio = require('pi-gpio');
}catch(err){
    log.gpio('Failed: This is Probably not a PI');
    process.exit(0);
}
log.gpio('Enabled: This seems to be a PI');

for(var i=0; i<GPIO_MAP.length; i++){
    gpio.close(GPIO_MAP[i]);
}

var markEnabled = function(pin, err){
    if(err){
        return log.gpio('Error, Initializing PIN', pin, 'Failed:', err.message)
    }
    enabled.push(pin);
}

var handleWriteError = function(pin, err){
    if(err){
        log.pgio('Error, Writing PIN', pin, 'Failed:' + err.message)
    }
}

for(var i=0; i < GPIO_MAP.length; i++){
    gpio.open(GPIO_MAP[i], 'output', markEnabled.bind(this, GPIO_MAP[i]))
}

process.on('exit', function(code){
    for(var i=0; i<GPIO_MAP.length; i++){
        gpio.close(GPIO_MAP[i]);
    }
});

var connections = 0;
var server = net.createServer(function(c) { //'connection' listener
    log.net('client connected');

    // only listen to first connection
    if(++connections == 1){
        c.on('data', function(buf){
            // log.net("recv tally", buf.toString());
            var str = buf.toString();
            var data = JSON.parse(str);
            for (var i = 0; i < Math.min(data.count, GPIO_MAP.length); i++){
                var src = data.sources[i + 1];
                var pin = GPIO_MAP[i];
                if(enabled.indexOf(pin) !== -1){
                    var value = (data.tally[i + 1] & 0x1)
                    console.log("set ", pin, value);
                    gpio.write(pin, value, handleWriteError.bind(pin));
                }
            }
        })
    }

    c.on('end', function() {
        connections--;
        log.net('client disconnected');
    });
});
server.listen(8124, function() { //'listening' listener
    log.net('server bound');
});

// atem.events.on('tallyBySource', function(count, sources, tally){
//     for (var i = 0; i < Math.min(count, GPIO_MAP.length); i++){
//         var src = sources[i + 1];
//         var pin = GPIO_MAP[i];
//         if(enabled.indexOf(pin) !== -1)
//             gpio.write(pin, tally[i + 1] & 0x1, handleWriteError.bind(pin));
//     }
// });
