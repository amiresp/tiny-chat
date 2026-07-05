process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

await import('./index.js');
