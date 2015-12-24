
/* Raspberry GPIO Tally */
(function(){
    if(!config.gpio)
        return;

    // maps camera tally to raspberry gpio (electrical numbering)
    var GPIO_MAP = [11, 13, 15, 16, 18, 7, 12, 22, 29, 31];
    var enabled = [];
    var gpio;

    try{
        gpio = require('pi-gpio');
    }catch(err){
        log.gpio('Failed: This is Probably not a PI');
        return;
    }
    log.gpio('Enabled: This seems to be a PI');

    var markEnabled = function(pin, err){
        if(err){
            return log.gpio('Error, Initializing PIN', pin, 'Failed:', err.message)
        }
        enabled.push(pin);
    }

    for(var i=0; i < GPIO_MAP.length; i++){
        gpio.open(GPIO_MAP[i], 'output', markEnabled.bind(this, GPIO_MAP[i]))
    }

    var handleWriteError = function(pin, err){
        if(err){
            log.pgio('Error, Writing PIN', pin, 'Failed:' + err.message)
        }
    }

    atem.events.on('tallyBySource', function(count, sources, tally){
        for (var i = 0; i < Math.min(count, GPIO_MAP.length); i++){
            var src = sources[i + 1];
            var pin = GPIO_MAP[i];
            if(enabled.indexOf(pin) !== -1)
                gpio.write(pin, tally[i + 1] & 0x1, handleWriteError.bind(pin));
        }
    });

    process.on('exit', function(code){
        for (var i=0; i<enabled.length; i++){
            gpio.close(enabled[i]);
        }
    });
}());
