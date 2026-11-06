'use strict';
const { MessageChannel, receiveMessageOnPort, markAsUntransferable } = require('node:worker_threads');
const { port1, port2 } = new MessageChannel();
function check(value, message) { if (!value) throw new Error(message); }
function fails(fn, name, message) {
  try { fn(); } catch (error) {
    check(error.name === name && (message === undefined || error.message === message), `${error.name}: ${error.message}`);
    return;
  }
  throw new Error('expected failure');
}

let buffer = new ArrayBuffer(8);
fails(() => port1.postMessage(1, [buffer, buffer]), 'DataCloneError', 'Transfer list contains duplicate ArrayBuffer');
check(buffer.byteLength === 8, 'duplicate detached source');
fails(() => port1.postMessage(1, [new Uint8Array(1)]), 'DataCloneError', 'Found invalid value in transferList.');
fails(() => port1.postMessage(1, [new SharedArrayBuffer(1)]), 'DataCloneError', 'Found invalid value in transferList.');
const detached = new ArrayBuffer(1);
detached.transfer();
fails(() => port1.postMessage(1, [detached]), 'DataCloneError', 'Cannot transfer object of unsupported type.');
fails(() => port1.postMessage({ get value() { throw new Error('getter'); } }, [buffer]), 'Error', 'getter');
check(buffer.byteLength === 8, 'getter error detached source');
fails(() => port1.postMessage({ fn() {} }, [buffer]), 'DataCloneError');
check(buffer.byteLength === 8, 'clone error detached source');
console.log('validation and graph errors preserve buffers');

const replacement = new ArrayBuffer(3);
const list = [buffer];
port1.postMessage({ get value() { list[0] = replacement; return 7; } }, list);
check(buffer.byteLength === 0 && replacement.byteLength === 3, 'transfer list was not snapshotted');
check(receiveMessageOnPort(port2).message.value === 7, 'snapshot message');
console.log('unused listed buffer detaches and list is snapshotted');

buffer = new ArrayBuffer(4);
const bytes = new Uint8Array(buffer);
port1.postMessage({ buffer, get value() { bytes[0] = 42; return 1; } }, [buffer]);
const changed = receiveMessageOnPort(port2).message;
check(new Uint8Array(changed.buffer)[0] === 42 && bytes.length === 0, 'move did not observe final bytes');
console.log('transfer moves final bytes after getters');

buffer = new ArrayBuffer(2);
const marked = new ArrayBuffer(2);
fails(() => port1.postMessage({ get value() { markAsUntransferable(marked); return 1; } }, [buffer, marked]),
  'TypeError', "Provided key doesn't match [[ArrayBufferDetachKey]]");
check(buffer.byteLength === 0 && marked.byteLength === 2, 'late mark must commit earlier list entries');
check(receiveMessageOnPort(port2) === undefined, 'failed commit queued a message');
console.log('late mark preserves ordered commit behavior');

const spare = new MessageChannel();
const lateMarked = new ArrayBuffer(2);
fails(() => port1.postMessage({ get value() { markAsUntransferable(lateMarked); return 1; } }, [spare.port1, lateMarked]),
  'TypeError', "Provided key doesn't match [[ArrayBufferDetachKey]]");
spare.port1.postMessage(9);
check(receiveMessageOnPort(spare.port2).message === 9, 'port detached before buffer commit succeeded');
spare.port1.close(); spare.port2.close();
console.log('late buffer failure preserves earlier listed ports');

buffer = new ArrayBuffer(2);
const moved = new ArrayBuffer(2);
port1.postMessage({ moved, get value() { moved.transfer(); return 1; } }, [buffer, moved]);
const late = receiveMessageOnPort(port2).message;
check(buffer.byteLength === 0 && moved.byteLength === 0 && late.moved.byteLength === 0,
  'late transfer must leave an empty recipient buffer');
check(late.moved.detached === false, 'recipient buffer must be attached');
console.log('late transfer produces an attached empty recipient buffer');

const viewed = new ArrayBuffer(4);
const oldView = new Uint8Array(viewed);
port1.postMessage({ oldView, get value() { viewed.transfer(); return 1; } }, [viewed]);
fails(() => receiveMessageOnPort(port2), 'Error', 'Unable to deserialize cloned data.');
console.log('late detached view fails during receive');
const beforeView = new ArrayBuffer(4);
const afterGetterView = new Uint8Array(beforeView, 1, 2);
port1.postMessage({ get value() { beforeView.transfer(); return 1; }, afterGetterView }, [beforeView]);
fails(() => receiveMessageOnPort(port2), 'Error', 'Unable to deserialize cloned data.');
const empty = new ArrayBuffer(0);
const emptyView = new Uint8Array(empty);
port1.postMessage({ get value() { empty.transfer(); return 1; }, emptyView }, [empty]);
check(receiveMessageOnPort(port2).message.emptyView.length === 0, 'empty declared view rejected');
console.log('view serialization preserves declared bounds after detachment');
port1.close();
port2.close();

const asyncChannel = new MessageChannel();
asyncChannel.port2.on('message', () => { throw new Error('invalid view delivered'); });
asyncChannel.port2.once('messageerror', error => {
  check(error.name === 'Error' && error.message === 'Unable to deserialize cloned data.', 'messageerror shape');
  console.log('late detached view emits messageerror');
  asyncChannel.port1.close();
  asyncChannel.port2.close();
});
const asyncBuffer = new ArrayBuffer(4);
const asyncView = new Uint8Array(asyncBuffer);
asyncChannel.port1.postMessage({ asyncView, get value() { asyncBuffer.transfer(); return 1; } }, [asyncBuffer]);
