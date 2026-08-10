import { Queue } from 'bullmq';

const queue = new Queue('test.queue', {
  connection: { host: 'localhost', port: 6379 }
});

async function run() {
  console.log("Enqueuing job to test.queue...");
  await queue.add('test-job', { hello: 'world' });
  console.log("Job enqueued!");
  process.exit(0);
}

run();
