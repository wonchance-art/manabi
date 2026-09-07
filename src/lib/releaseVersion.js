// Public deployment identity only. Never spread process.env into a response.
const SHA = /^[a-f0-9]{40}$/;
const REF = /^[A-Za-z0-9._/-]{1,160}$/;
const EDITION = /^[a-f0-9]{24}$/;
const DEPLOYMENT = /^dpl_[A-Za-z0-9]+$/;

export function buildReleaseVersion(env = {}, now = new Date().toISOString()) {
  const supplied = env.MANABI_RELEASE_SHA;
  const git = env.VERCEL_GIT_COMMIT_SHA;
  if (supplied && git && supplied !== git) throw new Error('release_commit_mismatch');
  const commit = supplied || git || null;
  const environment = ['production', 'preview'].includes(env.VERCEL_ENV) ? env.VERCEL_ENV : 'development';
  if ((commit && !SHA.test(commit)) || (!commit && (environment !== 'development' || env.VERCEL === '1'))) {
    throw new Error('release_commit_required');
  }
  const ref = env.MANABI_RELEASE_REF || env.VERCEL_GIT_COMMIT_REF || 'local';
  if (!REF.test(ref) || (commit && ref === 'local')) throw new Error('release_ref_required');
  const at = env.MANABI_RELEASE_AT || now;
  if (!Number.isFinite(Date.parse(at))) throw new Error('release_time_required');
  return {
    commit, sha: commit?.slice(0, 7) || 'dev', ref,
    at: new Date(at).toISOString(),
    releaseId: commit ? `web-v2-${commit.slice(0, 12)}` : null,
    environment,
  };
}

// The fallback belongs to THIS server artifact, never to the browser's bundle.
// Runtime identity wins when present; disagreement must not masquerade as a valid release.
export function serverReleaseVersion(runtime = {}, built = {}) {
  const identity = buildReleaseVersion({
    ...runtime,
    MANABI_RELEASE_SHA: runtime.MANABI_RELEASE_SHA || built.commit,
    MANABI_RELEASE_REF: runtime.MANABI_RELEASE_REF || built.ref,
    MANABI_RELEASE_AT: runtime.MANABI_RELEASE_AT || built.at,
    VERCEL_ENV: runtime.VERCEL_ENV || built.environment,
  });
  if (built.commit && identity.commit !== built.commit) throw new Error('release_commit_mismatch');
  return {
    ...identity,
    deploymentId: DEPLOYMENT.test(runtime.VERCEL_DEPLOYMENT_ID || '') ? runtime.VERCEL_DEPLOYMENT_ID : null,
    // This is the packaged candidate, not the independently mutable published pointer.
    bundledEditionId: EDITION.test(built.bundledEditionId || '') ? built.bundledEditionId : null,
  };
}

export function releaseVerificationErrors(version, { commit, environment, bundledEditionId } = {}) {
  const errors = [];
  if (!SHA.test(commit || '') || version?.commit !== commit) errors.push('commit');
  if (version?.sha !== commit?.slice(0, 7)) errors.push('sha');
  if (!REF.test(version?.ref || '') || version.ref === 'local') errors.push('ref');
  if (version?.releaseId !== `web-v2-${commit?.slice(0, 12)}`) errors.push('releaseId');
  if (!Number.isFinite(Date.parse(version?.at || ''))) errors.push('at');
  if (!DEPLOYMENT.test(version?.deploymentId || '')) errors.push('deploymentId');
  if (!['preview', 'production'].includes(environment) || version?.environment !== environment) errors.push('environment');
  if (!EDITION.test(bundledEditionId || '') || version?.bundledEditionId !== bundledEditionId) errors.push('bundledEditionId');
  return errors;
}
