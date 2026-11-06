'use strict';
const { MessageChannel, receiveMessageOnPort } = require('node:worker_threads');
const { port1, port2 } = new MessageChannel();
function send(port, method, value, list) { port[method](value, list); }
const buffer = new ArrayBuffer(2);
const view = new Uint8Array(buffer);
view[0] = 42;
send(port1, ['post', 'Message'].join(''), { view }, [buffer]);
if (buffer.byteLength !== 0 || view.length !== 0) throw new Error('computed send did not detach');
if (receiveMessageOnPort(port2).message.view[0] !== 42) throw new Error('computed send lost bytes');
console.log('computed postMessage moves storage and detaches views');
port1.close(); port2.close();
