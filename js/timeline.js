import * as THREE from 'three';
import { state, log } from './store.js?v=0.13';

export function updateTracks() {
  const el = document.getElementById('tracks');
  if (el) el.textContent = 'Pistas: ' + state.objects.map((o) => o.name + ' (' + (state.keyframes.get(o.uuid)?.length || 0) + ' keys)').join(' · ');
}

export function recordKeyframe() {
  const selected = state.selected;
  if (!selected) return;
  const list = state.keyframes.get(selected.uuid) || [];
  list.push({
    t: state.currentTime,
    pos: selected.position.clone(),
    rot: { x: selected.rotation.x, y: selected.rotation.y, z: selected.rotation.z },
  });
  state.keyframes.set(selected.uuid, list);
  updateTracks();
  log('Keyframe guardado en ' + state.currentTime.toFixed(2) + ' s para ' + selected.name);
}

export function applyKeyframes(t) {
  state.keyframes.forEach((keys, uuid) => {
    const obj = state.objects.find((o) => o.uuid === uuid);
    if (!obj || !keys.length) return;
    if (keys.length === 1) {
      obj.position.copy(keys[0].pos);
      obj.rotation.set(keys[0].rot.x, keys[0].rot.y, keys[0].rot.z);
      return;
    }
    const sorted = [...keys].sort((a, b) => a.t - b.t);
    let a = sorted[0];
    let b = sorted[sorted.length - 1];
    for (let i = 0; i < sorted.length - 1; i++) {
      if (t >= sorted[i].t && t <= sorted[i + 1].t) { a = sorted[i]; b = sorted[i + 1]; break; }
    }
    const f = b.t === a.t ? 0 : THREE.MathUtils.clamp((t - a.t) / (b.t - a.t), 0, 1);
    obj.position.lerpVectors(a.pos, b.pos, f);
    obj.rotation.set(
      a.rot.x + (b.rot.x - a.rot.x) * f,
      a.rot.y + (b.rot.y - a.rot.y) * f,
      a.rot.z + (b.rot.z - a.rot.z) * f,
    );
  });
}

export function createVideoRecorder(canvas, onStop) {
  let recorder = null;
  const chunks = [];
  return {
    start() {
      const stream = canvas.captureStream(30);
      recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      chunks.length = 0;
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = () => onStop(new Blob(chunks, { type: 'video/webm' }));
      recorder.start();
    },
    stop() { if (recorder && recorder.state !== 'inactive') recorder.stop(); },
  };
}
