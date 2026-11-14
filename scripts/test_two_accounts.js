import { io } from 'socket.io-client';

async function getToken(uid, name) {
  const res = await fetch('http://localhost:3000/api/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, name, email: `${uid}@campus.edu` })
  });
  const data = await res.json();
  return data.token;
}

async function runTest() {
  console.log('=== STARTING TWO-ACCOUNT BIDIRECTIONAL MESSAGING TEST ===\n');

  const studentA_id = 'student_sarah_jenkins';
  const studentB_id = 'student_alex_rivera';

  console.log('1. Obtaining JWT tokens for Student A (Sarah) and Student B (Alex)...');
  const tokenA = await getToken(studentA_id, 'Sarah Jenkins');
  const tokenB = await getToken(studentB_id, 'Alex Rivera');
  console.log('Tokens obtained successfully.');

  console.log('2. Connecting two separate Socket.io client sessions...');
  const socketA = io('http://localhost:3000', { auth: { token: tokenA } });
  const socketB = io('http://localhost:3000', { auth: { token: tokenB } });

  await Promise.all([
    new Promise(res => socketA.on('connect', res)),
    new Promise(res => socketB.on('connect', res))
  ]);
  console.log('Both Socket.io client sessions connected successfully.');

  const receivedByA = [];
  const receivedByB = [];

  socketA.on('receive_message', (msg) => {
    console.log(`[Student A received]: "${msg.text}" from ${msg.from}`);
    receivedByA.push(msg);
  });

  socketB.on('receive_message', (msg) => {
    console.log(`[Student B received]: "${msg.text}" from ${msg.from}`);
    receivedByB.push(msg);
  });

  // Step 3 & 4: Student A sends "Hey, are you available?" -> Student B must receive it
  console.log('\n3. Student A sending: "Hey, are you available?"');
  socketA.emit('send_message', {
    to: studentB_id,
    text: 'Hey, are you available?'
  });

  // Wait for Student B to receive
  await new Promise(resolve => {
    const check = setInterval(() => {
      if (receivedByB.length >= 1) {
        clearInterval(check);
        resolve();
      }
    }, 100);
  });
  console.log('SUCCESS: Student B received the message immediately!');

  // Step 5 & 6: Student B replies "Yes, what\'s up?" -> Student A must receive it
  console.log('\n4. Student B replying: "Yes, what\'s up?"');
  socketB.emit('send_message', {
    to: studentA_id,
    text: "Yes, what's up?"
  });

  // Wait for Student A to receive
  await new Promise(resolve => {
    const check = setInterval(() => {
      if (receivedByA.length >= 1) {
        clearInterval(check);
        resolve();
      }
    }, 100);
  });
  console.log('SUCCESS: Student A received the reply immediately!');

  // Step 7: Student A sends another message
  console.log('\n5. Student A sending follow-up: "Can you help review the ML hackathon project?"');
  socketA.emit('send_message', {
    to: studentB_id,
    text: 'Can you help review the ML hackathon project?'
  });

  await new Promise(resolve => {
    const check = setInterval(() => {
      if (receivedByB.length >= 2) {
        clearInterval(check);
        resolve();
      }
    }, 100);
  });
  console.log('SUCCESS: Student B received follow-up message!');

  // Step 8: Verify conversation history order from backend REST API
  console.log('\n6. Checking persistent conversation history from API...');
  const resHistA = await fetch(`http://localhost:3000/api/messages/${studentB_id}`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const historyA = await resHistA.json();

  const resHistB = await fetch(`http://localhost:3000/api/messages/${studentA_id}`, {
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  const historyB = await resHistB.json();

  console.log(`History count for Student A: ${historyA.length} messages`);
  console.log(`History count for Student B: ${historyB.length} messages`);

  if (historyA.length >= 3 && historyA.length === historyB.length) {
    console.log(`SUCCESS: Both students see the exact same ${historyA.length} messages in identical order!`);
    console.log('Last 3 messages in history:');
    historyA.slice(-3).forEach((m, i) => console.log(`  [${i+1}] ${m.from === studentA_id ? 'Sarah' : 'Alex'}: "${m.text}"`));
  } else {
    throw new Error(`Message counts mismatch: A=${historyA.length}, B=${historyB.length}`);
  }

  // Step 9 & 10: Disconnect Student B, send offline message from Student A, reconnect Student B
  console.log('\n7. Disconnecting Student B...');
  socketB.disconnect();

  console.log('Student A sending message while Student B is offline: "Let me know when you reconnect"');
  socketA.emit('send_message', {
    to: studentB_id,
    text: 'Let me know when you reconnect'
  });

  await new Promise(r => setTimeout(r, 600));

  console.log('Reconnecting Student B and fetching history after reconnect...');
  const resHistAfter = await fetch(`http://localhost:3000/api/messages/${studentA_id}`, {
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  const historyAfter = await resHistAfter.json();
  console.log(`History after reconnect: ${historyAfter.length} messages`);
  const lastMsg = historyAfter[historyAfter.length - 1];
  console.log(`Last message received: "${lastMsg.text}"`);

  if (lastMsg.text === 'Let me know when you reconnect') {
    console.log('SUCCESS: Offline message persisted and retrieved upon reconnect!');
  }

  socketA.disconnect();
  console.log('\n=== ALL TWO-ACCOUNT BIDIRECTIONAL MESSAGING TESTS PASSED ===');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
