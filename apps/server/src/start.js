process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

await import('./feature-io.js');
await import('./feature-mount.js');
await import('./index.js');
