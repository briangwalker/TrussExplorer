'use strict';
// Reference for #207 (vibration modes): K·φ = ω²·M·φ with a lumped (diagonal) mass matrix.
// Method: scale to the standard problem A = M^-1/2 K M^-1/2 (exact for diagonal M), then cyclic Jacobi rotations.
// Jacobi is simple, always converges, gives every mode to full precision and orthogonal vectors; fine up to ~300 free DOFs
// (a 2D bridge is ~30, a 3D one ~100-300). Units: K in N/mm, M in kg -> λ in N/(mm·kg) = 1000 s^-2, so ω² = 1000 λ.
(function (root) {
function jacobiEigen(A, tol = 1e-12, maxSweeps = 100) {   // A: n×n symmetric (array of Float64Array), overwritten
  const n = A.length, V = Array.from({ length: n }, (_, i) => { const r = new Float64Array(n); r[i] = 1; return r; });
  let norm0 = 0; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) norm0 += A[i][j] * A[i][j];
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
    if (off <= tol * tol * norm0) return { values: A.map((r, i) => r[i]), vectors: V, sweeps: sweep };
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      const apq = A[p][q]; if (Math.abs(apq) < 1e-300) continue;
      const th = (A[q][q] - A[p][p]) / (2 * apq), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
      for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
      for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
    }
  }
  throw new Error('Jacobi did not converge');
}
// K: full stiffness (n×n, N/mm); fixed: Set of constrained DOF indices; mass: Float64Array per DOF (kg); count: modes wanted
function modes(K, fixed, mass, count = 6) {
  const free = []; for (let i = 0; i < K.length; i++) if (!fixed.has(i)) free.push(i);
  const zeroMass = free.filter(i => !(mass[i] > 0));
  if (zeroMass.length) throw new Error('every free DOF needs a mass (zero at ' + zeroMass.join(',') + ')');
  const s = free.map(i => 1 / Math.sqrt(mass[i]));
  const A = free.map((i, a) => Float64Array.from(free, (j, b) => K[i][j] * s[a] * s[b]));
  const { values, vectors, sweeps } = jacobiEigen(A);
  const order = values.map((v, k) => k).sort((x, y) => values[x] - values[y]);
  const out = order.slice(0, count).map(k => {
    const lam = values[k], phi = new Float64Array(K.length); free.forEach((i, a) => { phi[i] = vectors[a][k] * s[a]; });   // back to physical DOFs
    const omega = Math.sqrt(Math.max(0, lam) * 1000);
    return { lambda: lam, omega, f: omega / (2 * Math.PI), phi };
  });
  return { modes: out, nFree: free.length, sweeps, mechanism: values.some(v => v < -1e-9 * Math.max(...values.map(Math.abs))) };
}
// share of a mode's kinetic energy in each direction (DOF index mod dofsPerNode): names the mode (bounce, sway, twist ...)
function energyShares(phi, mass, dofsPerNode) { const e = new Float64Array(dofsPerNode); let t = 0; phi.forEach((v, i) => { const k = mass[i] * v * v; e[i % dofsPerNode] += k; t += k; }); return Array.from(e, x => t ? x / t : 0); }
const api = { jacobiEigen, modes, energyShares };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TEModal = api;
})(typeof window !== 'undefined' ? window : globalThis);
