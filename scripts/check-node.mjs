const major = Number(process.versions.node.split('.')[0]);

if (Number.isNaN(major)) {
  console.error('[OffDaWallV2] Could not determine Node.js version.');
  process.exit(1);
}

if (major < 20 || major >= 25) {
  console.error(
    `[OffDaWallV2] Unsupported Node.js ${process.versions.node}. Use Node 20.x - 24.x for this project.`
  );
  process.exit(1);
}

if (major === 24) {
  console.warn(
    `[OffDaWallV2] Node.js ${process.versions.node} detected. This is allowed, but verify production build in your environment before release.`
  );
} else {
  console.log(`[OffDaWallV2] Node.js ${process.versions.node} is supported.`);
}
