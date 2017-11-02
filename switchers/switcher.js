const EventEmitter = require('events');

// Generic switcher interface
class Switcher extends EventEmitter {
    constructor(host) {
        super();
        this.host = host;
    }

    emitUpdate() {
        this.emit('update', ...arguments);
    }

    // disconnect must be synchronous
    connect() {}
    disconnect() {}

    // Overwrite with own custom logic
    setProgram() {}
    setPreview() {}
    cut() {}
    auto() {}
    setTransitionPosition() {}
    setTransitionType() {}
    toggleTransitionPreview() {}
    setTransitionMixRate() {}
}

module.exports = Switcher;