var log= console.log.bind(console, 'ATEM -');
var atem = require('./atem.js');
var controllers = [require('./controllers/kayak.js'), require('./controllers/keyboard.js')];

var HOST = '192.168.10.240';

/* Trigger a response to all controllers */
var trigger = function () {
    for (var i=0; i<controllers.length; i++) {
        if (controllers[i].trigger)
            controllers[i].trigger.apply(null, arguments);
    }
}

/* Atem Comand Handler */
var commandHandler = function (name) {
    if (atem[name]) {
        var rest = Array.prototype.slice.call(arguments, 1)
        log('command', name, 'parameters', rest);
        atem[name](rest);
    } else {
        log('Error: unknown command', name, 'parameters', rest);
    }
}

var sendParent = function(message){
    if(process.connected)
        process.send(message);
}

/* Listen to controllers */
for(var i=0; i<controllers.length; i++){
    controllers[i].on('cmd', commandHandler)
}

atem.on('update', function () {
    trigger.apply(null, arguments);
    sendParent({
        type: 'update',
        data: arguments
    })
});

atem.on('state', function (state) {
    log('state:', state.toString(), '-', state.description);
    sendParent({
        type: 'state',
        data: {
            state: state.toString()
        }
    });
})


/* Setup Child Interface */
if (process.connected) {
    log('Child Interface enabled!');

    /* Use Config from Environment */
    var config = JSON.parse(process.env.config);
    if(config.host)
        HOST = config.host;

    process.on('message', function (message) {
        log('received message', message);
        if (message.type == 'command'){
            commandHandler.apply(null, message.data);
        }
    });

    process.send({
        type: 'init'
    });
}

/* Connect to Atem */
atem.connect(HOST);

process.on('uncaughtException', function (err) {
    // handle errors 'safely' by ignoring them
    console.log('fail', err);
    return true;
});
