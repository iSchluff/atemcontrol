const _ = require('underscore');
const Promise = require('bluebird');
const assert = require('assert');
const net = require('net');
const dgram = require('dgram');
const EventEmitter = require('events');
const names = require('./hs6000_api_names');
const mark = {
  STX: 0x02,
  ETX: 0x03
}

const bit = (pos) => {
  Math.pow(2, pos);
}

// Client implementation for the Panasonic HS6000 EXT_IP Protocol
class SwitcherApi extends EventEmitter {
  constructor(host, options) {
    super(host);
    options = _.extend({
      port: 62000,
      receiver: false
    }, options);

    this.status = 'disconnected';
    this.host = host;
    this.options = options;
    this.socket = null;
    this.stack = [];
    this.sendBuffer = Buffer.alloc(300);
    this.sendCount = 0;
    this.sendTimeout = null;
    this.aliveInterval = null;

    // Tally with TSL Protocol 5.0
    if (options.receiver) {
      this.server = dgram.createSocket('udp4');
      this.server.on('error', (err) => {
        console.log(`server error:\n${err.stack}`);
        server.close();
      });

      const handleResponse = function(str) {
        const parts = str.split(':');
        const cmd = parts[0];
        const rest = parts.slice(1);

        console.log('udp received', cmd, rest);
      }

      this.server.on('message', (buf, rinfo) => {
        let start = true;
        let lastEnd = 0;
        const flags = buf.readInt8(3),
          screen = buf.readInt16LE(4);

        // Data is DMSG
        if ((flags & 2) == 0) {
          const index = buf.readInt16LE(6);

          // SDI Inputs are index 1 - 32
          if (index < 24 && index > 32)
            return;

          const tally = buf.readInt16LE(8),
            length = buf.readInt16LE(10),
            label = buf.toString('ascii', 12, 12 + length),
            group1 = (tally & 3),
            group2 = (tally >> 2) & 3,
            group3 = (tally >> 4) & 3;

            this.emit('tally', 32 - index, group1, group2, group3)
        }
      });

      this.server.on('listening', () => {
        var address = this.server.address();
        console.log(`udp socket listening on ${address.address}:${address.port}`);
      });

      this.server.bind(65000);
    }
  }

  set status(status) {
    this._status = status;
    this.emit(status);
  }

  get status() {
    return this._status;
  }

  _send() {
    assert(this.socket != null, 'Switcher not connected');
    this.socket.write(this.sendBuffer);
    this.sendBuffer = Buffer.alloc(300);
    this.sendCount = 0;
    // console.log('DO SEND!');
  }

  send(buf) {
    assert(this.socket != null, 'Switcher not connected');
    // this.socket.write(buf);
    if (this.sendCount + buf.length > this.sendBuffer.length) {
      this._send();
    }

    if (this.sendTimeout)
      clearTimeout(this.sendTimeout);

    buf.copy(this.sendBuffer, this.sendCount);
    this.sendCount += buf.length;
    this.sendTimeout = setTimeout(this._send.bind(this), 16);
  }

  cmd(cmd) {
    assert(cmd.length == 4, 'cmd length must be 4');
    let str = cmd;
    for (var i = 1; i < arguments.length; i++) {
      // assert(rest[i].length == 2, 'param length must be 2');
      str += ':' + arguments[i];
    }

    // generate buffer
    const buf = Buffer.allocUnsafe(str.length + 2);
    buf.writeInt8(mark.STX, 0);
    buf.write(str, 1, str.length, 'ascii')
    buf.writeInt8(mark.ETX, buf.length - 1);

    console.log('cmd', str, this.status);

    if (this.status == 'connected') {
      this.send(buf);
    } else {
      this.connect();
      this.once('connected', () => this.send(buf))
    }
  }

  // reject all deferreds on the stack
  clearStack(error) {
    for (let i = 0; i < this.stack.length; i++) {
      const item = this.stack[i];
      item.deferred.reject(error);
    }
    this.stack = [];
    this.sendBuffer = Buffer.alloc(300);
  }

  handleError(error) {
    console.error('switcher client error');
    this.clearStack(new Error(error.message));

    // clean up tcp connection
    if (this.status == 'connecting') {
      this.socket.end();
      this.socket = null;
      this.status = 'disconnected';
      this.removeAllListeners();
    } else {
      this.dispose();
    }
  }

  handleResponse(str) {
    const parts = str.split(':');
    const cmd = parts[0];
    const rest = parts.slice(1);

    console.log('received', cmd, rest);
    if (cmd == 'EROR') {
      console.error('Switcher Error -', rest);
    } else {
      for (let i = 0; i < this.stack.length; i++) {
        const item = this.stack[i];
        if (item.cmd == cmd) {
          this.stack.splice(i, 1);
          return item.deferred.resolve(rest)
        }
      }

      console.error('No handler registered for ' + cmd);
    }
  }

  // parse switcher responses
  handleData(buf) {
    let start = true;
    let lastEnd = 0;
    // console.log('GOT DATA!')
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] == mark.ETX) {
        process.nextTick(this.handleResponse.bind(this, buf.toString('ascii', lastEnd + 1, i)));
        lastEnd = i + 1;
      }
    }
  }

  handleEnd() {
    console.log('disconnected from switcher');
    this.socket = null;
    this.status = 'disconnected';
  }

  handleTimeout() {
    this.disconnect();
  }

  disconnect() {
    if (this.status != 'connected')
      return;

    this.status = 'disconnecting';
    clearInterval(this.aliveInterval);
    this.aliveInterval = null;
    this.socket.end();
    this.socket = null;
  }

  dispose() {
    this.disconnect();
    this.removeAllListeners();
    if (this.options.receiver)
      this.server.close();
  }

  connect() {
    if (this.status == 'disconnecting')
      return this.once('disconnected', this.connect);

    if (this.status != 'disconnected')
      return;

    this.status = 'connecting';
    return new Promise((resolve, reject) => {
      this.socket = net.connect({host: this.host, port: this.options.port}, () => {
        console.log('connected to switcher');
        this.status = 'connected';
        resolve();
      });

      this.socket.on('error', this.handleError.bind(this));
      this.socket.setTimeout(5000, this.handleTimeout.bind(this));
      this.socket.on('data', this.handleData.bind(this));
      this.socket.on('end', this.handleEnd.bind(this));
    });
  }

  waitFor(cmd) {
    const deferred = Promise.defer();
    this.stack.push({
      time: Date.now(),
      cmd: cmd,
      deferred: deferred
    });
    return deferred.promise;
  }

  setBus(bus, source) {
    this.cmd('SBUS', bus.toString(), source.toString());
    return this.waitFor('ABUS');
  }

  getBus(bus) {
    this.cmd('QBSC', bus.toString());
    return this.waitFor('ABSC');
  }

  // name 0 - Panel Name, 1 - MV name
  // status 00 - default, 01 - User, 02 - Picture (Operation panel only), 03 - Same as panel (MV only)
  setWhatever(name, status) {
    this.cmd('SPST', name.toString(), status.toString());
    return Promise.resolve();
  }

  setSourceName(type, source, name) {
    if (Number.parseInt(source) > 164)
      return Promise.reject(new Error('Valid sources only'));

    if (name.length > 12)
      return Promise.reject(new Error('Source name only up to 12 bytes'))

    this.cmd('SSNM', type.toString(), source.toString(), name);
    return this.waitFor('ASNM');
  }

  getSourceName(type, source) {
    if (Number.parseInt(source) > 164)
      return Promise.reject(new Error('Valid sources only'));

    this.cmd('QSNM', type.toString(), source.toString());
    return this.waitFor('ASNM');
  }
}

module.exports = SwitcherApi;
