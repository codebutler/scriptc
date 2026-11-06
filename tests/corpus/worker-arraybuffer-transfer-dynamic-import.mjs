async function main() {
  const workers = await import('node:worker_threads');
  const { port1, port2 } = new workers.MessageChannel();
  const buffer = new ArrayBuffer(2);
  const view = new Uint8Array(buffer);
  view[0] = 42;
  const method = ['post', 'Message'].join('');
  port1[method]({ view }, [buffer]);
  if (buffer.byteLength !== 0 || view.length !== 0) throw new Error('dynamic import send did not detach');
  if (workers.receiveMessageOnPort(port2).message.view[0] !== 42) throw new Error('dynamic import send lost bytes');
  console.log('dynamic worker import supports computed transfer');
  port1.close(); port2.close();
}
main();
