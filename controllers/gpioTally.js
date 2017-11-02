/*
 * Rapspberry GPIO-Tally
 *
 * Output Atem-Tally on Raspberry Pi GPIOs
 */
var log = require('../libs/log.js')('GPIO');

// maps camera tally to raspberry gpio (electrical numbering)
var GPIO_MAP = [11, 13, 15, 16, 18, 7, 12, 22, 29, 31];
var enabled = [];
var gpio;

try {
    gpio = require('pi-gpio');
} catch(err) {
    log('Error, pi-gpio module missing.');
    return;
}

function GPIO_Controller() {
    // Enable pins
    for (var i = 0; i < GPIO_MAP.length; i++) {
        gpio.open(GPIO_MAP[i], 'output', this.handleEnable.bind(this, GPIO_MAP[i]))
    }

    // Close gpios on exit
    process.on('exit', function(code) {
        for (var i = 0; i < enabled.length; i++) {
            gpio.close(enabled[i]);
        }
    });
}

GPIO_Controller.prototype = {
    handleEnable: function(pin, err) {
        if (err) {
            return log('Error, Initializing PIN', pin, 'Failed:', err.message)
        }
        enabled.push(pin);
    }

    handleWriteError: function(pin, err) {
        if (err) {
            log('Error, Writing PIN', pin, 'Failed:' + err.message)
        }
    }

    trigger: function() {
      atem.events.on('tallyBySource', function(count, sources, tally) {
          for (var i = 0; i < Math.min(count, GPIO_MAP.length); i++) {
              var src = sources[i + 1];
              var pin = GPIO_MAP[i];
              if (enabled.indexOf(pin) !== -1)
                  gpio.write(pin, tally[i + 1] & 0x1, handleWriteError.bind(pin));
          }
      });
    }
}

var ctrl = new GPIO_Controller();

module.exports = {
    trigger: ctrl.trigger.bind(ctrl)
}
