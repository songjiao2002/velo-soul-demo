import WebSocket from 'ws';
import {TRANSCRIPT_FRAME_BYTES} from './public/conversation-limits.mjs';
import {interimTranscript} from './asr-preview.mjs';

const maxAudioBytes = 512000;
const maxBufferedBytes = 131072;

function scribeError(type) {
  if (['auth_error', 'unaccepted_terms'].includes(type)) return 'provider_auth';
  // Scribe capacity/quota is independent of the Qwen HTTP fallback. The
  // client reserves provider_quota for the application's shared Qwen limit.
  return 'provider_unavailable';
}

// One client connection represents one locally delimited utterance.
export function relayScribeRealtime(client, {language, apiKey, connect, release, draft}) {
  let upstream;
  let ready = false;
  let closed = false;
  let finishing = false;
  let commitSent = false;
  let audioBytes = 0;
  let audioFrames = 0;
  let confirmed = '';
  let segments = 0;
  const queue = [];
  const readyTimer = setTimeout(() => fail('asr_timeout'), 8000);
  const lifeTimer = setTimeout(() => fail('asr_timeout'), 50000);

  function cleanup() {
    if (closed) return;
    closed = true;
    draft?.close();
    clearTimeout(readyTimer);
    clearTimeout(lifeTimer);
    queue.length = 0;
    release();
    if (upstream && upstream.readyState !== WebSocket.CLOSED) upstream.terminate();
  }
  function send(event, allowNewDraft = true) {
    if (client.readyState !== WebSocket.OPEN || client.bufferedAmount > maxBufferedBytes) {
      client.terminate();
      cleanup();
      return false;
    }
    if(draft){
      if(event.type==='ready')event.prepareReply=true;
      else if(audioBytes>=5120&&(event.type==='partial'||event.type==='final'))event.draftId=draft.transcript(event.text,event.type==='final',allowNewDraft);
    }
    client.send(JSON.stringify(event));
    return true;
  }
  function fail(error) {
    if (closed) return;
    if (send({type:'error', error})) client.close(1011, 'Recognition unavailable');
    cleanup();
  }
  function sendChunk(pcm, commit = false) {
    if (closed) return;
    if (upstream.readyState !== WebSocket.OPEN || upstream.bufferedAmount > maxBufferedBytes) {
      fail('network');
      return;
    }
    upstream.send(JSON.stringify({
      message_type:'input_audio_chunk', audio_base_64:pcm.toString('base64'), sample_rate:16000, commit
    }));
  }
  function commitIfReady() {
    if (ready && finishing && !commitSent && !closed) {
      commitSent = true;
      sendChunk(Buffer.alloc(0), true);
    }
  }

  client.once('close', cleanup);
  client.once('error', cleanup);
  client.on('message', (raw, binary) => {
    if (closed) return;
    if (binary) {
      if (finishing || !raw.length || raw.length % 2 || raw.length > 16384 ||
          (audioBytes += raw.length) > maxAudioBytes || ++audioFrames > 8192) return fail('invalid_request');
      if (ready) sendChunk(raw);
      else queue.push(Buffer.from(raw));
      return;
    }
    let command;
    try { command = JSON.parse(raw); } catch { return fail('invalid_request'); }
    if(command?.type==='reply_context'&&draft&&!finishing){draft.configure(command);return;}
    if (command?.type !== 'finish' || finishing || !audioBytes) return fail('invalid_request');
    finishing = true;
    commitIfReady();
  });

  const url = new URL('wss://api.elevenlabs.io/v1/speech-to-text/realtime');
  url.search = new URLSearchParams({
    model_id:'scribe_v3_live', audio_format:'pcm_16000', commit_strategy:'manual', language_code:language
  }).toString();
  try {
    upstream = connect(url.href, {
      headers:{'xi-api-key':apiKey}, handshakeTimeout:8000, maxPayload:maxBufferedBytes, perMessageDeflate:false
    });
  } catch { return fail('network'); }
  upstream.on('error', () => fail('network'));
  upstream.on('close', () => fail('network'));
  upstream.on('message', raw => {
    if (closed) return;
    let event;
    try { event = JSON.parse(raw); } catch { return fail('invalid_response'); }
    const type = event?.message_type;
    if (typeof type !== 'string') return fail('invalid_response');
    if (type === 'session_started') {
      if (ready || (event.config?.model_id && event.config.model_id !== 'scribe_v3_live')) return fail('invalid_response');
      clearTimeout(readyTimer);
      ready = true;
      if (!send({type:'ready'})) return;
      for (const pcm of queue) sendChunk(pcm);
      queue.length = 0;
      commitIfReady();
      return;
    }
    if (type === 'warning') return;
    if (type !== 'partial_transcript' && type !== 'committed_transcript') return fail(scribeError(type));
    if (!ready || typeof event.text !== 'string' || Buffer.byteLength(event.text,'utf8') > TRANSCRIPT_FRAME_BYTES) return fail('invalid_response');
    const text = [confirmed, event.text.trim()].filter(Boolean).join(' ');
    if (Buffer.byteLength(text,'utf8') > TRANSCRIPT_FRAME_BYTES) return fail('invalid_response');
    if (type === 'partial_transcript') {
      // A near-zero end-of-turn score is common on punctuated mid-sentence
      // captions. Reserve the two early generations until the turn takes shape.
      const continuing = event.turn_probability === 0 || event.turn_probability === 0.01;
      send({type:'partial', text:interimTranscript(text,language)}, finishing || !continuing);
      return;
    }
    if (++segments > 40) return fail('invalid_response');
    confirmed = text;
    if (!commitSent) {
      send({type:'partial', text:interimTranscript(confirmed,language)});
      return;
    }
    if (send({type:'final', text:confirmed})) client.close(1000, 'Utterance complete');
    cleanup();
  });
}
