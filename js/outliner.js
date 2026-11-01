// v0.7: Outliner tipo árbol, redibujado tras cada cambio de escena.
//
// Fuente: state.objects, es decir, solo los objetos interactivos
// registrados (primitivas, modelos importados, modelos generados).
// Helpers y grillas quedan excluidos porque nunca se registran:
// GridHelper y TransformControls viven en scene.children, pero no
// en state.objects, y además se filtran explícitamente aquí y en
// los hijos. El DOM se redibuja con refreshOutliner(), llamado
// desde state.onObjectsChange (importación/generación/eliminación)
// y desde state.onSelectChange (para marcar el activo).

import { state } from './store.js?v=0.18';
import { select } from './scene.js?v=0.18';

function isHelper(obj) {
  return Boolean(obj?.isGridHelper || obj?.isTransformControls
    || obj?.type === 'GridHelper' || obj?.type === 'TransformControls');
}

function buildNode(obj) {
  const li = document.createElement('li');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'outliner-node' + (state.selected === obj ? ' active' : '');
  btn.textContent = `${obj.name || '(sin nombre)'} (${obj.type})`;
  btn.onclick = () => select(obj);
  li.appendChild(btn);
  const children = (obj.children || []).filter((c) => !isHelper(c));
  if (children.length) {
    const sub = document.createElement('ul');
    for (const child of children) sub.appendChild(buildNode(child));
    li.appendChild(sub);
  }
  return li;
}

export function refreshOutliner() {
  const el = document.getElementById('outliner');
  if (!el) return;
  el.innerHTML = '';
  const roots = state.objects.filter((o) => !isHelper(o));
  if (!roots.length) {
    el.textContent = 'Sin objetos.';
    return;
  }
  const ul = document.createElement('ul');
  ul.className = 'outliner-tree';
  for (const root of roots) ul.appendChild(buildNode(root));
  el.appendChild(ul);
}
